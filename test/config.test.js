import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync, statSync, chmodSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import {
  configPath, keysPath, loadConfig, saveConfig, setApiKey, removeApiKey, getApiKey,
  resolveProvider, isConfigured, maskKey,
} from "../src/config.js";
import { askSecret } from "../src/prompt.js";
import { runOnboarding } from "../src/onboarding.js";

const bin = fileURLToPath(new URL("../bin/tut.js", import.meta.url));
const posix = process.platform !== "win32";
const freshEnv = (extra = {}) => ({ TUT_HOME: mkdtempSync(join(tmpdir(), "tut-cfg-")), ...extra });
const mode = (f) => statSync(f).mode & 0o777;

test("saving a key creates private files (mode 600, folder 700)", { skip: !posix }, () => {
  const env = freshEnv();
  setApiKey("openrouter", "sk-or-1234567890abcdef", env);
  saveConfig({ provider: "openrouter" }, env);
  assert.equal(mode(keysPath(env)), 0o600);
  assert.equal(mode(configPath(env)), 0o600);
  assert.equal(mode(env.TUT_HOME) & 0o077, 0);
  assert.equal(getApiKey("openrouter", env).key, "sk-or-1234567890abcdef");
});

test("config.json never contains the key", () => {
  const env = freshEnv();
  setApiKey("openai", "sk-secret-abcdefgh1234", env);
  saveConfig({ provider: "openai" }, env);
  assert.doesNotMatch(readFileSync(configPath(env), "utf8"), /sk-secret/);
});

test("environment variable beats the saved key (and GROK_API_KEY works for grok)", () => {
  const env = freshEnv();
  setApiKey("grok", "xai-from-file-12345678", env);
  assert.equal(getApiKey("grok", env).source, "file");
  const withEnv = { ...env, XAI_API_KEY: "xai-from-env-12345678" };
  assert.deepEqual(
    { k: getApiKey("grok", withEnv).key, s: getApiKey("grok", withEnv).source },
    { k: "xai-from-env-12345678", s: "env" },
  );
  assert.equal(getApiKey("grok", { ...env, GROK_API_KEY: "xai-alt-name-12345678" }).source, "env");
});

test("provider resolution: TUT_PROVIDER > saved > first env key", () => {
  const env = freshEnv();
  assert.equal(resolveProvider(env), null);
  assert.equal(resolveProvider({ ...env, ANTHROPIC_API_KEY: "sk-ant-12345678" }), "anthropic");
  saveConfig({ provider: "gemini" }, env);
  assert.equal(resolveProvider({ ...env, ANTHROPIC_API_KEY: "sk-ant-12345678" }), "gemini");
  assert.equal(resolveProvider({ ...env, TUT_PROVIDER: "openai" }), "openai");
  assert.throws(() => resolveProvider({ ...env, TUT_PROVIDER: "nope" }), /not valid/);
});

test("isConfigured needs both a provider and a key", () => {
  const env = freshEnv();
  assert.equal(isConfigured(env), false);
  saveConfig({ provider: "openai" }, env);
  assert.equal(isConfigured(env), false);
  assert.equal(isConfigured({ ...env, OPENAI_API_KEY: "sk-12345678" }), true);
});

test("bad keys are rejected and nothing is written", () => {
  const env = freshEnv();
  assert.throws(() => setApiKey("openai", "short", env), /too short/);
  assert.throws(() => setApiKey("openai", "has a space inside 123", env), /no spaces/);
  assert.throws(() => setApiKey("nope", "sk-12345678", env), /Unknown provider/);
  assert.equal(existsSync(keysPath(env)), false);
});

test("removeApiKey deletes only that key", () => {
  const env = freshEnv();
  setApiKey("openai", "sk-openai-12345678", env);
  setApiKey("gemini", "gem-key-12345678", env);
  assert.equal(removeApiKey("openai", env), true);
  assert.equal(getApiKey("openai", env).key, null);
  assert.equal(getApiKey("gemini", env).key, "gem-key-12345678");
});

test("maskKey hides the middle", () => {
  assert.equal(maskKey("sk-or-v1-abcdefghijklmnop"), "sk-...mnop");
  assert.equal(maskKey("short"), "****");
});

test("a broken config.json gives a clear error and is not overwritten", () => {
  const env = freshEnv();
  saveConfig({ provider: "openai" }, env);
  writeFileSync(configPath(env), "{ not json");
  assert.throws(() => loadConfig(env), /not valid JSON/);
  assert.throws(() => saveConfig({ model: "x" }, env), /not valid JSON/);
  assert.equal(readFileSync(configPath(env), "utf8"), "{ not json");
});

test("a keys file readable by others is tightened to 600", { skip: !posix }, () => {
  const env = freshEnv();
  setApiKey("openai", "sk-openai-12345678", env);
  chmodSync(keysPath(env), 0o644);
  const realErr = console.error;
  console.error = () => {};
  try {
    getApiKey("openai", env);
  } finally {
    console.error = realErr;
  }
  assert.equal(mode(keysPath(env)), 0o600);
});

function fakeTty() {
  const input = new PassThrough();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (v) => { input.isRaw = v; };
  const output = new PassThrough();
  let written = "";
  output.on("data", (d) => (written += d));
  return { input, output, text: () => written };
}

test("askSecret: never echoes the key, handles paste and Backspace", async () => {
  const t = fakeTty();
  const p = askSecret("Key: ", t);
  t.input.write("sk-abc");
  t.input.write("X\u007f");              // typed X then Backspace
  t.input.write("\u001b[A");              // arrow key is ignored
  t.input.write("123456\r");
  assert.equal(await p, "sk-abc123456");
  assert.doesNotMatch(t.text(), /sk-abc|123456/);
  assert.match(t.text(), /\*/);
  assert.equal(t.input.isRaw, false);
});

test("askSecret: Ctrl+C cancels", async () => {
  const t = fakeTty();
  const p = askSecret("Key: ", t);
  t.input.write("abc\u0003");
  await assert.rejects(p, (e) => e.code === "CANCELLED");
});

test("askSecret refuses without a terminal", async () => {
  await assert.rejects(askSecret("Key: ", { input: new PassThrough(), output: new PassThrough() }), /interactive terminal/);
});

const fakeApi = (over = {}) => ({
  listModels: async () => [{ id: "m-one", name: "M One" }, { id: "m-two", name: "M Two" }],
  testChat: async () => ({ text: "ready" }),
  ...over,
});
const answers = (...list) => { const q = [...list]; return async () => q.shift() ?? ""; };

test("onboarding saves provider and key", async () => {
  const env = freshEnv();
  const io = { askChoice: async () => 2, askSecret: async () => "sk-ant-abcdefgh1234", ask: answers("1", "n") };
  const r = await runOnboarding({ env, io, api: fakeApi(), out: () => {} });
  assert.equal(r.provider, "anthropic");
  assert.equal(loadConfig(env).provider, "anthropic");
  assert.equal(getApiKey("anthropic", env).key, "sk-ant-abcdefgh1234");
});

test("onboarding skips the key prompt when the environment already has one", async () => {
  const env = { ...freshEnv(), OPENAI_API_KEY: "sk-env-12345678" };
  let asked = false;
  const io = { askChoice: async () => 3, askSecret: async () => { asked = true; return "x"; }, ask: answers("2", "n") };
  const r = await runOnboarding({ env, io, api: fakeApi(), out: () => {} });
  assert.equal(r.provider, "openai");
  assert.equal(asked, false);
  assert.equal(existsSync(keysPath(env)), false);
});

test("onboarding retries a bad key, then gives up cleanly", async () => {
  const env = freshEnv();
  const io = { askChoice: async () => 0, askSecret: async () => "bad", ask: answers() };
  const r = await runOnboarding({ env, io, api: fakeApi(), out: () => {} });
  assert.equal(r.cancelled, true);
  assert.equal(existsSync(keysPath(env)), false);
});

const cli = (args, env, opts = {}) =>
  spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", env: { ...process.env, ...env }, ...opts });

test("CLI: tut config masks keys and shows their source", () => {
  const env = freshEnv({ OPENROUTER_API_KEY: "sk-or-v1-SECRETSECRETSECRET1234" });
  const r = cli(["config"], env);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /OpenRouter\s+from environment OPENROUTER_API_KEY/);
  assert.match(r.stdout, /Anthropic\s+not set/);
  assert.doesNotMatch(r.stdout, /SECRETSECRET/);
});

test("CLI: tut setup without a terminal exits 2 with a hint", () => {
  const r = cli(["setup"], freshEnv(), { input: "" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /interactive terminal/);
});

test("CLI: first run without a terminal hints, still works, writes nothing", () => {
  const env = freshEnv();
  for (const k of ["OPENROUTER_API_KEY","XAI_API_KEY","GROK_API_KEY","ANTHROPIC_API_KEY","OPENAI_API_KEY","GEMINI_API_KEY","GOOGLE_API_KEY","TUT_PROVIDER"]) delete process.env[k];
  const r = cli([], env, { input: "exit\n" });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /no provider configured/);
  assert.deepEqual(readdirSync(env.TUT_HOME), []);
});
