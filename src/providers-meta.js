// Static facts about the five providers. WO-3 adds the HTTP adapters on top of this list.
export const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", envVars: ["OPENROUTER_API_KEY"] },
  { id: "grok", label: "xAI Grok", envVars: ["XAI_API_KEY", "GROK_API_KEY"] },
  { id: "anthropic", label: "Anthropic", envVars: ["ANTHROPIC_API_KEY"] },
  { id: "openai", label: "OpenAI", envVars: ["OPENAI_API_KEY"] },
  { id: "gemini", label: "Google Gemini", envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"] },
];

export const providerById = (id) => PROVIDERS.find((p) => p.id === id) ?? null;
