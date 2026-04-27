import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function createGlobTool(repoPath: string) {
  return tool(
    async ({ patterns }: { patterns: string[] }) => {
      // Build include-glob args from the user-provided patterns
      const includeGlobs = patterns.flatMap((p) => ['--glob', p]);

      try {
        const { stdout } = await execFileAsync(
          'rg',
          [
            '--files',
            // Always exclude noisy dirs
            '--glob', '!node_modules',
            '--glob', '!node_modules/**',
            '--glob', '!.git',
            '--glob', '!.git/**',
            '--glob', '!.next',
            '--glob', '!.next/**',
            '--glob', '!dist',
            '--glob', '!dist/**',
            '--glob', '!build',
            '--glob', '!build/**',
            '--glob', '!.turbo',
            '--glob', '!.vercel',
            '--glob', '!.cache',
            // User patterns (include filters)
            ...includeGlobs,
            '.',
          ],
          { maxBuffer: 10 * 1024 * 1024, cwd: repoPath }
        );

        const files = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((f) => f.replace(/\\/g, '/').replace(/^\.\//,  ''));

        if (files.length === 0) {
          return `No files found matching: ${patterns.join(', ')}`;
        }

        return `Found ${files.length} file(s) matching [${patterns.join(', ')}]:\n${files.join('\n')}`;
      } catch (err: any) {
        // rg exits with code 1 when no files match — not an error
        if (err.code === 1) {
          return `No files found matching: ${patterns.join(', ')}`;
        }
        return `glob tool error: ${err.message ?? String(err)}`;
      }
    },
    {
      name: 'glob',
      description:
        'Find files by path pattern. Provide up to 7 glob patterns such as "**/src/**/*.ts" or "**/*.js" to locate files without reading their contents. Returns a list of matching file paths relative to the repo root.',
      schema: z.object({
        patterns: z
          .array(z.string())
          .min(1)
          .max(7)
          .describe(
            'Up to 7 glob patterns. Always use **/ prefix for directory names, e.g. ["**/src/**/*.ts", "**/components/**/*.tsx", "**/*.js"]. Use ** for recursive matching at any depth.'
          ),
      }),
    }
  );
}
