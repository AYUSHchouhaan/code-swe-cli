import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { PlannerState } from '../types';

/**
 * Node: notes
 *
 * Summarises the entire planning conversation into a short notes string.
 * These notes are passed to the programmer agent as helpful context.
 */
export async function notesNode(state: PlannerState): Promise<Partial<PlannerState>> {

  const llm = new ChatOllama({
    model: 'qwen3-coder:480b-cloud',
    temperature: 0.1,
    baseUrl: 'http://localhost:11434',
    numCtx: 131072,
    numPredict: 8192,
  });

  // Google Gemini alternative — comment out Ollama above and uncomment below
  // const llm = new ChatGoogleGenerativeAI({
  //   model: 'gemini-2.5-pro-exp-03-25',
  //   apiKey: process.env.GOOGLE_API_KEY,
  //   temperature: 0,
  // });

  const contextSummary = state.messages
    .map((m) => {
      const type = m.getType();
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `[${type.toUpperCase()}]: ${content}`;
    })
    .join('\n\n');

  const planSummary = state.plan
    .map((s) => `${s.index}. ${s.plan}`)
    .join('\n');

  const response = await llm.invoke([
    new SystemMessage(
      `You are a technical writer summarising a code-planning session for a programmer.
Produce a compact paragraph (30-50 sentences) noting:
- What the user wants to achieve
- Which files are relevant and why
- Key observations from the codebase analysis
- The overall implementation approach from the plan how the codebase work
- what should be include in the notes so that programmer graph can understand the context and execute the plan effectively
- what the important files and relationships between files that should be included in the notes for programmer graph to understand the codebase structure and execute the plan effectively`
    ),
    new HumanMessage(
      `User Query: "${state.query}"

Planning Conversation:
${contextSummary}

Final Plan:
${planSummary}

Write the summary notes now.`
    ),
  ]);

  const notes = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  return { notes };
}
