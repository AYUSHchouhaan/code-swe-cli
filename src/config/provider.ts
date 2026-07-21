import fs from 'fs/promises';
import path from 'path';
import { parse } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export type ProviderId = 'openai' | 'anthropic' | 'google';

export type ProviderModelConfig = {
  provider: ProviderId;
  apiKey: string;
  model: string;
};

export type ProviderRuntimeConfig = {
  selectedProvider: ProviderId;
  providers: Record<ProviderId, { apiKey: string; model: string }>;
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
};

export const PROVIDER_ENV_KEYS: Record<ProviderId, { apiKey: string; model: string }> = {
  openai: { apiKey: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
  anthropic: { apiKey: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
  google: { apiKey: 'GOOGLE_API_KEY', model: 'GOOGLE_MODEL' },
};

export const DEFAULT_PROVIDER_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-5-mini',
  anthropic: 'haiku 4.5',
  google: 'gemini 1.5 flash',
};

export const PROVIDER_MODEL_OPTIONS: Record<ProviderId, string[]> = {
  openai: ['gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini'],
  anthropic: ['haiku 4.5', 'sonnet 4.5', 'opus 4.1'],
  google: ['gemini 1.5 flash', 'gemini 2.0 flash', 'gemini 2.5 pro'],
};

export function resolveProviderConfigPath(repoPath: string): string {
  return path.join(repoPath, '.env.code-swe-agent');
}

export function normalizeProviderConfig(input?: Partial<ProviderRuntimeConfig>): ProviderRuntimeConfig {
  const selectedProvider = input?.selectedProvider ?? 'openai';
  return {
    selectedProvider,
    providers: {
      openai: {
        apiKey: input?.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY ?? '',
        model: input?.providers?.openai?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_PROVIDER_MODELS.openai,
      },
      anthropic: {
        apiKey: input?.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
        model: input?.providers?.anthropic?.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_PROVIDER_MODELS.anthropic,
      },
      google: {
        apiKey: input?.providers?.google?.apiKey ?? process.env.GOOGLE_API_KEY ?? '',
        model: input?.providers?.google?.model ?? process.env.GOOGLE_MODEL ?? DEFAULT_PROVIDER_MODELS.google,
      },
    },
  };
}

export function createProviderSelection(provider: ProviderId, config: ProviderRuntimeConfig): ProviderModelConfig {
  const selected = config.providers[provider];
  return {
    provider,
    apiKey: selected.apiKey,
    model: selected.model || DEFAULT_PROVIDER_MODELS[provider],
  };
}

export async function readProviderConfig(repoPath: string): Promise<ProviderRuntimeConfig> {
  const filePath = resolveProviderConfigPath(repoPath);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = parse(raw);
    return normalizeProviderConfig({
      selectedProvider: (parsed.CODE_SWE_PROVIDER as ProviderId) ?? undefined,
      providers: {
        openai: {
          apiKey: parsed.OPENAI_API_KEY ?? '',
          model: parsed.OPENAI_MODEL ?? '',
        },
        anthropic: {
          apiKey: parsed.ANTHROPIC_API_KEY ?? '',
          model: parsed.ANTHROPIC_MODEL ?? '',
        },
        google: {
          apiKey: parsed.GOOGLE_API_KEY ?? '',
          model: parsed.GOOGLE_MODEL ?? '',
        },
      },
    });
  } catch {
    return normalizeProviderConfig();
  }
}

function escapeEnvValue(value: string): string {
  if (!value.includes('\n') && !value.includes('#') && !value.includes(' ')) {
    return value;
  }
  return JSON.stringify(value);
}

export async function writeProviderConfig(repoPath: string, config: ProviderRuntimeConfig): Promise<void> {
  const filePath = resolveProviderConfigPath(repoPath);
  const lines = [
    `CODE_SWE_PROVIDER=${config.selectedProvider}`,
    `OPENAI_API_KEY=${escapeEnvValue(config.providers.openai.apiKey)}`,
    `OPENAI_MODEL=${escapeEnvValue(config.providers.openai.model)}`,
    `ANTHROPIC_API_KEY=${escapeEnvValue(config.providers.anthropic.apiKey)}`,
    `ANTHROPIC_MODEL=${escapeEnvValue(config.providers.anthropic.model)}`,
    `GOOGLE_API_KEY=${escapeEnvValue(config.providers.google.apiKey)}`,
    `GOOGLE_MODEL=${escapeEnvValue(config.providers.google.model)}`,
    '',
  ].join('\n');

  await fs.writeFile(filePath, lines, 'utf8');
}

export function applyProviderEnv(config: ProviderRuntimeConfig): void {
  process.env.CODE_SWE_PROVIDER = config.selectedProvider;
  for (const provider of Object.keys(PROVIDER_ENV_KEYS) as ProviderId[]) {
    const providerConfig = config.providers[provider];
    const envKeys = PROVIDER_ENV_KEYS[provider];
    process.env[envKeys.apiKey] = providerConfig.apiKey;
    process.env[envKeys.model] = providerConfig.model;
  }
}

export function createChatModel(config: ProviderModelConfig): ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI {
  if (config.provider === 'openai') {
    return new ChatOpenAI({
      model: config.model,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      temperature: 1,
    });
  }

  if (config.provider === 'anthropic') {
    return new ChatAnthropic({
      model: config.model,
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      temperature: 1,
    });
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
    temperature: 1,
  });
}

export function getSelectedProviderConfig(config: ProviderRuntimeConfig): ProviderModelConfig {
  return createProviderSelection(config.selectedProvider, config);
}