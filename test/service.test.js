import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { endpointFor, ensureService, isAlive, killService, ping, readState, request, sleep, statePath } from "../src/service-client.js";
import { statusCommand, jobCommand, logsCommand } from "../src/service-cli.js";

const POSIX = process.platform !== "win32";
const LONG = 'node -e "setTimeout(function(){},600000)"'; // works on Windows, Linux, macOS
const killBin = fileURLToPath(new URL("../bin/tut-kill.js", import.meta.url));
const mkenv = () => ({ ...process.env, TUT_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "tut-svc-")) });
const capture = () => {
  const lines = [];
  return { out: (s) => lines.push(String(s)), text: () => lines.join("\n") };
};

test("endpoint: named pipe on Windows style, socket file otherwise; stable per folder", () => {
  const a = endpointFor({ TUT_HOME: path.join(os.tmpdir(), "x1") });
  const b = endpointFor({ TUT_HOME: path.join(os.tmpdir(), "x2") });
  assert.notEqual(a, b);
  assert.equal(a, endpointFor({ TUT_HOME: path.join(os.tmpdir(), "x1") }));
  if (POSIX) assert.ok(a.endsWith("tut.sock"));
});

test("tut-kill with no service: says so, exits 0", () => {
  const r = spawnSync(process.execPath, [killBin], { encoding: "utf8", env: mkenv() });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Nothing to stop/);
});

test("service: start once, jobs run, logs work, tut-kill leaves nothing behind", async () => {
  const env = mkenv();
  let svc;
  try {
    svc = await ensureService(env);
    assert.equal(svc.started, true);
    const again = await ensureService(env);
    assert.equal(again.started, false);
    assert.equal(again.pid, svc.pid, "second start reuses the same service");
    if (POSIX) assert.equal(fs.statSync(endpointFor(env)).mode & 0o777, 0o600);
    assert.ok(svc.rss < 120 * 1048576, "idle service stays small");

    const longJob = capture();
    assert.equal(await jobCommand(["start", LONG], env, longJob.out), 0);
    const quick = capture();
    assert.equal(await jobCommand(["start", "echo", "hello-from-job"], env, quick.out), 0);
    await sleep(500);

    const st = capture();
    await statusCommand(env, st.out);
    assert.match(st.text(), /running/);
    assert.match(st.text(), /setTimeout/);
    const lg = capture();
    assert.equal(await logsCommand(["2"], env, lg.out), 0);
    assert.match(lg.text(), /hello-from-job/);

    const jobPid = (await request({ cmd: "status" }, { env })).jobs.find((j) => j.id === 1).pid;
    assert.ok(isAlive(jobPid));
    assert.ok(readState(env).jobs.some((j) => j.pid === jobPid));

    const r = await killService(env);
    assert.equal(r.running, true);
    assert.equal(r.forced, false);
    assert.equal(r.jobs, 1);
    await sleep(300);
    assert.equal(isAlive(svc.pid), false, "service gone");
    assert.equal(isAlive(jobPid), false, "job gone");
    assert.equal(fs.existsSync(statePath(env)), false, "state file removed");
    if (POSIX) assert.equal(fs.existsSync(endpointFor(env)), false, "socket removed");
    assert.equal(await ping(env), null);
  } finally {
    await killService(env);
  }
});

test("job stop stops one job only; bad ids and empty commands are handled", async () => {
  const env = mkenv();
  try {
    const c = capture();
    assert.equal(await jobCommand(["start"], env, c.out), 2);
    await jobCommand(["start", LONG], env, c.out);
    assert.equal(await jobCommand(["stop", "99"], env, c.out), 1);
    assert.equal(await jobCommand(["stop", "1"], env, c.out), 0);
    const st = await request({ cmd: "status" }, { env });
    assert.equal(st.jobs[0].status, "killed");
    assert.equal(st.pid > 0, true, "service itself keeps running");
  } finally {
    await killService(env);
  }
});

test("a stale state file (service not running) is cleaned up, nothing is killed", async () => {
  const env = mkenv();
  fs.writeFileSync(path.join(env.TUT_HOME, "service.json"), JSON.stringify({ pid: process.pid, jobs: [{ id: 1, pid: process.pid }] }));
  const r = await killService(env);
  assert.equal(r.running, false);
  assert.equal(r.stale, true);
  assert.equal(isAlive(process.pid), true, "an unrelated process with that pid is left alone");
  assert.equal(fs.existsSync(statePath(env)), false);
});

test("status when nothing runs does not start the service", async () => {
  const env = mkenv();
  const c = capture();
  assert.equal(await statusCommand(env, c.out), 0);
  assert.match(c.text(), /not running/);
  assert.equal(await ping(env), null);
});
