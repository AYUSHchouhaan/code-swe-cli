import { programmerGraph } from './programmer/index';

async function main() {
const repoPath = process.argv[2] ?? process.cwd();
const query = process.argv[3] ?? 'Analyze the codebase and suggest improvements.';

const programmerResult = await programmerGraph.invoke({
  query,
  repoPath,
  notes: '',
  messages: [],
  summary: '',
}, { recursionLimit: 100 });

}

main().catch(console.error);
