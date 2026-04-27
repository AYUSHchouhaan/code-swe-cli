import type { AIMessage } from '@langchain/core/messages';
import type { ProgrammerState } from '../types';

export async function reasoningThinkingNode(
  state: ProgrammerState
): Promise<Partial<ProgrammerState>> {

// empty node


  // console.log('\n=== PROGRAMMER NODE: reasoning-thinking ===');

  // const lastAI = [...state.messages].reverse().find((m) => m.getType() === 'ai') as
  //   | AIMessage
  //   | undefined;

  // if (lastAI) {
  //   const content =
  //     typeof lastAI.content === 'string'
  //       ? lastAI.content
  //       : JSON.stringify(lastAI.content, null, 2);
  //   // console.log('  [Model reasoning]:\n', content);
  // }

  return {};
}
