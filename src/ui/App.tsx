import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { agentEvents } from './events';
import type { AgentEvent } from './events';

const SEP = '─'.repeat(62);

function StatusBar({ running, confirmQuery }: { running: boolean; confirmQuery: string | null }) {
  if (confirmQuery) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{SEP}</Text>
        <Box>
          <Text backgroundColor="yellow" color="black"> [c] continue current </Text>
          <Text>  </Text>
          <Text backgroundColor="red" color="white"> [o] override with typed query </Text>
          <Text>  </Text>
          <Text backgroundColor="gray" color="black"> [Esc] cancel prompt </Text>
        </Box>
        <Text dimColor>{SEP}</Text>
      </Box>
    );
  }

  if (running) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{SEP}</Text>
        <Box>
          <Text backgroundColor="blue" color="white"> [Enter] choose continue/override </Text>
          <Text>  </Text>
          <Text backgroundColor="gray" color="black"> [Esc] quit </Text>
        </Box>
        <Text dimColor>{SEP}</Text>
      </Box>
    );
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>{SEP}</Text>
      <Box>
        <Text backgroundColor="green" color="black"> [Enter] submit query </Text>
        <Text>  </Text>
        <Text backgroundColor="gray" color="black"> [Esc] quit </Text>
      </Box>
      <Text dimColor>{SEP}</Text>
    </Box>
  );
}

function compact(text: string, max = 200): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max) + '…';
}

function formatArgs(args: Record<string, unknown>): string {
  if (Array.isArray(args['patterns'])) return (args['patterns'] as string[]).slice(0, 2).join(', ');
  if (typeof args['query'] === 'string') return compact(args['query'], 80);
  if (Array.isArray(args['filePaths'])) return (args['filePaths'] as string[]).slice(0, 2).join(', ');
  if (typeof args['filePath'] === 'string') return args['filePath'];
  return compact(JSON.stringify(args), 80);
}

function Spinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <Text color="yellow">{frames[frame]!}</Text>;
}

type NewLine =
  | { kind: 'user_query'; text: string }
  | { kind: 'thinking' }
  | { kind: 'tool_call'; name: string; args: string }
  | { kind: 'tool_result'; result: string }
  | { kind: 'llm_text'; text: string }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string };

type LogLine = NewLine & { id: number };

function Line({ line }: { line: LogLine }) {
  switch (line.kind) {
    case 'user_query':
      return (
        <Box>
          <Text color="cyan">you </Text>
          <Text>{line.text}</Text>
        </Box>
      );
    case 'thinking':
      return (
        <Box>
          <Spinner />
          <Text dimColor> thinking…</Text>
        </Box>
      );
    case 'tool_call':
      return (
        <Box>
          <Text color="blue">↳ {line.name} </Text>
          <Text dimColor>{line.args}</Text>
        </Box>
      );
    case 'tool_result':
      return (
        <Box>
          <Text color="green">← </Text>
          <Text dimColor>{line.result}</Text>
        </Box>
      );
    case 'llm_text':
      return (
        <Box>
          <Text color="yellow">ai </Text>
          <Text dimColor>{line.text}</Text>
        </Box>
      );
    case 'done':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">✓ done</Text>
          <Text dimColor>{line.summary}</Text>
        </Box>
      );
    case 'error':
      return (
        <Box>
          <Text color="red">✗ {line.message}</Text>
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
    setRunning(true);
    setLines([]);
    addLine({ kind: 'user_query', text: normalized });

    const runner = interrupt ? onInterruptSubmit : onSubmit;
    void runner(normalized).finally(() => {
      if (runIdRef.current === runId) {
        setRunning(false);
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

      if (running) {
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
          addLine({ kind: 'tool_result', result: compact(event.result, 200) });
          break;
        case 'llm_text':
          addLine({ kind: 'llm_text', text: compact(event.text, 200) });
          break;
        case 'done':
          addLine({ kind: 'done', summary: compact(event.summary, 400) });
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
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box>
        <Text bold color="cyan">code-swe  </Text>
        <Text dimColor>{repoPath}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{SEP}</Text>
        <Box>
          <Text bold color="cyan">❯ </Text>
          {input.length > 0
            ? <><Text>{input}</Text><Text inverse> </Text></>
            : <>
                <Text dimColor>
                  {running ? 'running… type next query and press ' : 'type your query and press '}
                </Text>
                <Text color="cyan">Enter</Text>
                <Text dimColor>{running ? ' to choose continue/override  (Esc to quit)' : '  (Esc to quit)'}</Text>
              </>
          }
        </Box>
        <Text dimColor>{SEP}</Text>
      </Box>

      <StatusBar running={running} confirmQuery={confirmQuery} />

      {confirmQuery && (
        <Box marginTop={1}>
          <Text color="yellow">Current run is active. Press </Text>
          <Text bold color="green">c</Text>
          <Text color="yellow"> to continue current or </Text>
          <Text bold color="red">o</Text>
          <Text color="yellow"> to stop and start: {confirmQuery}</Text>
        </Box>
      )}

      {lines.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {lines.map(l => <Line key={l.id} line={l} />)}
        </Box>
      )}
    </Box>
  );
}
