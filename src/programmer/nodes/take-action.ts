import { ToolMessage, AIMessage } from '@langchain/core/messages';
import { createGrepTool, createReadTool, createEditTool, createNewFileTool, createGlobTool } from '../../tools';
import type { ProgrammerState } from '../types';

/**
 * Node: take-action
 *
 * Executes the single tool call from the last AI message,
 * appends the ToolMessage result, and loops back to generate-action.
 */
export async function takeActionNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {
  console.log('\n=== PROGRAMMER NODE: take-action ===');

  const grepTool = createGrepTool(state.repoPath);
  const readTool = createReadTool(state.repoPath);
  const editTool = createEditTool(state.repoPath);
  const createFileTool = createNewFileTool(state.repoPath);
  const globTool = createGlobTool(state.repoPath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolMap: Record<string, any> = {
    glob: globTool,
    grep: grepTool,
    read: readTool,
    edit: editTool,
    create_file: createFileTool,
  };

  // Find the last AI message with tool calls
  const lastAI = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  if (!lastAI || !lastAI.tool_calls || lastAI.tool_calls.length === 0) {
    console.warn('take-action called but no pending tool calls found.');
    return { messages: [] };
  }

  // Execute only the first tool call
  const toolCall = lastAI.tool_calls[0];
  if (!toolCall) return { messages: [] };
  const { id, name, args } = toolCall;
  console.log(`  Executing tool: ${name}`, args);

  const t = toolMap[name];
  let result: string;
  if (t) {
    try {
      result = String(await t.invoke(args));
    } catch (err) {
      result = `Error invoking ${name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else {
    result = `Unknown tool: ${name}`;
  }

  console.log(`  Result (${name}):`, result.slice(0, 150));

  const toolMsg = new ToolMessage({
    tool_call_id: id ?? name,
    content: result,
  });

  return { messages: [toolMsg], taskActionsCount: state.taskActionsCount + 1 };
}
