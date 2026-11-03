// Talks to the TuT background service over a LOCAL socket only (Unix socket 0600 / Windows named pipe). No TCP.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tutHome } from "./config.js";

export const IS_WIN = process.platform === "win32";
const SERVICE_BIN = fileURLToPath(new URL("../bin/tut-service.js", import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function endpointFor(env = process.env) {
  const home = tutHome(env);
  if (IS_WIN) return `\\\\.\\pipe\\tut-cures-${crypto.createHash("sha1").update(home.toLowerCase()).digest("hex").slice(0, 12)}`;
  return path.join(home, "tut.sock");
}
export const statePath = (env = process.env) => path.join(tutHome(env), "service.json");
export const logsDir = (env = process.env) => path.join(tutHome(env), "logs");

export function readState(env = process.env) {
  try {
    return JSON.parse(fs.readFileSync(statePath(env), "utf8"));
  } catch {
    return null;
  }
}
export function cleanupFiles(env = process.env) {
  if (!IS_WIN) fs.rmSync(endpointFor(env), { force: true });
  fs.rmSync(statePath(env), { force: true });
}
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
// Kill a process and everything it started.
export function killTree(pid) {
  if (!pid) return;
  if (IS_WIN) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  try { process.kill(-pid, "SIGKILL"); } catch {}
  try { process.kill(pid, "SIGKILL"); } catch {}
}

export function request(msg, { env = process.env, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const s = net.connect(endpointFor(env));
    let buf = "";
    const t = setTimeout(() => {
      s.destroy();
      reject(new Error("the background service did not answer"));
    }, timeout);
    s.on("connect", () => s.write(JSON.stringify(msg) + "\n"));
    s.on("data", (d) => {
      buf += d;
      const i = buf.indexOf("\n");
      if (i >= 0) {
        clearTimeout(t);
        s.end();
        try { resolve(JSON.parse(buf.slice(0, i))); } catch (e) { reject(e); }
      }
    });
    s.on("error", (e) => { clearTimeout(t); reject(e); });
  });
}

export async function ping(env = process.env) {
  try {
    const r = await request({ cmd: "ping" }, { env, timeout: 1500 });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

// Start the background service if it is not running. Returns its ping reply (+ started: true/false).
export async function ensureService(env = process.env) {
  const up = await ping(env);
  if (up) return { ...up, started: false };
  cleanupFiles(env);
  const child = spawn(process.execPath, [SERVICE_BIN], { detached: true, stdio: "ignore", windowsHide: true, env });
  child.unref();
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    const r = await ping(env);
    if (r) return { ...r, started: true };
  }
  throw new Error("the background service did not start");
}

// tut-kill: stop the service and every job it started. Only force-kills a process that really answered as our service.
export async function killService(env = process.env) {
  const st = readState(env);
  const up = await ping(env);
  if (!up) {
    cleanupFiles(env);
    return { running: false, stale: Boolean(st) };
  }
  const jobs = (st?.jobs ?? []).slice();
  try { await request({ cmd: "stop" }, { env, timeout: 5000 }); } catch {}
  for (let i = 0; i < 50 && isAlive(up.pid); i++) await sleep(100);
  let forced = false;
  if (isAlive(up.pid)) {
    forced = true;
    for (const j of jobs) killTree(j.pid);
    killTree(up.pid);
    await sleep(300);
  }
  cleanupFiles(env);
  return { running: true, pid: up.pid, jobs: jobs.length, forced };
}
