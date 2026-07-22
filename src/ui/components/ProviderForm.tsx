import { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  DEFAULT_PROVIDER_MODELS,
  PROVIDER_LABELS,
  type ProviderId,
  type ProviderRuntimeConfig,
} from '../../config/provider';
import { moveIndex } from './helpers';

export default function ProviderForm({
  initialConfig,
  onCancel,
  onSave,
}: {
  initialConfig: ProviderRuntimeConfig;
  onCancel: () => void;
  onSave: (config: ProviderRuntimeConfig) => void;
}) {
  const providerItems = useMemo(() => (Object.keys(PROVIDER_LABELS) as ProviderId[]), []);
  const [step, setStep] = useState<'provider' | 'key'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(initialConfig.selectedProvider);
  const [apiKey, setApiKey] = useState(initialConfig.providers[initialConfig.selectedProvider].apiKey);
  const [providerIndex, setProviderIndex] = useState(() => {
    const idx = providerItems.findIndex(p => p === initialConfig.selectedProvider);
    return idx >= 0 ? idx : 0;
  });

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

  useInput((char, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === 'provider') {
      if (key.upArrow) {
        setProviderIndex(prev => moveIndex(prev, -1, providerItems.length));
        return;
      }
      if (key.downArrow) {
        setProviderIndex(prev => moveIndex(prev, 1, providerItems.length));
        return;
      }
      if (key.return) {
        const nextProvider = providerItems[providerIndex] ?? initialConfig.selectedProvider;
        setSelectedProvider(nextProvider);
        setApiKey(initialConfig.providers[nextProvider].apiKey);
        setStep('key');
      }
      return;
    }

    if (key.return) {
      commit();
      return;
    }
  });

  return (
    <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="cyan">Provider settings</Text>
      {step === 'provider' ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Choose the chat provider, then enter its API key.</Text>
          {providerItems.map((provider, index) => (
            <Box key={provider}>
              <Text color={index === providerIndex ? 'cyan' : 'white'}>{index === providerIndex ? '> ' : '  '}</Text>
              <Text color={index === providerIndex ? 'cyan' : undefined}>{PROVIDER_LABELS[provider]}</Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{PROVIDER_LABELS[selectedProvider]} API key</Text>
          <Box marginTop={1}>
            <Text color="cyan">▸ </Text>
            <TextInput
              value={apiKey}
              placeholder="type key here"
              mask="*"
              onChange={setApiKey}
              onSubmit={commit}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to save, Esc to cancel.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
