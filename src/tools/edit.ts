import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

/**
 * Creates an edit tool that does string-replace on existing files only.
 * For creating new files, use the "create_file" tool instead.
 */
export function createEditTool(repoPath: string) {
  return tool(
    async ({
      filePath,
      oldString,
      newString,
    }: {
      filePath: string;
      oldString: string;
      newString: string;
    }) => {
      try {
        const fullPath = path.join(repoPath, filePath);

        if (!fs.existsSync(fullPath)) {
          return `Error: "${filePath}" does not exist. Use the "create_file" tool to create new files.`;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        if (!content.includes(oldString)) {
          return `Error: The oldString was not found in "${filePath}". Make sure it matches exactly.`;
        }
        const newContent = content.replace(oldString, newString);
        fs.writeFileSync(fullPath, newContent, 'utf-8');
        return `Successfully updated "${filePath}".`;
      } catch (error) {
        return `Error editing "${filePath}": ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    {
      name: 'edit',
      description:
        'Edit an EXISTING file by replacing oldString with newString. The file must already exist — use "create_file" for new files.',
      schema: z.object({
        filePath: z.string().describe('File path relative to the repo root'),
        oldString: z.string().describe('The exact string to replace (must exist in the file)'),
        newString: z.string().describe('The new string to insert in place of oldString'),
      }),
    }
  );
}
