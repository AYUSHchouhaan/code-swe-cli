import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { agentEvents } from './events';
import type { AgentEvent } from './events';
import { PROVIDER_LABELS } from '../config/provider';
import type { ProviderRuntimeConfig } from '../config/provider';
import ProviderForm from './components/ProviderForm';
import { ModelForm } from './components/ModelForm';
import Line from './components/Line';
import { compact, formatArgs } from './components/helpers';
import type { NewLine, LogLine } from './components/types';

const SEP = '─'.repeat(64);
const API_KEY_FIELD_WIDTH = 42;

// componentized: ProviderForm, ModelForm, Line are in ./components

export function App({
  repoPath,
  initialProviderConfig,
  onSaveProviderConfig,
  onSubmit,
  onInterruptSubmit,
  onAbortCurrent,
}: {
  repoPath: string;
  initialProviderConfig: ProviderRuntimeConfig;
  onSaveProviderConfig: (config: ProviderRuntimeConfig) => Promise<void>;
  onSubmit: (query: string, config: ProviderRuntimeConfig) => Promise<void>;
  onInterruptSubmit: (query: string, config: ProviderRuntimeConfig) => Promise<void>;
  onAbortCurrent: () => void;
}) {
  const [input, setInput] = useState('');
  const [providerConfig, setProviderConfig] = useState(initialProviderConfig);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [confirmQuery, setConfirmQuery] = useState<string | null>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const isFormOpen = showProviderForm || showModelForm;

  const activeProvider = providerConfig.selectedProvider;
  const activeModel = providerConfig.providers[activeProvider].model;

  const setRunningSafe = (value: boolean) => {
    runningRef.current = value;
    setRunning(value);
  };

  const addLine = (line: NewLine) => {
    setLines(prev => {
      const id = prev.length;
      return [...prev, { ...line, id } as LogLine];
    });
  };

  const updateProviderConfig = async (nextConfig: ProviderRuntimeConfig) => {
    setProviderConfig(nextConfig);
    await onSaveProviderConfig(nextConfig);
  };

  const handleQuerySubmit = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    const command = normalized.toLowerCase();
    if (command === '/provider') {
      setInput('');
      setConfirmQuery(null);
      setShowModelForm(false);
      setShowProviderForm(true);
      return;
    }

    if (command === '/model') {
      setInput('');
      setConfirmQuery(null);
      setShowProviderForm(false);
      setShowModelForm(true);
      return;
    }

    if (runningRef.current) {
      setConfirmQuery(normalized);
      setInput('');
      return;
    }

    startRun(normalized, false);
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
    void runner(normalized, providerConfig).finally(() => {
      if (runIdRef.current === runId) {
        setRunningSafe(false);
      }
    });
  };

  useInput((char, key) => {
    if (isFormOpen) {
      if (key.escape) {
        setShowProviderForm(false);
        setShowModelForm(false);
      }
      return;
    }

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

      handleQuerySubmit(query);
      return;
    }

    if (key.escape) {
      if (runningRef.current) {
        setInput('');
        onAbortCurrent();
        return;
      }

      if (input.length > 0) {
        setInput('');
      }
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
        case 'edit_message':
          addLine({ kind: 'edit_message', message: event.message });
          break;
        case 'edit_detail':
          addLine({ kind: 'edit_detail', filePath: event.filePath, index: event.index, total: event.total, oldStr: event.oldStr, newStr: event.newStr });
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

  // const footerHint = running
    // ? 'agent running… press c to keep current or o to start the next query'
    // : 'type your query and press Enter';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>

      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ code-swe  </Text>
        <Text dimColor>{repoPath}</Text>
      </Box>

      {/* Log */}
      {lines.length > 0 ? (
        <Static items={lines}>
          {(line) => <Line key={line.id} line={line} />}
        </Static>
      ) : (
        <Box paddingLeft={1}>
          <Text dimColor>  Ask me anything about your codebase…</Text>
        </Box>
      )}

      {showProviderForm && (
        <ProviderForm
          initialConfig={providerConfig}
          onCancel={() => setShowProviderForm(false)}
          onSave={async (nextConfig) => {
            await updateProviderConfig(nextConfig);
            setShowProviderForm(false);
          }}
        />
      )}

      {showModelForm && (
        <ModelForm
          provider={activeProvider}
          currentModel={activeModel}
          onCancel={() => setShowModelForm(false)}
          onSave={async (nextModel) => {
            const nextConfig: ProviderRuntimeConfig = {
              ...providerConfig,
              providers: {
                ...providerConfig.providers,
                [activeProvider]: {
                  ...providerConfig.providers[activeProvider],
                  model: nextModel,
                },
              },
            };
            await updateProviderConfig(nextConfig);
            setShowModelForm(false);
          }}
        />
      )}

      {/* Interrupt confirm banner */}
      {/* {confirmQuery && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={2}>
          <Text color="yellow">Agent running — press </Text>
          <Text bold color="green">c</Text>
          <Text color="yellow"> to keep current  or  </Text>
          <Text bold color="red">o</Text>
          <Text color="yellow"> to stop the current run and start the next query.</Text>
        </Box>
      )} */}

      {!isFormOpen && (
        <Box marginTop={2} flexDirection="column">
          <Text dimColor>{SEP}</Text>
          <Box marginTop={1}>
            <Text bold color="cyan">❯ </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={(query: string) => {
                handleQuerySubmit(query);
              }}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Chat provider: </Text>
            <Text>{PROVIDER_LABELS[activeProvider]}</Text>
            <Text dimColor>  |  </Text>
            <Text dimColor>Model: </Text>
            <Text>{activeModel}</Text>
          </Box>
          <Box marginTop={1}>
            <Box marginRight={2}>
              <Text color="cyan">/provider change provider</Text>
            </Box>
            <Box marginRight={2}>
              <Text color="magenta">/model change model</Text>
            </Box>
            <Box>
              <Text color="yellow">Esc/interrupt</Text>
            </Box>
          </Box>
          <Text dimColor>{SEP}</Text>
        </Box>
      )}

    </Box>
  );
}
