import { ToolMessage, HumanMessage } from '@langchain/core/messages';
import type { AIMessage } from '@langchain/core/messages';
import { emitAgent } from '../../ui/events';
import type { ProgrammerState } from '../types';

/**
 * Node: complete-task
 *
 * Triggered when the LLM calls the mark_task_complete tool.
 * - Extracts the summary from the tool call args (no additional LLM call needed).
 * - Adds a ToolMessage to close the pending tool call (required for valid history).
 * - Emits task completion for the single task flow.
 * - Resets taskActionsCount and appends context HumanMessage.
 */
export async function completeTaskNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {
  const taskIndex = 1;

  // Extract summary from the mark_task_complete tool call args
  const lastAI = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  const markCall = lastAI?.tool_calls?.find((tc) => tc.name === 'mark_task_complete');
  const taskSummary: string =
    (markCall?.args?.summary as string | undefined) ?? `Task ${taskIndex} completed.`;

  // Close the pending tool call — LangChain requires every tool_call to have a
  // corresponding ToolMessage before the next human turn.
  const toolMsg = new ToolMessage({
    tool_call_id: markCall?.id ?? 'mark_task_complete',
    content: `✅ Task ${taskIndex} marked complete.`,
  });

  // Tell the model this task is done and to move on
  const contextMsg = new HumanMessage(
    `✅ Task ${taskIndex} completed: ${taskSummary}`
  );

  return {
    messages: [toolMsg, contextMsg],
    taskActionsCount: 0,
  };
}

