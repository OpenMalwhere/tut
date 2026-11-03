// tut status, tut job ..., tut logs <id>
import { ensureService, ping, request } from "./service-client.js";
import { paint } from "./ui.js";

const ago = (ms) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const mb = (b) => `${Math.round(b / 1048576)} MB`;

export async function statusCommand(env = process.env, out = console.log) {
  const up = await ping(env);
  if (!up) {
    out("Background service: not running. It starts the first time you run `tut`.");
    return 0;
  }
  const r = await request({ cmd: "status" }, { env });
  out(`Background service: ${paint("green", "running")} (pid ${r.pid}, up ${ago(Date.now() - r.started)}, ${mb(r.rss)}). Stop it with tut-kill.`);
  if (!r.jobs.length) out("No jobs.");
  for (const j of r.jobs) out(`  #${j.id}  ${j.status.padEnd(7)}  pid ${j.pid ?? "-"}  ${j.command}`);
  return 0;
}

export async function jobCommand(args, env = process.env, out = console.log) {
  const [sub, ...rest] = args;
  if (sub === "list" || !sub) return statusCommand(env, out);
  if (sub === "start") {
    const command = rest.join(" ").trim();
    if (!command) {
      out("Usage: tut job start <command>   (example: tut job start sleep 600)");
      return 2;
    }
    await ensureService(env);
    const r = await request({ cmd: "job-start", command, cwd: process.cwd() }, { env });
    if (!r.ok) throw new Error(r.error);
    out(`Started job #${r.job.id} (pid ${r.job.pid}). It keeps running if you close this terminal. See: tut status, tut logs ${r.job.id}`);
    return 0;
  }
  if (sub === "stop") {
    if (!(await ping(env))) {
      out("Background service is not running.");
      return 1;
    }
    const r = await request({ cmd: "job-stop", id: rest[0] }, { env });
    if (!r.ok) {
      out(`tut: ${r.error}`);
      return 1;
    }
    out(`Stopped job #${r.job.id}.`);
    return 0;
  }
  out("Usage: tut job start <command> | tut job stop <id> | tut job list");
  return 2;
}

export async function logsCommand(args, env = process.env, out = console.log) {
  const id = args.find((a) => /^\d+$/.test(a));
  const n = args.find((a) => a.startsWith("--lines="));
  if (!id) {
    out("Usage: tut logs <job id> [--lines=200]");
    return 2;
  }
  if (!(await ping(env))) {
    out("Background service is not running.");
    return 1;
  }
  const r = await request({ cmd: "logs", id, lines: n ? Number(n.split("=")[1]) : 200 }, { env });
  if (!r.ok) {
    out(`tut: ${r.error}`);
    return 1;
  }
  out(r.text.replace(/\n$/, ""));
  return 0;
}
