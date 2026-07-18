/**
 * AI Gateway — routes to Ollama (default), Groq, OpenRouter, or Anthropic.
 * Provides a unified chat completion interface for all providers.
 */

export type AIProvider = 'ollama' | 'groq' | 'openrouter' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed?: number;
}

// Provider presets
const OLLAMA_TIERS: Record<string, { model: string; desc: string }> = {
  lean: { model: 'llama3.2:3b', desc: 'Fast, low resource — 3B params' },
  balanced: { model: 'llama3.1:8b', desc: 'Good quality/speed tradeoff — 8B params' },
  heavy: { model: 'llama3.1:70b', desc: 'Maximum quality — 70B params' },
};

function getDefaultConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER ?? 'ollama') as AIProvider;

  switch (provider) {
    case 'groq':
      return {
        provider: 'groq',
        model: process.env.GROQ_MODEL ?? 'llama-3.1-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
      };
    case 'openrouter':
      return {
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.1-70b-instruct',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      };
    case 'anthropic':
      return {
        provider: 'anthropic',
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.anthropic.com',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    default: {
      const tier = process.env.OLLAMA_TIER ?? 'balanced';
      return {
        provider: 'ollama',
        model: OLLAMA_TIERS[tier]?.model ?? 'llama3.1:8b',
        baseUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
      };
    }
  }
}

let activeConfig: AIConfig = getDefaultConfig();

export function getAIConfig(): AIConfig {
  return { ...activeConfig };
}

export function setAIConfig(config: Partial<AIConfig>): AIConfig {
  activeConfig = { ...activeConfig, ...config };
  return { ...activeConfig };
}

export function getOllamaTiers() {
  return OLLAMA_TIERS;
}

async function chatOllama(messages: ChatMessage[], config: AIConfig): Promise<AIResponse> {
  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
      options: {
        temperature: config.temperature ?? 0.3,
        num_predict: config.maxTokens ?? 1024,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json() as { message: { content: string }; eval_count?: number };
  return { content: data.message.content, model: config.model, provider: 'ollama', tokensUsed: data.eval_count };
}

async function chatOpenAICompat(messages: ChatMessage[], config: AIConfig): Promise<AIResponse> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`${config.provider} ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens: number } };
  return {
    content: data.choices[0]?.message?.content ?? '',
    model: config.model,
    provider: config.provider,
    tokensUsed: data.usage?.total_tokens,
  };
}

async function chatAnthropic(messages: ChatMessage[], config: AIConfig): Promise<AIResponse> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 1024,
      system: systemMsg?.content,
      messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ text: string }>; usage?: { input_tokens: number; output_tokens: number } };
  return {
    content: data.content[0]?.text ?? '',
    model: config.model,
    provider: 'anthropic',
    tokensUsed: data.usage ? data.usage.input_tokens + data.usage.output_tokens : undefined,
  };
}

export async function chat(messages: ChatMessage[], configOverride?: Partial<AIConfig>): Promise<AIResponse> {
  const config = { ...activeConfig, ...configOverride };

  switch (config.provider) {
    case 'ollama':
      return chatOllama(messages, config);
    case 'groq':
    case 'openrouter':
      return chatOpenAICompat(messages, config);
    case 'anthropic':
      return chatAnthropic(messages, config);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
