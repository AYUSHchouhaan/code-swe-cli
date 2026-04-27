import { END, START, StateGraph } from '@langchain/langgraph';
import { AIMessage } from '@langchain/core/messages';
import { ProgrammerStateAnnotation } from './types';
import type { ProgrammerState } from './types';
import {
  generateActionNode,
  takeActionNode,
  completeTaskNode,
  endConclusionNode,
  reasoningThinkingNode,
} from './nodes';

/**
 * Conditional edge from generate-action:
 * - mark_task_complete tool call → complete-task
 * - other tool call              → take-action
 * - plain text (reasoning)       → reasoning-thinking
 */
function routeAfterGenerateAction(state: ProgrammerState): string {
  const lastAI = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
    | AIMessage
    | undefined;

  if (lastAI?.tool_calls && lastAI.tool_calls.length > 0) {
    const toolName = lastAI.tool_calls[0]?.name;
    if (toolName === 'mark_task_complete') {
      console.log('  → routing to complete-task (mark_task_complete called)');
      return 'complete-task';
    }
    console.log(`  → routing to take-action (tool: ${toolName})`);
    return 'take-action';
  }

  // No tool call — model is reasoning/thinking
  console.log('  → routing to reasoning-thinking');
  return 'reasoning-thinking';
}

/**
 * Conditional edge from complete-task:
 * - If there are still incomplete tasks → generate-action
 * - If all tasks done → end-conclusion
 */
function routeAfterCompleteTask(state: ProgrammerState): string {
  const hasIncomplete = state.plan.some((t) => !t.completed);
  if (hasIncomplete) {
    console.log('  → more tasks remaining, back to generate-action');
    return 'generate-action';
  }
  console.log('  → all tasks done, going to end-conclusion');
  return 'end-conclusion';
}

const workflow = new StateGraph(ProgrammerStateAnnotation)
  .addNode('generate-action', generateActionNode)
  .addNode('take-action', takeActionNode)
  .addNode('complete-task', completeTaskNode)
  .addNode('reasoning-thinking', reasoningThinkingNode)
  .addNode('end-conclusion', endConclusionNode)
  // ── edges ──
  .addEdge(START, 'generate-action')
  .addConditionalEdges('generate-action', routeAfterGenerateAction, {
    'take-action': 'take-action',
    'complete-task': 'complete-task',
    'reasoning-thinking': 'reasoning-thinking',
  })
  // After executing a tool, loop back to generate-action
  .addEdge('take-action', 'generate-action')
  // After reasoning, loop back to generate-action
  .addEdge('reasoning-thinking', 'generate-action')
  // After completing a task, check if more remain
  .addConditionalEdges('complete-task', routeAfterCompleteTask, {
    'generate-action': 'generate-action',
    'end-conclusion': 'end-conclusion',
  })
  .addEdge('end-conclusion', END);

export const programmerGraph = workflow.compile();
programmerGraph.name = 'Programmer Agent — Execute Tasks';
