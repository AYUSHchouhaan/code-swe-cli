#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { createElement } from 'react';
import { render } from 'ink';
import { App } from './ui/App';
import { emitAgent } from './ui/events';
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

    const { unmount } = render(createElement(App, { task, repoPath }));

    try {
      // ── Planning phase ─────────────────────────────────────
      emitAgent({ type: 'phase', phase: 'planning' });
      const plannerResult = await plannerGraph.invoke({
        query: task,
        repoPath,
        messages: [],
        plan: [],
        notes: '',
      });

      emitAgent({ type: 'plan', steps: plannerResult.plan });

      // ── Programming phase ───────────────────────────────────
      emitAgent({ type: 'phase', phase: 'programming' });

      const firstTask = plannerResult.plan[0];
      if (firstTask) {
        emitAgent({
          type: 'task_start',
          index: firstTask.index,
          total: plannerResult.plan.length,
          description: firstTask.plan,
        });
      }

      const programmerResult = await programmerGraph.invoke({
        query: task,
        repoPath,
        messages: [],
        plan: plannerResult.plan,
        notes: plannerResult.notes,
        taskActionsCount: 0,
        summary: '',
      });

      emitAgent({ type: 'done', summary: programmerResult.summary });
    } catch (err) {
      emitAgent({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }

    // Give ink a moment to render the final state
    await new Promise(r => setTimeout(r, 300));
    unmount();
    process.exit(0);
  });

program.parse(process.argv);

