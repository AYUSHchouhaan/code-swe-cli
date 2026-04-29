import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const ProgrammerStateAnnotation = Annotation.Root({
  /** The user's original query */
  query: Annotation<string>,

  /** Absolute path to the repo on disk */
  repoPath: Annotation<string>,

  /** Optional execution notes/context to guide implementation */
  notes: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  /**
   * Internal conversation messages — the main context.
   * HumanMessage, AIMessage (with tool_calls), ToolMessage flow.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** Summary produced by end-conclusion node */
  summary: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  /**
   * Counts how many tool calls (take-action executions) have run for the
   * current task. Incremented by take-action, reset to 0 by complete-task.
   */
  taskActionsCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
});

export type ProgrammerState = typeof ProgrammerStateAnnotation.State;
