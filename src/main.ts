import { plannerGraph } from './planner/index';
import { programmerGraph } from './programmer/index';

async function main() {
const repoPath = process.argv[2] ?? process.cwd();
const query = process.argv[3] ?? 'Analyze the codebase and suggest improvements.';

console.log('=== SWE Agent ===');
console.log(`Repo : ${repoPath}`);
console.log(`Task : ${query}\n`);

// --- Planning phase ---
console.log('--- Planning phase ---');
const plannerResult = await plannerGraph.invoke({
  query,
  repoPath,
  messages: [],
  plan: [],
  notes: '',
});

console.log('\nPlan:');
for (const step of plannerResult.plan) {
  console.log(`  [${step.index}] ${step.plan}`);
}

// --- Programming phase ---
console.log('\n--- Programming phase ---');
const programmerResult = await programmerGraph.invoke({
  query,
  repoPath,
  messages: [],
  plan: plannerResult.plan,
  notes: plannerResult.notes,
  taskActionsCount: 0,
  summary: '',
});

console.log('\nSummary:');
console.log(programmerResult.summary);
}

main().catch(console.error);
