// Provider layer (WO-3): list models and send a test message for the five providers.
// Plain HTTPS through built-in fetch, no SDKs. `fetch` is injectable so tests never touch the network.
import { providerById } from "./providers-meta.js";

const TIMEOUT_MS = 20000;
const TEST_PROMPT = "Reply with the single word: ready";

export class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderError";
    this.code = code; // AUTH | NETWORK | RATE_LIMIT | CREDITS | HTTP | BAD_RESPONSE
  }
}

const redact = (text, key) => (key ? String(text).split(key).join("***") : String(text));
export const bearer = (key) => ({ authorization: `Bearer ${key}` });

function errorDetail(data, text) {
  const e = data?.error;
  return (typeof e === "string" ? e : e?.message) ?? data?.message ?? text.slice(0, 200);
}

export async function request(label, url, { method = "GET", headers = {}, body, timeoutMs = TIMEOUT_MS } = {}, key, f) {
  let res;
  try {
    res = await f(url, {
      method,
      headers: body ? { ...headers, "content-type": "application/json" } : headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new ProviderError("NETWORK", `${label} did not answer within ${timeoutMs / 1000} seconds.`);
    }
    throw new ProviderError("NETWORK", `Could not reach ${new URL(url).host}. Check your internet connection.`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (res.ok) {
    if (data === null) throw new ProviderError("BAD_RESPONSE", `${label} sent a reply tut could not read.`);
    return data;
  }
  const detail = redact(errorDetail(data, text), key).slice(0, 200);
  const authish =
    res.status === 401 || res.status === 403 ||
    (res.status === 400 && /api[ _-]?key|incorrect key|authentication|unauthorized/i.test(detail));
  if (authish) throw new ProviderError("AUTH", `${label} rejected the API key (HTTP ${res.status}). Check the key, then run: tut setup`);
  if (res.status === 429) throw new ProviderError("RATE_LIMIT", `${label}: too many requests or quota used up (HTTP 429). ${detail}`);
  if (res.status === 402) throw new ProviderError("CREDITS", `${label}: this account has no credits (HTTP 402). Add credits, then try again.`);
  throw new ProviderError("HTTP", `${label} returned HTTP ${res.status}: ${detail}`);
}

const NOT_CHAT = /embed|whisper|tts|dall-e|image|imagine|video|audio|realtime|transcribe|moderation|instruct|search-preview/i;

function openaiChat(url, tokenParam) {
  return async (label, key, model, f) => {
    const d = await request(label, url, {
      method: "POST",
      headers: bearer(key),
      body: { model, messages: [{ role: "user", content: TEST_PROMPT }], [tokenParam]: 64 },
    }, key, f);
    return d.choices?.[0]?.message?.content ?? "";
  };
}

const ADAPTERS = {
  openrouter: {
    async list(label, key, f) {
      // /models is public, so check the key first with /key (it rejects bad keys).
      await request(label, "https://openrouter.ai/api/v1/key", { headers: bearer(key) }, key, f);
      const d = await request(label, "https://openrouter.ai/api/v1/models", { headers: bearer(key) }, key, f);
      return (d.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
    },
    chat: openaiChat("https://openrouter.ai/api/v1/chat/completions", "max_tokens"),
  },
  grok: {
    async list(label, key, f) {
      const d = await request(label, "https://api.x.ai/v1/models", { headers: bearer(key) }, key, f);
      return (d.data ?? []).filter((m) => !NOT_CHAT.test(m.id)).map((m) => ({ id: m.id, name: m.id }));
    },
    chat: openaiChat("https://api.x.ai/v1/chat/completions", "max_completion_tokens"),
  },
  openai: {
    async list(label, key, f) {
      const d = await request(label, "https://api.openai.com/v1/models", { headers: bearer(key) }, key, f);
      return (d.data ?? [])
        .filter((m) => /^(gpt-|chatgpt-|o\d)/.test(m.id) && !NOT_CHAT.test(m.id))
        .map((m) => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
    chat: openaiChat("https://api.openai.com/v1/chat/completions", "max_completion_tokens"),
  },
  anthropic: {
    async list(label, key, f) {
      const headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
      const out = [];
      let after = null;
      for (let page = 0; page < 10; page++) {
        const url = `https://api.anthropic.com/v1/models?limit=1000${after ? `&after_id=${encodeURIComponent(after)}` : ""}`;
        const d = await request(label, url, { headers }, key, f);
        for (const m of d.data ?? []) out.push({ id: m.id, name: m.display_name ?? m.id });
        if (!d.has_more || !d.last_id) break;
        after = d.last_id;
      }
      return out;
    },
    async chat(label, key, model, f) {
      const d = await request(label, "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: { model, max_tokens: 64, messages: [{ role: "user", content: TEST_PROMPT }] },
      }, key, f);
      return (d.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    },
  },
  gemini: {
    async list(label, key, f) {
      const out = [];
      let token = null;
      for (let page = 0; page < 10; page++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
        const d = await request(label, url, { headers: { "x-goog-api-key": key } }, key, f);
        for (const m of d.models ?? []) {
          if (!(m.supportedGenerationMethods ?? []).includes("generateContent")) continue;
          const id = String(m.name).replace(/^models\//, "");
          if (/embed|imagen|veo|tts|aqa/i.test(id)) continue;
          out.push({ id, name: m.displayName ?? id });
        }
        if (!d.nextPageToken) break;
        token = d.nextPageToken;
      }
      return out;
    },
    async chat(label, key, model, f) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const d = await request(label, url, {
        method: "POST",
        headers: { "x-goog-api-key": key },
        body: { contents: [{ parts: [{ text: TEST_PROMPT }] }], generationConfig: { maxOutputTokens: 64 } },
      }, key, f);
      return (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    },
  },
};

function adapterFor(providerId) {
  const p = providerById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);
  return { label: p.label, a: ADAPTERS[providerId] };
}

// Also proves the key works: a bad key throws ProviderError with code AUTH.
export async function listModels(providerId, key, { fetch: f = globalThis.fetch } = {}) {
  const { label, a } = adapterFor(providerId);
  return a.list(label, key, f);
}

export async function testChat(providerId, key, model, { fetch: f = globalThis.fetch } = {}) {
  const { label, a } = adapterFor(providerId);
  return { text: String(await a.chat(label, key, model, f)).trim() };
}
