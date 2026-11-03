import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatTurn } from "../src/llm.js";
import { TOOLS, runAgent } from "../src/agent.js";
import { createSession } from "../src/agent-cli.js";
import { saveConfig, setApiKey } from "../src/config.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "tut-agent-"));
const reply = (json, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(json) });
const spy = (json) => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return reply(json);
  };
  return { f, calls };
};
const HISTORY = [
  { role: "user", content: "disk?" },
  { role: "assistant", content: "Let me look.", toolCalls: [{ id: "c1", name: "run_shell", args: { command: "df -h" } }, { id: "c2", name: "run_shell", args: { command: "uptime" } }] },
  { role: "tool", toolCallId: "c1", name: "run_shell", content: "out1" },
  { role: "tool", toolCallId: "c2", name: "run_shell", content: "out2" },
];

test("llm OpenRouter: tools sent in OpenAI format, tool calls parsed, history translated", async () => {
  const { f, calls } = spy({ choices: [{ message: { content: "ok", tool_calls: [{ id: "t1", type: "function", function: { name: "run_shell", arguments: '{"command":"df -h"}' } }] } }] });
  const r = await chatTurn("openrouter", "sk-or-KEY", "m/x", { system: "SYS", messages: HISTORY, tools: TOOLS }, { fetch: f });
  assert.deepEqual(r.toolCalls, [{ id: "t1", name: "run_shell", args: { command: "df -h" } }]);
  const c = calls[0];
  assert.equal(c.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(c.headers.authorization, "Bearer sk-or-KEY");
  assert.equal(c.body.messages[0].role, "system");
  assert.equal(c.body.tools[0].function.name, "run_shell");
  assert.equal(c.body.messages[2].tool_calls[0].function.arguments, '{"command":"df -h"}');
  assert.deepEqual(c.body.messages.slice(3).map((m) => m.role + ":" + m.tool_call_id), ["tool:c1", "tool:c2"]);
});

test("llm: bad JSON in tool arguments is flagged, not thrown", async () => {
  const { f } = spy({ choices: [{ message: { content: null, tool_calls: [{ id: "t", function: { name: "run_shell", arguments: "{oops" } }] } }] });
  const r = await chatTurn("openai", "k", "m", { messages: [{ role: "user", content: "x" }], tools: TOOLS }, { fetch: f });
  assert.ok(r.toolCalls[0].args.__badJson);
  assert.equal(r.text, "");
});

test("llm Anthropic: system on top, tool results merged into ONE user message, tool_use parsed", async () => {
  const { f, calls } = spy({ content: [{ type: "text", text: "hi" }, { type: "tool_use", id: "u1", name: "run_shell", input: { command: "ls" } }] });
  const r = await chatTurn("anthropic", "sk-ant-KEY", "claude-x", { system: "SYS", messages: HISTORY, tools: TOOLS }, { fetch: f });
  assert.deepEqual(r, { text: "hi", toolCalls: [{ id: "u1", name: "run_shell", args: { command: "ls" } }] });
  const c = calls[0];
  assert.equal(c.headers["x-api-key"], "sk-ant-KEY");
  assert.equal(c.body.system, "SYS");
  assert.equal(c.body.tools[0].input_schema.type, "object");
  assert.equal(c.body.messages.length, 3);
  assert.equal(c.body.messages[2].content.length, 2);
  assert.equal(c.body.messages[2].content[1].tool_use_id, "c2");
  assert.equal(c.body.messages[1].content[1].type, "tool_use");
});

test("llm Gemini: key in header, systemInstruction, functionResponse merged, functionCall parsed", async () => {
  const { f, calls } = spy({ candidates: [{ content: { parts: [{ text: "ok" }, { functionCall: { name: "run_shell", args: { command: "ls" } } }] } }] });
  const r = await chatTurn("gemini", "AIza-KEY", "gemini-x", { system: "SYS", messages: HISTORY, tools: TOOLS }, { fetch: f });
  assert.equal(r.toolCalls[0].name, "run_shell");
  assert.deepEqual(r.toolCalls[0].args, { command: "ls" });
  assert.ok(r.toolCalls[0].id);
  const c = calls[0];
  assert.ok(!c.url.includes("AIza-KEY"));
  assert.equal(c.headers["x-goog-api-key"], "AIza-KEY");
  assert.equal(c.body.systemInstruction.parts[0].text, "SYS");
  assert.equal(c.body.tools[0].functionDeclarations[0].name, "run_shell");
  assert.equal(c.body.contents.length, 3);
  assert.equal(c.body.contents[2].parts.length, 2);
  assert.equal(c.body.contents[1].role, "model");
});

// ---- agent loop with a scripted model ----
const script = (...turns) => {
  const seen = [];
  const chat = async (_p, _k, _m, opts) => {
    seen.push(JSON.parse(JSON.stringify(opts.messages)));
    const t = turns.shift();
    if (t instanceof Error) throw t;
    return t;
  };
  return { chat, seen };
};
const call = (command, extra = {}) => ({ id: "c" + Math.random().toString(36).slice(2, 6), name: "run_shell", args: { command, ...extra } });
const base = (over) => ({ messages: [], userText: "go", provider: "openrouter", key: "k", model: "m", out: () => {}, env: { ...process.env, TUT_HOME: tmp() }, ...over });

test("agent: approved command runs for real, output goes back to the model, then the answer", async () => {
  const { chat, seen } = script({ text: "Checking.", toolCalls: [call("node -v")] }, { text: "Node is installed.", toolCalls: [] });
  const printed = [];
  const asked = [];
  const messages = [];
  const r = await runAgent(base({ messages, chat, out: (s) => printed.push(s), approve: async (x) => (asked.push(x.command), true) }));
  assert.equal(r.done, true);
  assert.deepEqual(asked, ["node -v"]);
  assert.deepEqual(messages.map((m) => m.role), ["user", "assistant", "tool", "assistant"]);
  assert.match(messages[2].content, /Exit code: 0/);
  assert.match(messages[2].content, new RegExp(process.version.replace(".", "\\.").slice(0, 3)));
  assert.match(printed.join(""), /Node is installed/);
  assert.equal(seen[1].at(-1).role, "tool", "second model call sees the real output");
});

test("agent: a refused command is NOT run and the model is told", async () => {
  const dir = tmp();
  const marker = path.join(dir, "m.txt").replace(/\\/g, "/");
  const { chat } = script({ text: "", toolCalls: [call(`node -e "require('fs').writeFileSync('${marker}','x')"`)] }, { text: "ok, not doing it", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat, approve: async () => false }));
  assert.equal(fs.existsSync(marker), false);
  assert.match(messages[2].content, /refused/);
});

test("agent: no approver (no terminal) means nothing runs", async () => {
  const { chat } = script({ text: "", toolCalls: [call("node -v")] }, { text: "done", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat }));
  assert.match(messages[2].content, /NOT run/);
});

test("agent: failing command reports its exit code and stderr", async () => {
  const { chat } = script({ text: "", toolCalls: [call('node -e "console.error(\'boom\'); process.exit(3)"')] }, { text: "failed", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat, approve: async () => true }));
  assert.match(messages[2].content, /Exit code: 3/);
  assert.match(messages[2].content, /boom/);
});

test("agent: a command that runs too long is stopped at the timeout", async () => {
  const { chat } = script({ text: "", toolCalls: [call('node -e "setTimeout(function(){},60000)"', { timeout_seconds: 1 })] }, { text: "ok", toolCalls: [] });
  const messages = [];
  const t0 = Date.now();
  await runAgent(base({ messages, chat, approve: async () => true }));
  assert.match(messages[2].content, /Timed out after 1s/);
  assert.ok(Date.now() - t0 < 15000);
});

test("agent: huge output is cut before it goes to the model", async () => {
  const { chat } = script({ text: "", toolCalls: [call(`node -e "console.log('x'.repeat(20000))"`)] }, { text: "ok", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat, approve: async () => true }));
  assert.match(messages[2].content, /characters cut/);
  assert.ok(messages[2].content.length < 10000);
});

test("agent: the command never sees the user's API keys", async () => {
  const { chat } = script({ text: "", toolCalls: [call(`node -e "console.log(process.env.OPENROUTER_API_KEY === undefined ? 'clean' : 'LEAK')"`)] }, { text: "ok", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat, approve: async () => true, env: { ...process.env, OPENROUTER_API_KEY: "sk-or-secret", TUT_HOME: tmp() } }));
  assert.match(messages[2].content, /clean/);
  assert.doesNotMatch(messages[2].content, /LEAK|sk-or-secret/);
});

test("agent: stops at the step limit; a failed request leaves the history clean", async () => {
  const forever = () => ({ text: "", toolCalls: [call("node -v")] });
  const s1 = script(forever(), forever(), forever(), forever());
  const messages = [];
  const r = await runAgent(base({ messages, chat: s1.chat, approve: async () => true, maxSteps: 3 }));
  assert.equal(r.limit, true);
  assert.equal(messages.filter((m) => m.role === "tool").length, 3);

  const s2 = script(new Error("network down"));
  const m2 = [{ role: "user", content: "earlier" }];
  await assert.rejects(runAgent(base({ messages: m2, chat: s2.chat })), /network down/);
  assert.equal(m2.length, 1);
});

test("agent: Ctrl+C during approval stops cleanly and the history stays valid", async () => {
  const ctrl = new AbortController();
  const { chat } = script({ text: "", toolCalls: [call("node -v")] });
  const messages = [];
  const r = await runAgent(base({ messages, chat, signal: ctrl.signal, approve: async () => (ctrl.abort(), true) }));
  assert.equal(r.stopped, true);
  assert.equal(messages.at(-1).role, "tool");
  assert.match(messages.at(-1).content, /Stopped/);
});

test("agent: job_logs says so when the background service is not running; unknown tools are refused", async () => {
  const { chat } = script({ text: "", toolCalls: [{ id: "j", name: "job_logs", args: { id: 1 } }, { id: "z", name: "format_disk", args: {} }] }, { text: "ok", toolCalls: [] });
  const messages = [];
  await runAgent(base({ messages, chat }));
  assert.match(messages[2].content, /not running/);
  assert.match(messages[3].content, /unknown tool/);
});

test("session: tells the user what to do when no provider or model is set up", async () => {
  const env = { TUT_HOME: tmp(), PATH: process.env.PATH };
  await assert.rejects(createSession(env).run("hi"), /tut setup/);
  setApiKey("openrouter", "sk-or-v1-abcdefghijklmnop", env);
  saveConfig({ provider: "openrouter" }, env);
  await assert.rejects(createSession(env).run("hi"), /tut models/);
});
