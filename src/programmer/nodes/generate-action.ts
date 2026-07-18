import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { createGrepTool, createReadTool, createEditTool, createNewFileTool, createGlobTool, createBashTool, createMarkTaskCompleteTool } from '../../tools';
import { emitAgent } from '../../ui/events';
import type { ProgrammerState } from '../types';

const HISTORY_WINDOW = 30;

// ...existing code...
function buildSystemPrompt(taskDescription: string): string {
  return `You are an expert software engineer implementing this task:
${taskDescription}

Use tools intentionally and keep calls minimal. When using tools, you can also provide explanatory text to describe what you're doing and why.

Tool guide:
- glob: Find files by path pattern when you do not know exact file locations.
- grep: Search file contents by keyword when you know what text to find.
- read: Read file contents before editing. Use for understanding exact current code and formatting.
- edit: Modify an existing file. Pass a list of {oldStr, newStr} pairs applied in order — use multiple entries in one call instead of calling edit repeatedly on the same file.
- create_file: Create a new file with full content in one call.
- bash: Run quick repo-local commands for checks (for example test/build/list/status).
- mark_task_complete: Call only when all required work is done and no further tool/action is needed. When you call this tool the agent will exit the work loop — do not call it unless you are certain no further edits or tool calls are necessary.

When to use which:
1) Known file, one or more changes: read -> edit (with all edits in one call).
2) Need to locate by filename/path: glob -> read -> edit/create_file.
3) Need to locate by text/symbol: grep -> read -> edit/create_file.
4) Need verification: bash after edits.

CRITICAL EDITING RULES:
- ALWAYS read the file first before editing to understand exact formatting
- oldStr must match the file EXACTLY including whitespace, quotes, newlines, and punctuation
- If content is on one line in the file, match it on one line (don't add newlines)
- If content spans multiple lines, match it exactly as written (including all newlines)
- Single quotes vs double quotes matter - match exactly what you see
- If an edit fails, read the file again to see the actual formatting
- Common mistake: Assuming formatted code when file has compact single-line data structures

Guidelines:
- Do not call tools repeatedly for the same information.
- Prefer one focused search, then read only relevant files.
- Keep edits minimal and preserve formatting.
- Ensure oldStr matches exactly what was read - copy/paste is your friend.
- You can provide both explanatory text and tool calls in the same response.
- When you need to explain what you're doing, include that explanation in your response along with the tool calls.

Avoid repetition and unnecessary verbosity:
- Do not repeat the same reasoning or produce the same output across multiple responses.
- If the previous turn already said essentially the same thing and no new information or tool progress was made, do not restate it again.
- Instead, take a concrete next step: make a tool call,call 'mark_task_complete' if the task is truly complete.
- Prefer progress over explanation when you are stuck.

When the task is complete:
- If you determine there is no further code change, verification, or tool call needed, call the 'mark_task_complete' tool (do not only state completion in text). This will exit the work loop and mark the task done.
`;
}
// ...existing code...
function buildFirstTaskMessage(state: ProgrammerState): HumanMessage {
  return new HumanMessage(
    `Query: "${state.query}"\n\nNotes:\n${state.notes || '(none)'}\n\nStart implementing this now. Go directly to the code change - do not over-investigate.`
  );
}

function emitResponseEvent(response: AIMessage): void {
  const toolCalls = response.tool_calls ?? [];
  const content = response.content;
  
  // Emit content if present
  if (content && typeof content === 'string' && content.trim().length > 0) {
    emitAgent({
      type: 'llm_text',
      text: content,
    });
  }
  
  // Emit tool calls if present
  if (toolCalls.length > 0) {
    const firstCall = toolCalls[0];
    emitAgent({
      type: 'tool_call',
      name: firstCall?.name ?? '',
      args: (firstCall?.args ?? {}) as Record<string, unknown>,
    });
  }
}


export async function generateActionNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {
  const grepTool = createGrepTool(state.repoPath);
  const readTool = createReadTool(state.repoPath);
  const editTool = createEditTool(state.repoPath);
  const createFileTool = createNewFileTool(state.repoPath);
  const globTool = createGlobTool(state.repoPath);
  const bashTool = createBashTool(state.repoPath);
  const markTaskCompleteTool = createMarkTaskCompleteTool();

  // const llm = new ChatOllama({
  //   model: 'qwen3-coder:480b-cloud',
  //   // model: 'qwen2.5-coder:7b', 
  //   temperature: 0.1,
  //   baseUrl: 'http://localhost:11434',
  //   numCtx: 131072,
  //   numPredict: 32768,
  // }).bindTools([globTool, grepTool, readTool, editTool, createFileTool, bashTool, markTaskCompleteTool]);

  // OpenAI alternative — comment out Ollama above and uncomment below
  const llm = new ChatOpenAI({
    model: 'gpt-5-mini',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 1,
  }).bindTools([globTool, grepTool, readTool, editTool, createFileTool, bashTool, markTaskCompleteTool]);
  

  const messageHistory = state.messages;
  const firstTaskMessage = buildFirstTaskMessage(state);
  const systemMessage = new SystemMessage(buildSystemPrompt(state.query));

  const inputMessages =
    messageHistory.length === 0
      ? [systemMessage, firstTaskMessage]
      : [systemMessage, ...messageHistory.slice(-HISTORY_WINDOW)];

  // logMessageHistory removed

  const responseMessage = await llm.invoke(inputMessages);
  if (!(responseMessage instanceof AIMessage)) {
    emitAgent({ type: 'error', message: 'Model returned non-AI message.' });
    return { messages: [] };
  }

  const newMessages =
    messageHistory.length === 0
      ? [firstTaskMessage, responseMessage]
      : [responseMessage];

  emitResponseEvent(responseMessage);

  return { messages: newMessages };
}
