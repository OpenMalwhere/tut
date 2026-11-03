#!/usr/bin/env node
import readline from "node:readline";
import { VERSION } from "../src/version.js";
import { helpText } from "../src/help.js";
import { renderLogo, detectColorLevel } from "../src/logo.js";
import { isConfigured, loadConfig } from "../src/config.js";
import { modelsCommand, testCommand, selectAndSaveModel } from "../src/model-cli.js";
import { configCommand } from "../src/config-cli.js";
import { runOnboarding } from "../src/onboarding.js";
import { promptText, paint } from "../src/ui.js";
import { statusCommand, jobCommand, logsCommand } from "../src/service-cli.js";
import { ensureService } from "../src/service-client.js";
import { createSession } from "../src/agent-cli.js";
import { ask } from "../src/prompt.js";

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

function fail(e) {
  console.error(e?.message ?? String(e));
  process.exit(1);
}

const args = process.argv.slice(2);
const has = (...flags) => args.some((a) => flags.includes(a));

if (has("--version", "-v")) {
  console.log(VERSION);
  process.exit(0);
}

if (has("--help", "-h") || args[0] === "help") {
  process.stdout.write(helpText());
  process.exit(0);
}

if (args[0] === "logo") {
  const flag = args.find((a) => a.startsWith("--color="));
  const map = { truecolor: "truecolor", "256": "ansi256", plain: "plain" };
  const level = flag ? map[flag.split("=")[1]] : detectColorLevel();
  if (!level) {
    console.error("tut: --color must be truecolor, 256 or plain");
    process.exit(2);
  }
  console.log(renderLogo(level, { version: VERSION }));
  process.exit(0);
}

if (args[0] === "config") {
  try {
    process.exit(configCommand(args.slice(1)));
  } catch (e) {
    fail(e);
  }
}

if (args[0] === "models" || args[0] === "test") {
  try {
    process.exit(args[0] === "models" ? await modelsCommand(args.slice(1)) : await testCommand());
  } catch (e) {
    if (e.code === "CANCELLED") process.exit(1);
    fail(e);
  }
}

if (args[0] === "status" || args[0] === "job" || args[0] === "logs") {
  try {
    const run = { status: () => statusCommand(), job: () => jobCommand(args.slice(1)), logs: () => logsCommand(args.slice(1)) };
    process.exit(await run[args[0]]());
  } catch (e) {
    fail(e);
  }
}

if (args[0] === "ask") {
  const task = args.slice(1).join(" ").trim();
  if (!task) {
    console.error("Usage: tut ask <what you want done>   (example: tut ask show free disk space)");
    process.exit(2);
  }
  if (!interactive) {
    console.error("tut: ask needs an interactive terminal, because every command needs your approval.");
    process.exit(2);
  }
  try {
    const approve = async ({ command }) => /^y/i.test(await ask("Run it? [y/N] "));
    await createSession().run(task, { approve });
    process.exit(0);
  } catch (e) {
    if (e.code === "CANCELLED") process.exit(1);
    fail(e);
  }
}

if (args[0] === "setup") {
  if (!interactive) {
    console.error("tut: setup needs an interactive terminal. Or set an API key environment variable, for example OPENROUTER_API_KEY.");
    process.exit(2);
  }
  try {
    const r = await runOnboarding();
    process.exit(r.cancelled ? 1 : 0);
  } catch (e) {
    fail(e);
  }
}

if (args.length && !has("--no-logo")) {
  console.error(`tut: unknown command or option: ${args[0]}\nTry: tut --help`);
  process.exit(2);
}

// ---- interactive session (REPL stub; the agent arrives in later work orders) ----
// Start with a clean screen (real terminals only).
if (process.stdout.isTTY) process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
if (!has("--no-logo") && process.stdout.isTTY) {
  console.log(renderLogo(detectColorLevel(), { version: VERSION }));
  console.log("");
}
// First run: no provider and key yet -> guided setup (needs a real terminal; otherwise just hint).
try {
  if (!isConfigured()) {
    if (interactive) {
      const r = await runOnboarding();
      if (r.cancelled) process.exit(0);
    } else {
      console.error("tut: no provider configured yet. Run `tut setup` in a terminal, or set an API key environment variable.");
    }
  }
  // Key saved but no model yet (for example a key saved before models were supported).
  if (isConfigured() && !loadConfig().model) {
    if (interactive) {
      try {
        await selectAndSaveModel();
      } catch (e) {
        if (e.code === "CANCELLED") process.exit(0);
        console.error(`${e.message}\nContinuing without a model. Run \`tut models\` to try again.`);
      }
    } else console.error("tut: no model chosen yet. Run `tut models` in a terminal.");
  }
} catch (e) {
  if (e.code === "CANCELLED") process.exit(0);
  fail(e);
}
// Start the background service (first `tut` starts it; `tut-kill` stops it). Real terminals only.
if (interactive && !process.env.TUT_NO_SERVICE) {
  try {
    const svc = await ensureService();
    console.log(paint("grey", `Background service ${svc.started ? "started" : "running"} (pid ${svc.pid}). Stop everything with tut-kill.`));
  } catch (e) {
    console.error(`tut: ${e.message}. Continuing without the background service.`);
  }
}
console.log("Type a task in plain words, or 'exit' to quit. Every command asks your permission first.");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "tut> ",
});
// Two-line prompt: print line 1 ourselves and give readline only line 2.
// (A "\n" inside a readline prompt breaks its cursor maths and garbles the screen.)
const showPrompt = () => {
  const [first, second] = promptText().split("\n");
  process.stdout.write(first + "\n");
  rl.setPrompt(second);
  rl.prompt();
};

const session = createSession();
let busy = false;
let ctrl = null;
let pendingAnswer = null; // set while we wait for a y/n approval

const approve = ({ command }) =>
  new Promise((resolve) => {
    pendingAnswer = (line) => resolve(/^y/i.test(line.trim()));
    ctrl?.signal.addEventListener("abort", () => resolve(false), { once: true });
    rl.setPrompt(paint("gold", "Run it? [y/N] "));
    rl.prompt();
  });

showPrompt();
rl.on("line", async (line) => {
  if (pendingAnswer) {
    const answer = pendingAnswer;
    pendingAnswer = null;
    answer(line);
    return;
  }
  if (busy) return;
  const text = line.trim();
  if (text === "exit" || text === "quit") {
    rl.close();
    return;
  }
  if (/^(tut\s|models$|test$|setup$|config$)/.test(text)) {
    console.log(paint("grey", "That is a PowerShell command. Type exit first, then run it there."));
  } else if (text) {
    busy = true;
    ctrl = new AbortController();
    try {
      await session.run(text, { approve, signal: ctrl.signal });
    } catch (e) {
      console.log(paint("red", e.message));
    }
    pendingAnswer = null;
    busy = false;
    ctrl = null;
  }
  showPrompt();
});
rl.on("SIGINT", () => {
  if (busy && ctrl) {
    ctrl.abort();
    pendingAnswer = null;
    console.log(paint("grey", "\n(stopping...)"));
    return;
  }
  console.log("");
  rl.close();
});
rl.on("close", () => process.exit(0));
// Ctrl+C when stdin is not a TTY (pipes, kill -INT): exit cleanly too.
process.on("SIGINT", () => {
  console.log("");
  process.exit(0);
});
