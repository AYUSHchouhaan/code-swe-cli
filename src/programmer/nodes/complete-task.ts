import { ToolMessage, HumanMessage } from '@langchain/core/messages';
import type { AIMessage } from '@langchain/core/messages';
import { emitAgent } from '../../ui/events';
import type { ProgrammerState, PlanStep } from '../types';

/**
 * Node: complete-task
 *
 * Triggered when the LLM calls the mark_task_complete tool.
 * - Extracts the summary from the tool call args (no additional LLM call needed).
 * - Adds a ToolMessage to close the pending tool call (required for valid history).
 * - Marks the task as completed in the plan.
 * - Resets taskActionsCount for the next task.
 * - Appends a context HumanMessage so the model knows to move on.
 */
export async function completeTaskNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {
  const currentTask = state.plan.find((t) => !t.completed);
  if (!currentTask) {
    return {};
  }

  // Extract summary from the mark_task_complete tool call args
  const lastAI = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  const markCall = lastAI?.tool_calls?.find((tc) => tc.name === 'mark_task_complete');
  const taskSummary: string =
    (markCall?.args?.summary as string | undefined) ?? `Task ${currentTask.index} completed.`;

  emitAgent({ type: 'task_done', index: currentTask.index });

  // Emit task_start for the next task if there is one
  const updatedPlan: PlanStep[] = state.plan.map((t) =>
    t.index === currentTask.index ? { ...t, completed: true } : t
  );
  const nextTask = updatedPlan.find(t => !t.completed);
  if (nextTask) {
    emitAgent({ type: 'task_start', index: nextTask.index, total: state.plan.length, description: nextTask.plan });
  }

  // Close the pending tool call — LangChain requires every tool_call to have a
  // corresponding ToolMessage before the next human turn.
  const toolMsg = new ToolMessage({
    tool_call_id: markCall?.id ?? 'mark_task_complete',
    content: `✅ Task ${currentTask.index} marked complete.`,
  });

  // Tell the model this task is done and to move on
  const contextMsg = new HumanMessage(
    `✅ Task ${currentTask.index} completed: ${taskSummary}\n\nMove on to the next incomplete task.`
  );

  return {
    plan: updatedPlan,
    messages: [toolMsg, contextMsg],
    taskActionsCount: 0,
  };
}

