import type { AIMessage } from '@langchain/core/messages';
import type { PlannerState } from '../types';

/**
 * Node: reasoning-thinking (planner)
 *
 * Handles plain-text LLM responses from generate-plan-context-action that
 * contain no tool call — this is the model thinking through the codebase
 * before it decides which tool to use next.
 */
export async function plannerReasoningThinkingNode(
  state: PlannerState
): Promise<Partial<PlannerState>> {
  // empty node 
  return {};
}
