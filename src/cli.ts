#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { createElement } from 'react';
import { render } from 'ink';
import { App } from './ui/App';
import { emitAgent } from './ui/events';
import { programmerGraph } from './programmer/index';
import { sanitizeConversationMessages } from './programmer/utils';
import { HumanMessage } from '@langchain/core/messages';
import { applyProviderEnv, readProviderConfig, writeProviderConfig } from './config/provider';

const program = new Command();

program
  .name('code-swe')
  .description('Agentic coding assistant — run it inside any project folder')
  .version('1.0.0');

program
  .command('run')
  .description('Open interactive CLI and run the coding agent')
  .option('-p, --path <dir>', 'Path to the project (defaults to cwd)', process.cwd())
  .action(async (options: { path: string }) => {
    const repoPath = path.resolve(options.path);
    let activeAbortController: AbortController | null = null;
    const initialProviderConfig = await readProviderConfig(repoPath);
    applyProviderEnv(initialProviderConfig);

    // Persist agent state between runs so conversation context accumulates
    let currentState: any = null;

    const persistProviderConfig = async (nextConfig: typeof initialProviderConfig) => {
      applyProviderEnv(nextConfig);
      await writeProviderConfig(repoPath, nextConfig);
    };

    const runQuery = async (query: string, interruptCurrent: boolean, providerConfig = initialProviderConfig) => {
      if (interruptCurrent && activeAbortController) {
        activeAbortController.abort();
      }

      const controller = new AbortController();
      activeAbortController = controller;

      try {
        // Build starting messages by appending the new user query to the
        // previous conversation messages (if any). This ensures the LLM
        // sees the new instruction in the chat history.
        const userMsg = new HumanMessage(query);

        const priorMessages = currentState?.messages
          ? sanitizeConversationMessages(currentState.messages)
          : [];

        const startingMessages = priorMessages.length > 0
          ? [...priorMessages, userMsg]
          : [userMsg];

        const inputState = {
          query,
          repoPath,
          providerConfig,
          notes: currentState?.notes ?? '',
          messages: startingMessages,
          summary: currentState?.summary ?? '',
        };

        const result = await programmerGraph.invoke(inputState, {
          signal: controller.signal,
          recursionLimit: 100,
        });

        // Save the returned state so subsequent runs reuse it
        currentState = result;

        emitAgent({ type: 'done', summary: result.summary });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes('abort')) {
          emitAgent({ type: 'llm_text', text: 'Previous request stopped. Starting the new one.' });
          return;
        }
        emitAgent({ type: 'error', message });
      } finally {
        if (activeAbortController === controller) {
          activeAbortController = null;
        }
      }
    };

    const abortCurrentRun = () => {
      activeAbortController?.abort();
    };

    const { waitUntilExit } = render(
      createElement(App, {
        repoPath,
        initialProviderConfig,
        onSaveProviderConfig: persistProviderConfig,
        onSubmit: async (query: string, providerConfig) => runQuery(query, false, providerConfig),
        onInterruptSubmit: async (query: string, providerConfig) => runQuery(query, true, providerConfig),
        onAbortCurrent: abortCurrentRun,
      })
    );

    await waitUntilExit();
    process.exit(0);
  });

program.parse(process.argv);

