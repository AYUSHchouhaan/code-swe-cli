import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { PlannerState, PlanStep } from '../types';

const planSchema = z.object({
  steps: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('Ordered list of implementation steps as plain strings'),
});

/**
 * Node: generate-plan
 *
 * Converts accumulated context messages into a minimal, actionable plan
 * (at most 6 steps) for the programmer agent to execute.
 */
export async function generatePlanNode(
  state: PlannerState
): Promise<Partial<PlannerState>> {
  console.log('\n=== PLANNER NODE: generate-plan ===');

  const llm = new ChatOllama({
    model: 'qwen3-coder:480b-cloud',
    temperature: 0,
    baseUrl: 'http://localhost:11434',
    format: 'json',
    numCtx: 131072,
    numPredict: 8192,
  }).withStructuredOutput(planSchema);

  // Google Gemini alternative — comment out Ollama above and uncomment below
  // const llm = new ChatGoogleGenerativeAI({
  //   model: 'gemini-2.5-pro-exp-03-25',
  //   apiKey: process.env.GOOGLE_API_KEY,
  //   temperature: 0,
  // }).withStructuredOutput(planSchema);

  const contextSummary = state.messages
    .map((m) => {
      const type = m.getType();
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `[${type.toUpperCase()}]: ${content}`;
    })
    .join('\n\n');

  const result = await llm.invoke([
    new SystemMessage(
      `You are a senior software engineer creating a concrete, implementation-only plan.

CRITICAL: You MUST respond with valid JSON in this exact format:
{
  "steps": [
    "First implementation step here",
    "Second implementation step here",
    "Third implementation step here"
  ]
}

Rules:
1. Maximum 5 steps — keep it focused and actionable.
2. Each step must be a CONCRETE CODE CHANGE — never a research step like "search for files" or "read config".
3. Steps must be in logical execution order (e.g., schema → backend logic → API → frontend).
4. Be specific about WHAT to create/modify and WHERE (mention file paths when known from context).
5. The programmer agent will handle finding and reading files on its own — your plan should only describe the actual implementation work.

Example JSON output for "add user dashboard with activity log":
{
  "steps": [
    "Add activity_log table schema to the database migrations file",
    "Write backend query functions to insert and fetch activity logs",
    "Create API endpoint GET /api/activity to return user activity data",
    "Build ActivityDashboard React component to display activity log",
    "Add route and navigation link for the dashboard page"
  ]
}

BAD steps (do NOT generate these):
- "Search for database files" ← research, not implementation
- "Read the current auth setup" ← research, not implementation
- "Understand the project structure" ← research, not implementation`
    ),
    new HumanMessage(
      `User Query: "${state.query}"

Gathered Context:
${contextSummary}

Create a concrete implementation plan (maximum 5 steps). Output valid JSON only.`
    ),
  ]);

  const steps: PlanStep[] = result.steps.map((plan, i) => ({
    index: i + 1,
    plan,
    completed: false,
  }));
  steps.forEach((s) => console.log(`  ${s.index}. ${s.plan}`));

  return { plan: steps };
}
