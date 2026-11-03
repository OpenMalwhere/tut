import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listModels, testChat, ProviderError } from "../src/providers.js";
import { chooseModel } from "../src/model-picker.js";
import { runOnboarding } from "../src/onboarding.js";
import { getApiKey, loadConfig } from "../src/config.js";
import { modelsCommand, testCommand } from "../src/model-cli.js";

const KEY = "sk-test-SECRETKEY-1234567890";
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// A fake fetch: routes by URL, records every call.
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    for (const [match, reply] of routes) if (String(url).includes(match)) return typeof reply === "function" ? reply(url, init) : reply;
    throw new Error(`unexpected url ${url}`);
  };
  f.calls = calls;
  return f;
}
const header = (call, name) => new Headers(call.init.headers).get(name);

test("OpenRouter: checks the key first, then lists models", async () => {
  const f = fakeFetch([
    ["/api/v1/key", json({ data: { label: "x" } })],
    ["/api/v1/models", json({ data: [{ id: "anthropic/claude-x", name: "Claude X" }, { id: "openai/gpt-y" }] })],
  ]);
  const models = await listModels("openrouter", KEY, { fetch: f });
  assert.deepEqual(models.map((m) => m.id), ["anthropic/claude-x", "openai/gpt-y"]);
  assert.match(f.calls[0].url, /\/key$/);
  assert.equal(header(f.calls[0], "authorization"), `Bearer ${KEY}`);
});

test("OpenAI: keeps chat models only", async () => {
  const f = fakeFetch([["api.openai.com/v1/models", json({ data: [
    { id: "gpt-4o" }, { id: "text-embedding-3-small" }, { id: "whisper-1" }, { id: "o3-mini" },
    { id: "dall-e-3" }, { id: "gpt-4o-realtime-preview" }, { id: "gpt-3.5-turbo-instruct" }, { id: "tts-1" },
  ] })]]);
  assert.deepEqual((await listModels("openai", KEY, { fetch: f })).map((m) => m.id), ["gpt-4o", "o3-mini"]);
});

test("Grok: drops image/video/embedding models", async () => {
  const f = fakeFetch([["api.x.ai/v1/models", json({ data: [{ id: "grok-4" }, { id: "grok-2-image" }, { id: "grok-3-mini" }] })]]);
  assert.deepEqual((await listModels("grok", KEY, { fetch: f })).map((m) => m.id), ["grok-4", "grok-3-mini"]);
});

test("Anthropic: sends x-api-key + version header and follows pagination", async () => {
  let n = 0;
  const f = fakeFetch([["api.anthropic.com/v1/models", () =>
    json(n++ === 0
      ? { data: [{ id: "claude-a", display_name: "Claude A" }], has_more: true, last_id: "claude-a" }
      : { data: [{ id: "claude-b", display_name: "Claude B" }], has_more: false })]]);
  const models = await listModels("anthropic", KEY, { fetch: f });
  assert.deepEqual(models.map((m) => m.id), ["claude-a", "claude-b"]);
  assert.equal(header(f.calls[0], "x-api-key"), KEY);
  assert.equal(header(f.calls[0], "anthropic-version"), "2023-06-01");
  assert.match(f.calls[1].url, /after_id=claude-a/);
});

test("Gemini: key goes in a header (not the URL); only generateContent models; strips models/", async () => {
  const f = fakeFetch([["generativelanguage.googleapis.com/v1beta/models", json({ models: [
    { name: "models/gemini-2.5-pro", displayName: "Gemini Pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
  ] })]]);
  const models = await listModels("gemini", KEY, { fetch: f });
  assert.deepEqual(models.map((m) => m.id), ["gemini-2.5-pro", "gemini-flash"]);
  assert.equal(header(f.calls[0], "x-goog-api-key"), KEY);
  assert.doesNotMatch(f.calls[0].url, /SECRETKEY/);
});

test("a rejected key gives code AUTH for all five providers, and the message never contains the key", async () => {
  const replies = {
    openrouter: json({ error: { code: 401, message: `User not found for ${KEY}` } }, 401),
    grok: json({ error: `Incorrect API key provided: ${KEY}` }, 400),
    openai: json({ error: { message: `Incorrect API key provided: ${KEY}` } }, 401),
    anthropic: json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401),
    gemini: json({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }, 400),
  };
  for (const [id, reply] of Object.entries(replies)) {
    const f = async () => reply.clone();
    await assert.rejects(listModels(id, KEY, { fetch: f }), (e) => {
      assert.ok(e instanceof ProviderError, id);
      assert.equal(e.code, "AUTH", id);
      assert.doesNotMatch(e.message, /SECRETKEY/, id);
      assert.match(e.message, /tut setup/);
      return true;
    });
  }
});

test("network failure -> NETWORK; 429 -> RATE_LIMIT; 402 -> CREDITS; unreadable reply -> BAD_RESPONSE", async () => {
  await assert.rejects(listModels("openai", KEY, { fetch: async () => { throw new TypeError("fetch failed"); } }),
    (e) => e.code === "NETWORK" && /api\.openai\.com/.test(e.message) && !/SECRETKEY/.test(e.message));
  await assert.rejects(listModels("openai", KEY, { fetch: async () => json({ error: { message: "slow down" } }, 429) }), (e) => e.code === "RATE_LIMIT");
  await assert.rejects(testChat("openrouter", KEY, "m", { fetch: async () => json({ error: { message: "Insufficient credits" } }, 402) }), (e) => e.code === "CREDITS");
  await assert.rejects(listModels("openai", KEY, { fetch: async () => new Response("<html>oops</html>", { status: 200 }) }), (e) => e.code === "BAD_RESPONSE");
});

test("testChat: right URL, auth, body and reply parsing for each provider", async () => {
  const cases = {
    openrouter: { url: "openrouter.ai/api/v1/chat/completions", reply: { choices: [{ message: { content: " ready " } }] }, tok: "max_tokens" },
    grok: { url: "api.x.ai/v1/chat/completions", reply: { choices: [{ message: { content: "ready" } }] }, tok: "max_completion_tokens" },
    openai: { url: "api.openai.com/v1/chat/completions", reply: { choices: [{ message: { content: "ready" } }] }, tok: "max_completion_tokens" },
    anthropic: { url: "api.anthropic.com/v1/messages", reply: { content: [{ type: "text", text: "ready" }] } },
    gemini: { url: "models/gem-model:generateContent", reply: { candidates: [{ content: { parts: [{ text: "ready" }] } }] } },
  };
  for (const [id, c] of Object.entries(cases)) {
    const f = fakeFetch([[c.url, json(c.reply)]]);
    const r = await testChat(id, KEY, "gem-model", { fetch: f });
    assert.equal(r.text, "ready", id);
    const call = f.calls[0];
    assert.equal(call.init.method, "POST", id);
    const body = JSON.parse(call.init.body);
    if (c.tok) { assert.equal(body.model, "gem-model"); assert.ok(body[c.tok] > 0, id); }
    if (id === "anthropic") { assert.equal(body.model, "gem-model"); assert.ok(body.max_tokens > 0); }
    assert.doesNotMatch(call.url, /SECRETKEY/, id);
  }
});

test("testChat: an empty reply (reasoning models) still counts as success", async () => {
  const r = await testChat("openai", KEY, "o3", { fetch: async () => json({ choices: [{ message: { content: null } }] }) });
  assert.equal(r.text, "");
});

const out0 = () => {};
const models = [...Array(30)].map((_, i) => ({ id: `vendor/model-${i + 1}`, name: `Model ${i + 1}` })).concat([{ id: "claude-special", name: "Claude Special" }]);
const answers = (...list) => { const q = [...list]; return { ask: async () => q.shift() ?? "" }; };

test("model picker: number, exact id, search then number, single search hit", async () => {
  assert.equal(await chooseModel(models, { io: answers("3"), out: out0 }), "vendor/model-3");
  assert.equal(await chooseModel(models, { io: answers("vendor/model-22"), out: out0 }), "vendor/model-22");
  assert.equal(await chooseModel(models, { io: answers("model-2", "1"), out: out0 }), "vendor/model-2");
  assert.equal(await chooseModel(models, { io: answers("special"), out: out0 }), "claude-special");
  assert.equal(await chooseModel(models, { io: answers("99", "nothing-matches", "2"), out: out0 }), "vendor/model-2");
});

const freshEnv = (extra = {}) => ({ TUT_HOME: mkdtempSync(join(tmpdir(), "tut-prov-")), ...extra });
const api = (over = {}) => ({
  listModels: async () => [{ id: "m-one", name: "M One" }, { id: "m-two", name: "M Two" }],
  testChat: async () => ({ text: "ready" }),
  ...over,
});

test("onboarding: valid key -> key saved, model chosen and saved, test message sent", async () => {
  const env = freshEnv();
  let tested = null;
  const io = { askChoice: async () => 2, askSecret: async () => KEY, ...answers("2", "") };
  const lines = [];
  const r = await runOnboarding({ env, io, out: (s) => lines.push(s), api: api({ testChat: async (p, k, m) => { tested = { p, m }; return { text: "ready" }; } }) });
  assert.equal(r.model, "m-two");
  assert.equal(loadConfig(env).model, "m-two");
  assert.deepEqual(tested, { p: "anthropic", m: "m-two" });
  assert.match(lines.join(""), /Reply: ready/);
  assert.doesNotMatch(lines.join(""), /SECRETKEY/);
});

test("onboarding: a rejected key is NOT saved and the user is asked again", async () => {
  const env = freshEnv();
  const keys = ["sk-wrong-key-00000000", KEY];
  let calls = 0;
  const io = { askChoice: async () => 0, askSecret: async () => keys.shift(), ...answers("1", "n") };
  const a = api({ listModels: async (p, k) => { calls++; if (k !== KEY) throw new ProviderError("AUTH", "OpenRouter rejected the API key (HTTP 401)."); return [{ id: "m-one" }]; } });
  const r = await runOnboarding({ env, io, api: a, out: out0 });
  assert.equal(calls, 2);
  assert.equal(getApiKey("openrouter", env).key, KEY);
  assert.equal(r.model, "m-one");
});

test("onboarding: three rejected keys -> nothing saved", async () => {
  const env = freshEnv();
  const io = { askChoice: async () => 0, askSecret: async () => "sk-wrong-key-00000000", ask: async () => "" };
  const a = api({ listModels: async () => { throw new ProviderError("AUTH", "rejected"); } });
  const r = await runOnboarding({ env, io, api: a, out: out0 });
  assert.equal(r.cancelled, true);
  assert.equal(existsSync(join(env.TUT_HOME, "keys.json")), false);
});

test("onboarding: network down -> key is still saved, model left for later", async () => {
  const env = freshEnv();
  const io = { askChoice: async () => 3, askSecret: async () => KEY, ask: async () => "" };
  const a = api({ listModels: async () => { throw new ProviderError("NETWORK", "Could not reach api.openai.com."); } });
  const r = await runOnboarding({ env, io, api: a, out: out0 });
  assert.equal(r.cancelled, false);
  assert.equal(getApiKey("openai", env).key, KEY);
  assert.equal(loadConfig(env).model, null);
});

test("onboarding: a failed test message does not lose the saved settings", async () => {
  const env = freshEnv();
  const io = { askChoice: async () => 2, askSecret: async () => KEY, ...answers("1", "y") };
  const lines = [];
  const a = api({ testChat: async () => { throw new ProviderError("HTTP", "Anthropic returned HTTP 404: model not found"); } });
  const r = await runOnboarding({ env, io, api: a, out: (s) => lines.push(s) });
  assert.equal(loadConfig(env).model, "m-one");
  assert.match(lines.join(""), /Test failed/);
  assert.equal(r.cancelled, false);
});

test("switching provider clears the old model", async () => {
  const env = freshEnv();
  const io1 = { askChoice: async () => 2, askSecret: async () => KEY, ...answers("1", "n") };
  await runOnboarding({ env, io: io1, api: api(), out: out0 });
  const io2 = { askChoice: async () => 3, askSecret: async () => "sk-openai-12345678", ask: async () => "" };
  await runOnboarding({ env, io: io2, api: api({ listModels: async () => { throw new ProviderError("NETWORK", "down"); } }), out: out0 });
  assert.equal(loadConfig(env).provider, "openai");
  assert.equal(loadConfig(env).model, null);
});

test("tut models set / list / test via the command functions", async () => {
  const env = freshEnv({ OPENAI_API_KEY: KEY, TUT_PROVIDER: "openai" });
  const lines = [];
  const out = (s) => lines.push(s);
  assert.equal(await modelsCommand(["set", "gpt-4o"], { env, api: api(), out }), 0);
  assert.equal(loadConfig(env).model, "gpt-4o");
  assert.equal(await modelsCommand(["list"], { env, api: api(), out }), 0);
  assert.match(lines.join(""), /OpenAI: 2 models[\s\S]*m-one[\s\S]*m-two/);
  assert.equal(await testCommand({ env, api: api(), out }), 0);
  assert.match(lines.join(""), /Reply: ready/);
  assert.doesNotMatch(lines.join(""), /SECRETKEY/);
});

test("tut test needs a model; tut models needs a key", async () => {
  const env = freshEnv({ OPENAI_API_KEY: KEY, TUT_PROVIDER: "openai" });
  await assert.rejects(testCommand({ env, api: api(), out: out0 }), /no model chosen/);
  const bare = freshEnv();
  await assert.rejects(modelsCommand(["list"], { env: bare, api: api(), out: out0 }), /tut setup/);
  await assert.rejects(modelsCommand([], { env: env, api: api(), out: out0, interactive: false }), /needs a terminal/);
});

test("CLI: tut models set, tut test without setup", () => {
  const bin = fileURLToPath(new URL("../bin/tut.js", import.meta.url));
  const env = { ...process.env, TUT_HOME: mkdtempSync(join(tmpdir(), "tut-cli-")) };
  for (const k of ["OPENROUTER_API_KEY","XAI_API_KEY","GROK_API_KEY","ANTHROPIC_API_KEY","OPENAI_API_KEY","GEMINI_API_KEY","GOOGLE_API_KEY","TUT_PROVIDER"]) delete env[k];
  const set = spawnSync(process.execPath, [bin, "models", "set", "my-model"], { encoding: "utf8", env });
  assert.equal(set.status, 0);
  assert.match(set.stdout, /Model saved: my-model/);
  const t = spawnSync(process.execPath, [bin, "test"], { encoding: "utf8", env });
  assert.equal(t.status, 1);
  assert.match(t.stderr, /tut setup/);
});

import { columns, promptText } from "../src/ui.js";

test("ui: few models one per line, many models in columns, nothing dropped", () => {
  const few = columns(["1) a", "2) b", "3) c"], 100);
  assert.equal(few.length, 3);
  const many = Array.from({ length: 1000 }, (_, i) => `${i + 1}) vendor/model-${i}`);
  const lines = columns(many, 120);
  assert.ok(lines.length < 1000 && lines.length > 1);
  const text = lines.join("\n");
  assert.ok(text.includes("1000) vendor/model-999") && text.includes("1) vendor/model-0"));
});

test("ui: Kali-style prompt has two lines and plain text without colour", () => {
  const p = promptText({ on: false, user: "cvaki", host: "god", cwd: "/tmp" });
  assert.equal(p, "┌──(cvaki  𒁈  god)-[/tmp]\n└─TuT::@ ");
});
