export type NewLine =
  | { kind: 'user_query'; text: string }
  | { kind: 'thinking' }
  | { kind: 'tool_call'; name: string; args: string }
  | { kind: 'tool_result'; name: string; result: string }
  | { kind: 'edit_message'; message: string }
  | { kind: 'edit_detail'; filePath: string; index: number; total: number; oldStr: string; newStr: string }
  | { kind: 'llm_text'; text: string }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string };

export type LogLine = NewLine & { id: number };
