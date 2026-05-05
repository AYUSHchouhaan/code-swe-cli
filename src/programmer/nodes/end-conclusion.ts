import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { emitAgent } from '../../ui/events';
import type { ProgrammerState } from '../types';

/**
 * Node: end-conclusion
 *
 * All tasks are complete. Produces a final summary of everything that was done.
 */
export async function endConclusionNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {

  const llm = new ChatOllama({
    model: 'qwen3-coder:480b-cloud',
    temperature: 0.1,
    baseUrl: 'http://localhost:11434',
    numCtx: 131072,
    numPredict: 8192,
  });

  // Google Gemini alternative
  // const llm = new ChatGoogleGenerativeAI({
  //   model: 'gemini-2.5-pro-exp-03-25',
  //   apiKey: process.env.GOOGLE_API_KEY,
  //   temperature: 0,
  // });

  const conversationSummary = state.messages
    .filter((m) => m.getType() === 'human')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .slice(-10)
    .join('\n');

  emitAgent({ type: 'thinking' });
  const response = await llm.invoke([
    new SystemMessage(
      'You are summarising a completed coding session. Write a clear, concise summary (8 - 10 sentences) of what you have done .'
    ),
    new HumanMessage(
      `Original Query: "${state.query}"

Notes:
${state.notes || '(none)'}

Key Events:
${conversationSummary}

Write the final summary now.`
    ),
  ]);

  const summary =
    typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  // summary is emitted from cli.ts via the 'done' event after programmerGraph completes
  return { summary };
}
