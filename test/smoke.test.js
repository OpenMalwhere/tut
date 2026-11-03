import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = fileURLToPath(new URL("../bin/tut.js", import.meta.url));
const killBin = fileURLToPath(new URL("../bin/tut-kill.js", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const testHome = mkdtempSync(join(tmpdir(), "tut-smoke-"));
const baseEnv = { ...process.env, TUT_HOME: testHome };
const run = (args, opts = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", env: baseEnv, ...opts });

test("--version prints the package version", () => {
  const r = run(["--version"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test("--help shows usage and exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stdout, /tut-kill/);
});

test("unknown option exits 2 with a hint", () => {
  const r = run(["--nope"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command or option/);
});

test("logo: truecolor, 256 and plain modes", () => {
  const tc = run(["logo", "--color=truecolor"]).stdout;
  const c256 = run(["logo", "--color=256"]).stdout;
  const plain = run(["logo", "--color=plain"]).stdout;
  assert.match(tc, /\x1b\[[0-9;]*38;2;/);
  assert.match(c256, /\x1b\[[0-9;]*38;5;/);
  assert.doesNotMatch(plain, /\x1b/);
  assert.match(plain, /T u T - C u r e s/);
  for (const out of [tc, c256, plain]) assert.match(out, /your terminal doctor/);
});

test("NO_COLOR forces the plain logo", () => {
  const r = run(["logo"], { env: { ...process.env, NO_COLOR: "1" } });
  assert.doesNotMatch(r.stdout, /\x1b/);
});

test("REPL exits cleanly on 'exit'", () => {
  const r = run([], { input: "hello\nexit\n" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /tut setup/); // no provider yet: tells the user what to do
});

// On Windows, child.kill("SIGINT") force-terminates the child (exit code null), so this check only makes sense on Linux/macOS.
test("REPL exits cleanly on Ctrl+C (SIGINT)", { skip: process.platform === "win32" }, async () => {
  const child = spawn(process.execPath, [bin], { stdio: ["pipe", "pipe", "pipe"], env: baseEnv });
  await new Promise((res) => setTimeout(res, 600));
  child.kill("SIGINT");
  const code = await new Promise((res) => child.on("exit", res));
  assert.equal(code, 0);
});

test("tut-kill with nothing running exits 0 and says so", () => {
  const r = spawnSync(process.execPath, [killBin], { encoding: "utf8", env: baseEnv });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Nothing to stop|No background service/);
});
