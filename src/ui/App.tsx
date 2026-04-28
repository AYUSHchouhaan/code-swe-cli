import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { agentEvents } from './events';
import type { AgentEvent } from './events';

type Entry = AgentEvent & { id: number };

function Spinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <Text color="yellow">{frames[frame]!}</Text>;
}

function formatArgs(args: Record<string, unknown>): string {
  if (Array.isArray(args['patterns'])) return (args['patterns'] as string[]).join(', ');
  if (typeof args['query'] === 'string') return args['query'].slice(0, 80);
  if (Array.isArray(args['filePaths'])) return (args['filePaths'] as string[]).join(', ');
  if (typeof args['filePath'] === 'string') return args['filePath'];
  return JSON.stringify(args).slice(0, 80);
}

function LogLine({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case 'phase':
      return (
        <Box marginTop={1}>
          <Text bold>◆ {entry.phase}</Text>
        </Box>
      );
    case 'tool_call':
      return (
        <Box>
          <Text color="blue">  ↳ {entry.name} </Text>
          <Text dimColor>{formatArgs(entry.args)}</Text>
        </Box>
      );
    case 'tool_result':
      return (
        <Box>
          <Text color="green">  ← </Text>
          <Text dimColor>
            {entry.result.slice(0, 100)}
            {entry.result.length > 100 ? '…' : ''}
          </Text>
        </Box>
      );
    case 'llm_text':
      return (
        <Box paddingLeft={2}>
          <Text dimColor italic>
            {entry.text.slice(0, 140)}
            {entry.text.length > 140 ? '…' : ''}
          </Text>
        </Box>
      );
    case 'plan':
      return (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text bold>◆ plan</Text>
          {entry.steps.map(s => (
            <Box key={s.index} paddingLeft={2}>
              <Text dimColor>{s.index}. </Text>
              <Text>{s.plan}</Text>
            </Box>
          ))}
        </Box>
      );
    case 'task_start':
      return (
        <Box marginTop={1}>
          <Text bold color="cyan">▸ </Text>
          <Text dimColor>task {entry.index}/{entry.total} </Text>
          <Text>{entry.description}</Text>
        </Box>
      );
    case 'task_done':
      return (
        <Box>
          <Text color="green">  ✓ task {entry.index}</Text>
        </Box>
      );
    case 'done':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">✓ done</Text>
          <Text dimColor>{entry.summary}</Text>
        </Box>
      );
    case 'error':
      return (
        <Box>
          <Text color="red">✗ {entry.message}</Text>
        </Box>
      );
    default:
      return null;
  }
}

export function App({ task, repoPath }: { task: string; repoPath: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    let id = 0;
    const handler = (event: AgentEvent) => {
      if (event.type === 'thinking') {
        setThinking(true);
        return;
      }
      setThinking(false);
      setEntries(prev => [...prev, { ...event, id: id++ }]);
    };
    agentEvents.on('agent', handler);
    return () => { agentEvents.off('agent', handler); };
  }, []);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text bold color="cyan">code-swe </Text>
        <Text>{task}</Text>
      </Box>
      <Text dimColor>{repoPath}</Text>
      <Text> </Text>
      {entries.map(e => (
        <LogLine key={e.id} entry={e} />
      ))}
      {thinking && (
        <Box>
          <Spinner />
          <Text dimColor> thinking…</Text>
        </Box>
      )}
    </Box>
  );
}
