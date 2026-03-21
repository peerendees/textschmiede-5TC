/**
 * Shared provider adapter for Textschmiede.
 * Supports: Anthropic (Claude), Google (Gemini), xAI (Grok)
 * Uses dynamic import() to only load the needed SDK per request.
 */

export async function callProvider({ provider, apiKey, model, systemPrompt, userPrompt, maxTokens = 8000, jsonMode = false }) {
  if (!apiKey) throw new Error('API Key fehlt.');
  if (!model) throw new Error('Kein Modell ausgewählt.');

  try {
    switch (provider) {
      case 'anthropic':
        return await callAnthropic({ apiKey, model, systemPrompt, userPrompt, maxTokens });
      case 'google':
        return await callGoogle({ apiKey, model, systemPrompt, userPrompt, maxTokens, jsonMode });
      case 'xai':
        return await callGrok({ apiKey, model, systemPrompt, userPrompt, maxTokens, jsonMode });
      default:
        throw new Error(`Unbekannter Provider: ${provider}`);
    }
  } catch (error) {
    // Normalize error messages
    const msg = error?.message || error?.error?.message || String(error);
    throw new Error(msg);
  }
}

// ── Anthropic (Claude) ──
async function callAnthropic({ apiKey, model, systemPrompt, userPrompt, maxTokens }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return { content };
}

// ── Google (Gemini) ──
async function callGoogle({ apiKey, model, systemPrompt, userPrompt, maxTokens, jsonMode }) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const config = {
    systemInstruction: systemPrompt,
    maxOutputTokens: maxTokens
  };

  if (jsonMode) {
    config.responseMimeType = 'application/json';
  }

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config
  });

  return { content: response.text };
}

// ── xAI (Grok) ──
async function callGrok({ apiKey, model, systemPrompt, userPrompt, maxTokens, jsonMode }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  const response = await client.chat.completions.create(params);
  return { content: response.choices[0].message.content };
}
