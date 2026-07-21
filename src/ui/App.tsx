import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { agentEvents } from './events';
import type { AgentEvent } from './events';
import {
  DEFAULT_PROVIDER_MODELS,
  PROVIDER_LABELS,
  PROVIDER_MODEL_OPTIONS,
  type ProviderId,
  type ProviderRuntimeConfig,
} from '../config/provider';

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
  | { kind: 'edit_message'; message: string }
  | { kind: 'edit_detail'; filePath: string; index: number; total: number; oldStr: string; newStr: string }
  | { kind: 'llm_text'; text: string }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string };

type LogLine = NewLine & { id: number };

type ProviderChoice = {
  label: string;
  value: ProviderId;
};

type ModelChoice = {
  label: string;
  value: string;
};

function getProviderItems(): ProviderChoice[] {
  return (Object.keys(PROVIDER_LABELS) as ProviderId[]).map((provider) => ({
    label: PROVIDER_LABELS[provider],
    value: provider,
  }));
}

function getModelItems(provider: ProviderId): ModelChoice[] {
  const options = PROVIDER_MODEL_OPTIONS[provider] ?? [DEFAULT_PROVIDER_MODELS[provider]];
  return options.map((model) => ({ label: model, value: model }));
}

function ProviderForm({
  initialConfig,
  onCancel,
  onSave,
}: {
  initialConfig: ProviderRuntimeConfig;
  onCancel: () => void;
  onSave: (config: ProviderRuntimeConfig) => void;
}) {
  const [step, setStep] = useState<'provider' | 'key'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(initialConfig.selectedProvider);
  const [apiKey, setApiKey] = useState(initialConfig.providers[initialConfig.selectedProvider].apiKey);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const providerItems = useMemo(() => getProviderItems(), []);

  const handleProviderSelect = (item: ProviderChoice) => {
    const nextProvider = item.value;
    setSelectedProvider(nextProvider);
    setApiKey(initialConfig.providers[nextProvider].apiKey);
    setStep('key');
  };

  const commit = () => {
    const nextConfig: ProviderRuntimeConfig = {
      ...initialConfig,
      selectedProvider,
      providers: {
        ...initialConfig.providers,
        [selectedProvider]: {
          ...initialConfig.providers[selectedProvider],
          apiKey,
        },
      },
    };
    onSave(nextConfig);
  };

  return (
    <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="cyan">Provider settings</Text>
      {step === 'provider' ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Choose the chat provider, then enter its API key.</Text>
          <SelectInput items={providerItems} onSelect={handleProviderSelect} />
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{PROVIDER_LABELS[selectedProvider]} API key</Text>
          <TextInput
            value={apiKey}
            mask="*"
            onChange={setApiKey}
            onSubmit={commit}
          />
          <Box marginTop={1}>
            <Text dimColor>Press Enter to save, Esc to cancel.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function ModelForm({
  provider,
  currentModel,
  onCancel,
  onSave,
}: {
  provider: ProviderId;
  currentModel: string;
  onCancel: () => void;
  onSave: (model: string) => void;
}) {
  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const modelItems = useMemo(() => getModelItems(provider), [provider]);

  const handleModelSelect = (item: ModelChoice) => {
    onSave(item.value);
  };

  return (
    <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1}>
      <Text bold color="magenta">Model settings</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{PROVIDER_LABELS[provider]} model</Text>
        <Text dimColor>Current: {currentModel}</Text>
        <SelectInput items={modelItems} onSelect={handleModelSelect} />
      </Box>
    </Box>
  );
}

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

    case 'edit_message':
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="yellow">📝 </Text>
          <Text color="yellow">{compact(line.message, 150)}</Text>
        </Box>
      );

    case 'edit_detail':
      return (
        <Box paddingLeft={5} flexDirection="column">
          <Box>
            <Text dimColor>[{line.index}/{line.total}] </Text>
            <Text color="yellow">{line.filePath}</Text>
          </Box>
          <Box marginTop={0} paddingLeft={2} flexDirection="column">
            <Text color="red">- {line.oldStr}</Text>
          </Box>
          <Box marginTop={0} paddingLeft={2} flexDirection="column">
            <Text color="green">+ {line.newStr}</Text>
          </Box>
        </Box>
      );

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
    if (showProviderForm || showModelForm) {
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

  const footerHint = running
    ? 'agent running… type to queue next query'
    : 'type your query and press Enter';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>

      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ code-swe  </Text>
        <Text dimColor>{repoPath}</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">Chat provider: </Text>
          <Text>{PROVIDER_LABELS[activeProvider]}</Text>
          <Text dimColor>  |  </Text>
          <Text bold color="cyan">Model: </Text>
          <Text>{activeModel}</Text>
        </Box>
        <Box>
          <Text dimColor>/provider provider/key  </Text>
          <Text dimColor>/model model  </Text>
          <Text dimColor>Esc/interrupt</Text>
        </Box>
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
          <TextInput value={input} onChange={setInput} onSubmit={(query: string) => {
            handleQuerySubmit(query);
          }} />
          {input.length === 0 && (
            <Text dimColor>  {footerHint}  <Text color="cyan">(/provider /model)</Text></Text>
          )}
        </Box>
        <Text dimColor>{SEP}</Text>
      </Box>

    </Box>
  );
}
