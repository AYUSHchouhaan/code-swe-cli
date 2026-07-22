import type { Record } from 'typescript';

export function compact(text: string, max = 200): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max) + '…';
}

export function formatArgs(args: Record<string, unknown>): string {
  // keep similar heuristics as before
  // @ts-ignore
  if (Array.isArray(args['patterns'])) return (args['patterns'] as string[]).join(', ');
  // @ts-ignore
  if (typeof args['query'] === 'string') return compact(args['query'] as string, 80);
  // @ts-ignore
  if (Array.isArray(args['filePaths'])) return (args['filePaths'] as string[]).join(', ');
  // @ts-ignore
  if (typeof args['filePath'] === 'string') return args['filePath'] as string;
  try {
    return compact(JSON.stringify(args), 80);
  } catch {
    return '';
  }
}

export function moveIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  const next = current + delta;
  if (next < 0) return total - 1;
  if (next >= total) return 0;
  return next;
}

export const TOOL_ICON: Record<string, string> = {
  glob:               '❯❯',
  grep:               '⌖ ',
  read:               '  ',
  edit:               '✎ ',
  create_file:        '+ ',
  bash:               '$ ',
  mark_task_complete: '✔ ',
};

export const TOOL_COLOR: Record<string, string> = {
  glob:               'blue',
  grep:               'cyan',
  read:               'white',
  edit:               'yellow',
  create_file:        'green',
  bash:               'magenta',
  mark_task_complete: 'green',
};
