import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function truncateOutput(text: string, max = 8000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated]`;
}

export function createBashTool(repoPath: string) {
  return tool(
    async ({ command, timeoutMs }: { command: string; timeoutMs?: number }) => {
      if (process.platform !== 'win32') {
        return 'bash tool error: this minimal bash tool is Windows-only.';
      }

      const trimmed = command.trim();
      if (!trimmed) return 'bash tool error: command is empty.';

      const timeout = Math.max(1000, Math.min(timeoutMs ?? 12000, 60000));

      try {
        const { stdout, stderr } = await execFileAsync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', trimmed],
          {
            cwd: repoPath,
            timeout,
            maxBuffer: 10 * 1024 * 1024,
          }
        );

        const out = truncateOutput((stdout ?? '').trim());
        const err = truncateOutput((stderr ?? '').trim());

        if (!out && !err) return 'bash command completed with no output.';
        if (out && err) return `stdout:\n${out}\n\nstderr:\n${err}`;
        return out || `stderr:\n${err}`;
      } catch (error) {
        const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
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
        'Run a single command in the repository root using Windows PowerShell (powershell.exe). This tool is Windows-only and returns text output from stdout/stderr; long output is truncated.',
      schema: z.object({
        command: z.string().describe('PowerShell command to execute, for example "Get-ChildItem src" or "npm run build"'),
        timeoutMs: z.number().int().min(1000).max(60000).optional().describe('Optional execution timeout in milliseconds; clamped to 1000-60000. Default is 12000.'),
      }),
    }
  );
}
