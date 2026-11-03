// One chat turn with tool calling, for all five providers (WO-5).
// Neutral message format used everywhere in tut:
//   { role: "user", content }
//   { role: "assistant", content, toolCalls: [{ id, name, args }] }
//   { role: "tool", toolCallId, name, content }
// Result: { text, toolCalls: [{ id, name, args }] }. `fetch` is injectable so tests never touch the network.
import { ProviderError, bearer, request } from "./providers.js";
import { providerById } from "./providers-meta.js";

const CHAT_TIMEOUT_MS = 120000;
const OPENAI_STYLE = {
  openrouter: ["https://openrouter.ai/api/v1/chat/completions", "max_tokens"],
  grok: ["https://api.x.ai/v1/chat/completions", "max_completion_tokens"],
  openai: ["https://api.openai.com/v1/chat/completions", "max_completion_tokens"],
};

function parseArgs(raw) {
  if (raw && typeof raw === "object") return raw;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __badJson: String(raw).slice(0, 200) };
  }
}
const textOf = (c) => (Array.isArray(c) ? c.map((p) => p?.text ?? "").join("") : (c ?? ""));

async function openaiStyle(id, label, key, model, { system, messages, tools, maxTokens }, f) {
  const [url, tokenParam] = OPENAI_STYLE[id];
  const msgs = system ? [{ role: "system", content: system }] : [];
  for (const m of messages) {
    if (m.role === "user") msgs.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      const o = { role: "assistant", content: m.content || null };
      if (m.toolCalls?.length) o.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } }));
      msgs.push(o);
    } else msgs.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
  }
  const body = { model, messages: msgs, [tokenParam]: maxTokens };
  if (tools?.length) body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const d = await request(label, url, { method: "POST", headers: bearer(key), body, timeoutMs: CHAT_TIMEOUT_MS }, key, f);
  const msg = d.choices?.[0]?.message;
  if (!msg) throw new ProviderError("BAD_RESPONSE", `${label} sent no answer.`);
  return { text: textOf(msg.content), toolCalls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name, args: parseArgs(c.function?.arguments) })) };
}

async function anthropicStyle(label, key, model, { system, messages, tools, maxTokens }, f) {
  const msgs = [];
  for (const m of messages) {
    if (m.role === "user") msgs.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.args ?? {} });
      msgs.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "(no text)" }] });
    } else {
      const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = msgs[msgs.length - 1];
      if (last?.role === "user" && Array.isArray(last.content) && last.content[0]?.type === "tool_result") last.content.push(block);
      else msgs.push({ role: "user", content: [block] });
    }
  }
  const body = { model, max_tokens: maxTokens, messages: msgs };
  if (system) body.system = system;
  if (tools?.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const d = await request(label, "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, body, timeoutMs: CHAT_TIMEOUT_MS }, key, f);
  const blocks = d.content ?? [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text).join(""),
    toolCalls: blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} })),
  };
}

async function geminiStyle(label, key, model, { system, messages, tools, maxTokens }, f) {
  const contents = [];
  for (const m of messages) {
    if (m.role === "user") contents.push({ role: "user", parts: [{ text: m.content }] });
    else if (m.role === "assistant") {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args ?? {} } });
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "(no text)" }] });
    } else {
      const part = { functionResponse: { name: m.name, response: { result: m.content } } };
      const last = contents[contents.length - 1];
      if (last?.role === "user" && last.parts[0]?.functionResponse) last.parts.push(part);
      else contents.push({ role: "user", parts: [part] });
    }
  }
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools?.length) body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const d = await request(label, url, { method: "POST", headers: { "x-goog-api-key": key }, body, timeoutMs: CHAT_TIMEOUT_MS }, key, f);
  const parts = d.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.map((p) => p.text ?? "").join(""),
    toolCalls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: `call_${Date.now().toString(36)}_${i}`, name: p.functionCall.name, args: p.functionCall.args ?? {} })),
  };
}

export async function chatTurn(providerId, key, model, { system, messages, tools = [], maxTokens = 2048 }, { fetch: f = globalThis.fetch } = {}) {
  const p = providerById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);
  const opts = { system, messages, tools, maxTokens };
  if (OPENAI_STYLE[providerId]) return openaiStyle(providerId, p.label, key, model, opts, f);
  if (providerId === "anthropic") return anthropicStyle(p.label, key, model, opts, f);
  return geminiStyle(p.label, key, model, opts, f);
}
