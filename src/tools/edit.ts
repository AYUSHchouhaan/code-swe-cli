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
        'Edit an EXISTING file by applying a list of {oldStr, newStr} replacements in order. Each oldStr must match exactly (including whitespace). Use a single call with multiple edits instead of calling this tool repeatedly for the same file.',
      schema: z.object({
        filePath: z.string().describe('File path relative to the repo root'),
        edits: z.array(
            z.object({
              oldStr: z.string().describe('The exact string to replace (must exist in the file)'),
              newStr: z.string().describe('The replacement string'),
            })
          )
          .min(1)
          .describe('Ordered list of replacements to apply'),
      }),
    }
  );
}
