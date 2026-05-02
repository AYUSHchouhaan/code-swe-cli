#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { createElement } from 'react';
import { render } from 'ink';
import { App } from './ui/App';
import { emitAgent } from './ui/events';
import { programmerGraph } from './programmer/index';

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

    const runQuery = async (query: string, interruptCurrent: boolean) => {
      if (interruptCurrent && activeAbortController) {
        activeAbortController.abort();
      }

      const controller = new AbortController();
      activeAbortController = controller;

      try {
        const result = await programmerGraph.invoke(
          {
            query,
            repoPath,
            notes: '',
            messages: [],
            summary: '',
          },
          { signal: controller.signal }
        );

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

    const { waitUntilExit } = render(
      createElement(App, {
        repoPath,
        onSubmit: async (query: string) => runQuery(query, false),
        onInterruptSubmit: async (query: string) => runQuery(query, true),
      })
    );

    await waitUntilExit();
    process.exit(0);
  });

program.parse(process.argv);

