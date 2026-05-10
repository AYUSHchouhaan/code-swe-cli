import { ToolMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import { createGrepTool, createReadTool, createGlobTool } from '../../tools';
import { emitAgent } from '../../ui/events';
import type { PlannerState } from '../types';

/**
 * Node: take-action-context
 *
 * Executes all pending tool calls from the last AI message and appends
 * ToolMessage results back to the conversation so the LLM can continue.
 */
export async function takePlanActionNode(
  state: PlannerState
): Promise<Partial<PlannerState>> {

  const grepTool = createGrepTool(state.repoPath);
  const readTool = createReadTool(state.repoPath);
  const globTool = createGlobTool(state.repoPath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolMap: Record<string, any> = {
    glob: globTool,
    grep: grepTool,
    read: readTool,
  };

  // Find the last AI message (which carries the tool_calls)
  const lastMessage = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  if (!lastMessage || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return { messages: [] };
  }

  const toolMessages: ToolMessage[] = [];

  // Execute only the FIRST tool call — one tool per graph iteration
  const toolCall = lastMessage.tool_calls[0];
  if (!toolCall) return { messages: [] };
  const { id, name, args } = toolCall;

  const t = toolMap[name];
  let result: string;

  try {
    result = String(await t.invoke(args as any));
  } catch (err) {
    result = `Error invoking ${name}: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (name !== 'read') {
    emitAgent({ type: 'tool_result', name, result: result.slice(0, 300) });
  }
  toolMessages.push(
    new ToolMessage({
      tool_call_id: id ?? name,
      content: result,
    })
  );

  return { messages: toolMessages };
}
