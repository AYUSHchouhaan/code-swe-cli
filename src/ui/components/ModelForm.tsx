import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  PROVIDER_LABELS,
  PROVIDER_MODEL_OPTIONS,
  DEFAULT_PROVIDER_MODELS,
  type ProviderId,
} from '../../config/provider';
import { moveIndex } from './helpers';

export function ModelForm({
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
  const modelItems = useMemo(() => (PROVIDER_MODEL_OPTIONS[provider] ?? [DEFAULT_PROVIDER_MODELS[provider]]), [provider]);
  const [modelIndex, setModelIndex] = useState(() => {
    const idx = modelItems.findIndex(model => model === currentModel);
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    const idx = modelItems.findIndex(model => model === currentModel);
    setModelIndex(idx >= 0 ? idx : 0);
  }, [modelItems, currentModel]);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setModelIndex(prev => moveIndex(prev, -1, modelItems.length));
      return;
    }

    if (key.downArrow) {
      setModelIndex(prev => moveIndex(prev, 1, modelItems.length));
      return;
    }

    if (key.return) {
      const selectedModel = modelItems[modelIndex] ?? currentModel;
      onSave(selectedModel);
    }
  });

  return (
    <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1}>
      <Text bold color="magenta">Model settings</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{PROVIDER_LABELS[provider]} model</Text>
        <Text dimColor>Current: {currentModel}</Text>
        {modelItems.map((model, index) => (
          <Box key={model}>
            <Text color={index === modelIndex ? 'magenta' : 'white'}>{index === modelIndex ? '> ' : '  '}</Text>
            <Text color={index === modelIndex ? 'magenta' : undefined}>{model}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
