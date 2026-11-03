// The background service (daemon). Keeps jobs alive after the terminal or SSH closes.
// Listens on a local socket only. Protocol: one JSON line in, one JSON line out.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { tutHome } from "./config.js";
import { IS_WIN, cleanupFiles, endpointFor, killTree, logsDir, ping, statePath } from "./service-client.js";

export async function runService(env = process.env) {
  if (await ping(env)) process.exit(0); // already running
  fs.mkdirSync(tutHome(env), { recursive: true, mode: 0o700 });
  fs.mkdirSync(logsDir(env), { recursive: true, mode: 0o700 });
  cleanupFiles(env);
  const endpoint = endpointFor(env);
  const started = Date.now();
  const jobs = new Map();
  let nextId = 1;

  const running = () => [...jobs.values()].filter((j) => j.status === "running");
  const saveState = () =>
    fs.writeFileSync(statePath(env), JSON.stringify({ pid: process.pid, endpoint, started, jobs: running().map((j) => ({ id: j.id, pid: j.pid })) }), { mode: 0o600 });
  const pub = (j) => ({ id: j.id, command: j.command, pid: j.pid, status: j.status, exitCode: j.exitCode, startedAt: j.startedAt });

  function startJob({ command, cwd }) {
    const id = nextId++;
    const logFile = path.join(logsDir(env), `job-${id}.log`);
    const fd = fs.openSync(logFile, "a", 0o600);
    const job = { id, command, pid: null, status: "running", exitCode: null, startedAt: Date.now(), logFile };
    jobs.set(id, job);
    const child = spawn(command, { shell: true, cwd: cwd || undefined, detached: !IS_WIN, stdio: ["ignore", fd, fd], windowsHide: true, env: process.env });
    fs.closeSync(fd);
    job.pid = child.pid ?? null;
    child.on("error", (e) => {
      job.status = "failed";
      fs.appendFileSync(logFile, `tut: could not start: ${e.message}\n`);
      saveState();
    });
    child.on("exit", (code, signal) => {
      if (job.status === "running") job.status = signal ? "killed" : "exited";
      job.exitCode = code;
      saveState();
    });
    saveState();
    return job;
  }

  function tail(file, lines) {
    try {
      return fs.readFileSync(file, "utf8").split("\n").slice(-lines - 1).join("\n");
    } catch {
      return "";
    }
  }

  async function handle(msg) {
    switch (msg.cmd) {
      case "ping":
        return { ok: true, pid: process.pid, started, rss: process.memoryUsage().rss, jobs: running().length };
      case "status":
        return { ok: true, pid: process.pid, started, rss: process.memoryUsage().rss, jobs: [...jobs.values()].map(pub) };
      case "job-start": {
        if (typeof msg.command !== "string" || !msg.command.trim()) return { ok: false, error: "no command given" };
        return { ok: true, job: pub(startJob({ command: msg.command, cwd: msg.cwd })) };
      }
      case "job-stop": {
        const j = jobs.get(Number(msg.id));
        if (!j) return { ok: false, error: `no job ${msg.id}` };
        if (j.status === "running") {
          j.status = "killed";
          killTree(j.pid);
          saveState();
        }
        return { ok: true, job: pub(j) };
      }
      case "logs": {
        const j = jobs.get(Number(msg.id));
        if (!j) return { ok: false, error: `no job ${msg.id}` };
        return { ok: true, text: tail(j.logFile, Math.min(Number(msg.lines) || 200, 5000)) };
      }
      case "stop":
        return { ok: true, stopping: true };
      default:
        return { ok: false, error: "unknown command" };
    }
  }

  const server = net.createServer((sock) => {
    let buf = "";
    sock.on("error", () => {});
    sock.on("data", async (d) => {
      buf += d;
      const i = buf.indexOf("\n");
      if (i < 0) return;
      let reply;
      let msg;
      try {
        msg = JSON.parse(buf.slice(0, i));
        reply = await handle(msg);
      } catch (e) {
        reply = { ok: false, error: e.message };
      }
      buf = "";
      sock.end(JSON.stringify(reply) + "\n", () => {
        if (msg?.cmd === "stop") shutdown();
      });
    });
  });

  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    for (const j of running()) killTree(j.pid);
    server.close();
    cleanupFiles(env);
    setTimeout(() => process.exit(0), 100);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGHUP", () => {}); // survive the terminal closing

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, resolve);
  });
  if (!IS_WIN) fs.chmodSync(endpoint, 0o600);
  saveState();
}
