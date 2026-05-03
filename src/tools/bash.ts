import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

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

type Runner = {
  exe: string;
  args: string[];
  label: 'bash' | 'powershell';
};

function getCommandRunners(command: string): Runner[] {
  if (process.platform !== 'win32') {
    return [{ exe: 'bash', args: ['-lc', command], label: 'bash' }];
  }

  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const gitBashCandidates = [
    path.join(programFiles, 'Git', 'bin', 'bash.exe'),
    path.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
    path.join(programFilesX86, 'Git', 'bin', 'bash.exe'),
    path.join(programFilesX86, 'Git', 'usr', 'bin', 'bash.exe'),
  ];

  const runners: Runner[] = [{ exe: 'bash', args: ['-lc', command], label: 'bash' }];
  for (const candidate of gitBashCandidates) {
    runners.push({ exe: candidate, args: ['-lc', command], label: 'bash' });
  }
  runners.push({ exe: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', command], label: 'powershell' });
  return runners;
}

function isMissingBashError(error: NodeJS.ErrnoException): boolean {
  if (error.code === 'ENOENT') return true;
  const message = `${error.message ?? ''}\n${String((error as { stderr?: string }).stderr ?? '')}`.toLowerCase();
  return message.includes('execvpe(/bin/bash) failed') || message.includes('no such file or directory');
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
      const runners = getCommandRunners(trimmed);
      let lastError: (NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string }) | null = null;

      for (const runner of runners) {
        try {
          const { stdout, stderr } = await execFileAsync(
            runner.exe,
            runner.args,
            {
              cwd: repoPath,
              timeout,
              maxBuffer: 10 * 1024 * 1024,
            }
          );

          const out = truncateOutput((stdout ?? '').trim());
          const err = truncateOutput((stderr ?? '').trim());
          const prefix = runner.label === 'powershell' ? '[fallback: powershell]\n' : '';

          if (!out && !err) {
            return `${prefix}bash command completed with no output.`;
          }

          if (out && err) {
            return `${prefix}stdout:\n${out}\n\nstderr:\n${err}`;
          }

          return `${prefix}${out || `stderr:\n${err}`}`;
        } catch (error) {
          const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
          lastError = err;

          if (process.platform === 'win32' && runner.label === 'bash' && isMissingBashError(err)) {
            continue;
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
      }

      if (lastError && process.platform === 'win32' && isMissingBashError(lastError)) {
        return 'bash tool error: no working bash runtime found (checked PATH and Git Bash locations), and PowerShell fallback was unavailable.';
      }

      if (lastError?.code === 'ENOENT') {
        return 'bash tool error: "bash" is not installed or not on PATH.';
      }

      if (lastError) {
        const stdout = truncateOutput(String(lastError.stdout ?? '').trim());
        const stderr = truncateOutput(String(lastError.stderr ?? '').trim());
        const details = [
          `bash command failed: ${lastError.message}`,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        return details;
      }

      return 'bash tool error: command failed for an unknown reason.';
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
