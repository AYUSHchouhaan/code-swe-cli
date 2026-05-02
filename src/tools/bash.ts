import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const BLOCKED_PATTERNS: RegExp[] = [
  /(^|\s)rm\s+-rf\s+\//i,
  /(^|\s)mkfs(\.|\s)/i,
  /(^|\s)shutdown(\s|$)/i,
  /(^|\s)reboot(\s|$)/i,
  /(^|\s)poweroff(\s|$)/i,
  /(^|\s)halt(\s|$)/i,
  /(^|\s):\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*}\s*;/,
];

function truncateOutput(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated]`;
}

export function createBashTool(repoPath: string) {
  return tool(
    async ({ command, timeoutMs }: { command: string; timeoutMs?: number }) => {
      const trimmed = command.trim();
      if (!trimmed) return 'bash tool error: command is empty.';

      const isBlocked = BLOCKED_PATTERNS.some((p) => p.test(trimmed));
      if (isBlocked) {
        return 'bash tool blocked this command for safety.';
      }

      const timeout = Math.max(1000, Math.min(timeoutMs ?? 12000, 60000));

      try {
        const { stdout, stderr } = await execFileAsync(
          'bash',
          ['-lc', trimmed],
          {
            cwd: repoPath,
            timeout,
            maxBuffer: 10 * 1024 * 1024,
          }
        );

        const out = truncateOutput((stdout ?? '').trim());
        const err = truncateOutput((stderr ?? '').trim());

        if (!out && !err) {
          return 'bash command completed with no output.';
        }

        if (out && err) {
          return `stdout:\n${out}\n\nstderr:\n${err}`;
        }

        return out || `stderr:\n${err}`;
      } catch (error) {
        const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };

        if (err.code === 'ENOENT') {
          return 'bash tool error: "bash" is not installed or not on PATH.';
        }

        const stdout = truncateOutput(String(err.stdout ?? '').trim());
        const stderr = truncateOutput(String(err.stderr ?? '').trim());
        const details = [
          `bash command failed: ${err.message}`,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        return details;
      }
    },
    {
      name: 'bash',
      description:
        'Run a bash command in the repository root. Use for quick checks like listing files, running tests, or git status. Output is truncated for safety.',
      schema: z.object({
        command: z.string().describe('Bash command to run, e.g. "ls -la src" or "npm test -- --watch=false".'),
        timeoutMs: z.number().int().min(1000).max(60000).optional().describe('Optional timeout in milliseconds (1000 to 60000). Default is 12000.'),
      }),
    }
  );
}
