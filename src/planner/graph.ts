import { END, START, StateGraph } from '@langchain/langgraph';
import { AIMessage } from '@langchain/core/messages';
import { PlannerStateAnnotation } from './types';
import type { PlannerState } from './types';
import {
  generatePlanActionNode,
  takePlanActionNode,
  generatePlanNode,
  notesNode,
  plannerReasoningThinkingNode,
} from './nodes';

/**
 * Conditional edge from generate-plan-context-action:
 *   - complete_planning tool call → generate-plan
 *   - grep / read tool call       → take-action-context
 *   - plain text (reasoning)      → reasoning-thinking
 */
function routeAfterContextAction(state: PlannerState): string {
  const lastMessage = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    const toolName = lastMessage.tool_calls[0]?.name;
    if (toolName === 'complete_planning') {
      return 'generate-plan';
    }
    return 'take-plan-action';
  }

  // No tool call — model is reasoning/thinking
  return 'reasoning-thinking';
}

const workflow = new StateGraph(PlannerStateAnnotation)
  .addNode('generate-plan-action', generatePlanActionNode)
  .addNode('take-plan-action', takePlanActionNode)
  .addNode('reasoning-thinking', plannerReasoningThinkingNode)
  .addNode('generate-plan', generatePlanNode)
  .addNode('generate-notes', notesNode)
  // ── edges ──
  .addEdge(START, 'generate-plan-action')
  .addConditionalEdges('generate-plan-action', routeAfterContextAction, {
    'take-plan-action': 'take-plan-action',
    'generate-plan': 'generate-plan',
    'reasoning-thinking': 'reasoning-thinking',
  })
  // After executing a tool, loop back to gather more context
  .addEdge('take-plan-action', 'generate-plan-action')
  // After reasoning, loop back to generate-plan-action
  .addEdge('reasoning-thinking', 'generate-plan-action')
  // After plan is ready, create notes then finish
  .addEdge('generate-plan', 'generate-notes')
  .addEdge('generate-notes', END);

export const plannerGraph = workflow.compile();
plannerGraph.name = 'Planner Agent — Context → Plan → Notes';
