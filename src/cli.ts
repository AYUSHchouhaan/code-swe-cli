#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { plannerGraph } from './planner/index';
import { programmerGraph } from './programmer/index';

const program = new Command();

program
  .name('code-swe')
  .description('Agentic coding assistant — run it inside any project folder')
  .version('1.0.0');

program
  .command('run <task>')
  .description('Run the coding agent on the current directory (or --path)')
  .option('-p, --path <dir>', 'Path to the project (defaults to cwd)', process.cwd())
  .action(async (task: string, options: { path: string }) => {
    const repoPath = path.resolve(options.path);

    console.log('\n=== SWE Agent ===');
    console.log(`Repo : ${repoPath}`);
    console.log(`Task : ${task}\n`);

    // ── Planning phase ──────────────────────────────────────
    console.log('--- Planning phase ---');
    let plannerResult;
    try {
      plannerResult = await plannerGraph.invoke({
        query: task,
        repoPath,
        messages: [],
        plan: [],
        notes: '',
      });
    } catch (err) {
      console.error('Planner failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }

    console.log('\nPlan:');
    for (const step of plannerResult.plan) {
      console.log(`  [${step.index}] ${step.plan}`);
    }

    // ── Programming phase ────────────────────────────────────
    console.log('\n--- Programming phase ---');
    let programmerResult;
    try {
      programmerResult = await programmerGraph.invoke({
        query: task,
        repoPath,
        messages: [],
        plan: plannerResult.plan,
        notes: plannerResult.notes,
        taskActionsCount: 0,
        summary: '',
      });
    } catch (err) {
      console.error('Programmer failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }

    console.log('\n=== Done ===');
    console.log(programmerResult.summary);
  });

program.parse(process.argv);
