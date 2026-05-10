import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { agentEvents } from './events';
import type { AgentEvent } from './events';

const SEP = '─'.repeat(64);

const TOOL_ICON: Record<string, string> = {
  glob:               '❯❯',
  grep:               '⌖ ',
  read:               '  ',
  edit:               '✎ ',
  create_file:        '+ ',
  bash:               '$ ',
  mark_task_complete: '✔ ',
};

const TOOL_COLOR: Record<string, string> = {
  glob:               'blue',
  grep:               'cyan',
  read:               'white',
  edit:               'yellow',
  create_file:        'green',
  bash:               'magenta',
  mark_task_complete: 'green',
};

function compact(text: string, max = 200): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max) + '…';
}

function formatArgs(args: Record<string, unknown>): string {
  if (Array.isArray(args['patterns'])) return (args['patterns'] as string[]).join(', ');
  if (typeof args['query'] === 'string') return compact(args['query'], 80);
  if (Array.isArray(args['filePaths'])) return (args['filePaths'] as string[]).join(', ');
  if (typeof args['filePath'] === 'string') return args['filePath'];
  return compact(JSON.stringify(args), 80);
}

type NewLine =
  | { kind: 'user_query'; text: string }
  | { kind: 'thinking' }
  | { kind: 'tool_call'; name: string; args: string }
  | { kind: 'tool_result'; name: string; result: string }
  | { kind: 'llm_text'; text: string }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string };

type LogLine = NewLine & { id: number };

function Line({ line }: { line: LogLine }) {
  switch (line.kind) {
    case 'user_query':
      return (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold color="cyan">▸ </Text>
            <Text bold color="white">{line.text}</Text>
          </Box>
        </Box>
      );

    case 'thinking':
      return (
        <Box paddingLeft={3}>
          <Text dimColor>· · ·</Text>
        </Box>
      );

    case 'tool_call': {
      const icon = TOOL_ICON[line.name] ?? '  ';
      const color = (TOOL_COLOR[line.name] ?? 'white') as any;
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color={color}>{icon} </Text>
          <Text bold color={color}>{line.name}</Text>
          <Text dimColor>  {line.args}</Text>
        </Box>
      );
    }

    case 'tool_result': {
      if (line.name === 'glob') {
        const rows = line.result.split('\n').filter(Boolean);
        // rows[0] is "Found N file(s) matching [...]:"
        const header = rows[0] ?? '';
        const files = rows.slice(1);
        return (
          <Box paddingLeft={5} flexDirection="column">
            <Text dimColor>{header}</Text>
            {files.map((f, i) => (
              <Box key={i}>
                <Text color="blue">{i === files.length - 1 ? '└─ ' : '├─ '}</Text>
                <Text>{f}</Text>
              </Box>
            ))}
          </Box>
        );
      }
      return (
        <Box paddingLeft={5}>
          <Text dimColor>{line.result}</Text>
        </Box>
      );
    }

    case 'llm_text':
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="magenta">◆ </Text>
          <Text dimColor>{line.text}</Text>
        </Box>
      );

    case 'done':
      return (
        <Box marginTop={1} flexDirection="column" paddingX={2} paddingY={0}>
          <Text bold color="green">✓  Done</Text>
          <Box marginTop={1}>
            <Text>{line.summary}</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box marginTop={1} borderStyle="round" borderColor="red" paddingX={2}>
          <Text color="red">✗  {line.message}</Text>
        </Box>
      );
  }
}

export function App({
  repoPath,
  onSubmit,
  onInterruptSubmit,
}: {
  repoPath: string;
  onSubmit: (query: string) => Promise<void>;
  onInterruptSubmit: (query: string) => Promise<void>;
}) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [confirmQuery, setConfirmQuery] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const runningRef = useRef(false);

  const setRunningSafe = (value: boolean) => {
    runningRef.current = value;
    setRunning(value);
  };

  const addLine = (line: NewLine) => {
    setLines(prev => {
      const id = prev.length;
      const next = [...prev, { ...line, id } as LogLine];
      return next.length > 200 ? next.slice(-200) : next;
    });
  };

  const startRun = (query: string, interrupt: boolean) => {
    const normalized = query.trim();
    if (!normalized) return;

    const runId = ++runIdRef.current;
    setInput('');
    setConfirmQuery(null);
    setRunningSafe(true);
    addLine({ kind: 'user_query', text: normalized });

    const runner = interrupt ? onInterruptSubmit : onSubmit;
    void runner(normalized).finally(() => {
      if (runIdRef.current === runId) {
        setRunningSafe(false);
      }
    });
  };

  useInput((char, key) => {
    if (confirmQuery) {
      const k = char.toLowerCase();
      if (k === 'c') {
        setConfirmQuery(null);
        return;
      }
      if (k === 'o') {
        startRun(confirmQuery, true);
        return;
      }
      if (key.escape) {
        setConfirmQuery(null);
      }
      return;
    }

    if (key.return) {
      const query = input.trim();
      if (!query) return;

      if (runningRef.current) {
        setConfirmQuery(query);
        return;
      }

      startRun(query, false);
      return;
    }

    if (key.escape) {
      exit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && char) {
      setInput(prev => prev + char);
    }
  });

  useEffect(() => {
    const handler = (event: AgentEvent) => {
      switch (event.type) {
        case 'thinking':
          // replace last thinking line if already present, else add
          setLines(prev => {
            const last = prev[prev.length - 1];
            if (last?.kind === 'thinking') return prev;
            return [...prev, { id: prev.length, kind: 'thinking' }];
          });
          break;
        case 'tool_call':
          addLine({ kind: 'tool_call', name: event.name, args: formatArgs(event.args) });
          break;
        case 'tool_result':
          addLine({ kind: 'tool_result', name: event.name, result: event.name === 'glob' ? event.result : compact(event.result, 200) });
          break;
        case 'llm_text':
          addLine({ kind: 'llm_text', text: compact(event.text, 200) });
          break;
        case 'done':
          addLine({ kind: 'done', summary: event.summary });
          break;
        case 'error':
          addLine({ kind: 'error', message: event.message });
          break;
        default:
          break;
      }
    };

    agentEvents.on('agent', handler);
    return () => { agentEvents.off('agent', handler); };
  }, []);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>

      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ code-swe  </Text>
        <Text dimColor>{repoPath}</Text>
      </Box>

      {/* Log */}
      <Box flexDirection="column" paddingLeft={1}>
        {lines.length > 0 ? (
          lines.map(l => <Line key={l.id} line={l} />)
        ) : (
          <Text dimColor>  Ask me anything about your codebase…</Text>
        )}
      </Box>

      {/* Interrupt confirm banner */}
      {confirmQuery && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={2}>
          <Text color="yellow">Agent running — press </Text>
          <Text bold color="green">c</Text>
          <Text color="yellow"> to keep current  or  </Text>
          <Text bold color="red">o</Text>
          <Text color="yellow"> to override with: </Text>
          <Text italic>{confirmQuery}</Text>
        </Box>
      )}

      {/* Input bar */}
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>{SEP}</Text>
        <Box marginTop={1}>
          <Text bold color="cyan">❯ </Text>
          {input.length > 0
            ? <><Text>{input}</Text><Text inverse> </Text></>
            : <Text dimColor>
                {running
                  ? 'agent running… type to queue next query  '
                  : 'type your query and press Enter  '}
                <Text color="cyan">(Esc to quit)</Text>
              </Text>
          }
        </Box>
        <Text dimColor>{SEP}</Text>
      </Box>

    </Box>
  );
}
