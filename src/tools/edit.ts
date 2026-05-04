import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

/**
 * Creates an edit tool that applies one or more string-replacements on an existing file.
 * For creating new files, use the "create_file" tool instead.
 */
export function createEditTool(repoPath: string) {
  return tool(
    async ({
      filePath,
      edits,
    }: {
      filePath: string;
      edits: Array<{ oldStr: string; newStr: string }>;
    }) => {
      try {
        const fullPath = path.join(repoPath, filePath);

        if (!fs.existsSync(fullPath)) {
          return `Error: "${filePath}" does not exist. Use the "create_file" tool to create new files.`;
        }

        let content = fs.readFileSync(fullPath, 'utf-8');

        for (let i = 0; i < edits.length; i++) {
          const edit = edits[i];
          if (!edit) continue;
          const { oldStr, newStr } = edit;

          if (!content.includes(oldStr)) {
            return `Error: edits[${i}] oldStr was not found in "${filePath}". Make sure it matches exactly (including whitespace and indentation).`;
          }

          content = content.replace(oldStr, newStr);
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        return `Successfully applied ${edits.length} edit(s) to "${filePath}".`;
      } catch (error) {
        return `Error editing "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    {
      name: 'edit',
      description:
        'Edit one existing file by applying an ordered list of {oldStr, newStr} replacements. For each item, oldStr must match exactly (including whitespace), and only the first match is replaced. If any oldStr is missing, the tool stops and returns an error.',
      schema: z.object({
        filePath: z.string().describe('Path to an existing file, relative to the repository root'),
        edits: z.array(
            z.object({
              oldStr: z.string().describe('Exact text to find in the current file content (case and whitespace sensitive)'),
              newStr: z.string().describe('Text to replace the first matched oldStr occurrence'),
            })
          )
          .min(1)
          .describe('Ordered replacements applied sequentially to the same file'),
      }),
    }
  );
}
