import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { createGrepTool, createReadTool, createEditTool, createNewFileTool, createGlobTool, createMarkTaskCompleteTool } from '../../tools';
import { emitAgent } from '../../ui/events';
import type { ProgrammerState } from '../types';

/**
 * Builds the system prompt dynamically so the current task is always
 * explicitly stated at the top, making it impossible for the LLM to lose
 * track of what it is supposed to be working on.
 */
function buildSystemPrompt(taskDescription: string): string {
  return `You are an expert software engineer implementing a specific task in a real codebase.

════════════════════════════════════════════
CURRENT TASK
${taskDescription}
════════════════════════════════════════════

Tools available:
  glob              → find files by path pattern — always prefix dirs with **/ (e.g. "**/src/**/*.ts")
  grep              → search file contents for keywords
  read              → read up to 4 files at once — pass an array of relevant paths
  edit              → modify an EXISTING file (exact string replacement)
  create_file       → create a NEW file with full content
  mark_task_complete → call ONLY when the task is fully implemented

════════════════════════════════════════════
STRICT RULES — FOLLOW EXACTLY
════════════════════════════════════════════


1. ONLY READ FILES THAT ARE DIRECTLY NEEDED FOR THIS TASK.
   • Pass all needed and relevant files in ONE read call (max 4 paths).
  • If the task description already tells you what to do, skip reading and edit immediately.
   • Do NOT explore the codebase out of curiosity.

2. NEVER READ THESE — always irrelevant:
   • package.json / package-lock.json / yarn.lock
   • *.css / *.scss (unless the task is purely about styling)
   • test/spec files, config files unrelated to the feature

3. NEVER READ OR GREP THE SAME THING TWICE.
   Check message history before every tool call. If you already read a file or ran a grep, skip it.

4. MAKE THE CODE CHANGE AS FAST AS POSSIBLE.
  • Trust the task description and execute directly.
   • If the file to edit is clear from the task, go straight to read → edit.
   • If you need to create a new file, go straight to create_file.

5. CALL mark_task_complete IMMEDIATELY AFTER THE CHANGE IS MADE.
   Do NOT keep reading or searching after editing/creating a file.
   Call mark_task_complete right after the edit or create_file succeeds.

════════════════════════════════════════════
OPTIMAL WORKFLOW (follow this order)
════════════════════════════════════════════

For EDITING an existing file:
  1. read({ filePaths: ["src/target.ts"] })  → inspect the file
  2. edit  → apply the change
  3. mark_task_complete

For CREATING a new file:
  1. create_file → write the full file
  2. mark_task_complete

For LOCATING a file first:
  1. glob or grep → find the right file (ONE search max)
  2. read({ filePaths: ["...", "..."] }) → read up to 4 relevant files at once
  3. edit or create_file → make the change
  4. mark_task_complete

Never use more than 1 grep/glob before making a change.

════════════════════════════════════════════
EDITING RULES
════════════════════════════════════════════

• oldString must match EXACTLY what exists in the file — copy it from the read result.
• Modify only the lines required by the task.
• Preserve formatting and indentation.

════════════════════════════════════════════
MESSAGE HISTORY
════════════════════════════════════════════

The message history contains prior tool calls, results, and file reads.
Always check it before making a tool call to avoid repetition.`;
}


export async function generateActionNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {
  const grepTool = createGrepTool(state.repoPath);
  const readTool = createReadTool(state.repoPath);
  const editTool = createEditTool(state.repoPath);
  const createFileTool = createNewFileTool(state.repoPath);
  const globTool = createGlobTool(state.repoPath);
  const markCompleteTool = createMarkTaskCompleteTool();

  const llm = new ChatOllama({
    model: 'qwen3-coder:480b-cloud',
    temperature: 0.1,
    baseUrl: 'http://localhost:11434',
    numCtx: 131072,
    numPredict: 32768,
  }).bindTools([globTool, grepTool, readTool, editTool, createFileTool, markCompleteTool]);

  // Google Gemini alternative — comment out Ollama above and uncomment below
  // const llm = new ChatGoogleGenerativeAI({
  //   model: 'gemini-2.5-pro-exp-03-25',
  //   apiKey: process.env.GOOGLE_API_KEY,
  //   temperature: 0,
  // }).bindTools([globTool, grepTool, readTool, editTool, createFileTool, markCompleteTool]);

  const messageHistory = state.messages;
  const trimmedHistory = messageHistory.slice(-30);

  const systemPrompt = buildSystemPrompt(state.query);

  const firstTaskMessage = new HumanMessage(
    `Query: "${state.query}"\n\nNotes:\n${state.notes || '(none)'}\n\nStart implementing this now. Go directly to the code change — do not over-investigate.`
  );

  const inputMessages =
    messageHistory.length === 0
      ? [new SystemMessage(systemPrompt), firstTaskMessage]
      : [new SystemMessage(systemPrompt), ...trimmedHistory];

  emitAgent({ type: 'thinking' });
  const response = await llm.invoke(inputMessages) as AIMessage;

  const newMessages =
    messageHistory.length === 0
      ? [firstTaskMessage, response]
      : [response];

  const toolCalls = response.tool_calls ?? [];
  if (toolCalls.length > 0) {
    emitAgent({ type: 'tool_call', name: toolCalls[0]?.name ?? '', args: (toolCalls[0]?.args ?? {}) as Record<string, unknown> });
  } else {
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    emitAgent({ type: 'llm_text', text: content });
  }

  return { messages: newMessages };
}
