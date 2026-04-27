import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export interface PlanStep {
  index: number;
  plan: string;
  completed: boolean;
}

export const PlannerStateAnnotation = Annotation.Root({
  /** The user's original query */
  query: Annotation<string>,

  /** Absolute path to the repo on disk */
  repoPath: Annotation<string>,

  /**
   * Conversation messages: HumanMessage, AIMessage, ToolMessage
   * Reducer appends new messages to the array.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** The final implementation plan produced by generate-plan node */
  plan: Annotation<PlanStep[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  /**
   * Short summary / context notes produced by the notes node.
   * Passed downstream to the programmer agent.
   */
  notes: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
});

export type PlannerState = typeof PlannerStateAnnotation.State;
