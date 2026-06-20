import { EventEmitter } from 'events';

export type AgentEvent =
  | { type: 'phase'; phase: 'planning' | 'programming' }
  | { type: 'thinking' }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'llm_text'; text: string }
  | { type: 'plan'; steps: Array<{ index: number; plan: string }> }
  | { type: 'task_start'; index: number; total: number; description: string }
  | { type: 'task_done'; index: number }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string };

class AgentEmitter extends EventEmitter {}
export const agentEvents = new AgentEmitter();

export function emitAgent(event: AgentEvent): void {
  agentEvents.emit('agent', event);
}
  