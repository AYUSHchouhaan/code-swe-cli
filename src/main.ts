import { programmerGraph } from './programmer/index';

async function main() {
const repoPath = process.argv[2] ?? process.cwd();
const query = process.argv[3] ?? 'Analyze the codebase and suggest improvements.';

console.log('=== SWE Agent ===');
console.log(`Repo : ${repoPath}`);
console.log(`Task : ${query}\n`);

// --- Programming phase ---
console.log('--- Programming phase ---');

const programmerResult = await programmerGraph.invoke({
  query,
  repoPath,
  notes: '',
  messages: [],
  taskActionsCount: 0,
  summary: '',
});

console.log('\nSummary:');
console.log(programmerResult.summary);
}

main().catch(console.error);
