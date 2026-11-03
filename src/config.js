// Config and key store (WO-2). Zero dependencies.
//   ~/.tut/config.json  provider, model, permissionMode (no secrets)
//   ~/.tut/keys.json    API keys, file mode 600 (Linux/macOS)
// Environment variables always win over the keys file. TUT_HOME changes the folder (used by tests).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PROVIDERS, providerById } from "./providers-meta.js";

const IS_WIN = process.platform === "win32";
const DEFAULTS = { version: 1, provider: null, model: null, permissionMode: "ask" };

export const tutHome = (env = process.env) =>
  env.TUT_HOME ? path.resolve(env.TUT_HOME) : path.join(os.homedir(), ".tut");
export const configPath = (env = process.env) => path.join(tutHome(env), "config.json");
export const keysPath = (env = process.env) => path.join(tutHome(env), "keys.json");

function ensureHome(env) {
  const dir = tutHome(env);
  const existed = fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!existed && !IS_WIN) fs.chmodSync(dir, 0o700);
  return dir;
}

function readJson(file, fallback) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return data;
  } catch {
    throw new Error(`tut: ${file} is not valid JSON. Fix it by hand or delete it, then run: tut setup`);
  }
}

// Write to a temp file (private from the start), then rename over the real file.
function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  if (!IS_WIN) fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

// Returns true if the file was group/world accessible and has been tightened to 600.
export function tightenIfLoose(file) {
  if (IS_WIN) return false;
  try {
    const mode = fs.statSync(file).mode & 0o777;
    if (mode & 0o077) {
      fs.chmodSync(file, 0o600);
      return true;
    }
  } catch {
    /* file missing: nothing to do */
  }
  return false;
}

export function loadConfig(env = process.env) {
  return { ...DEFAULTS, ...readJson(configPath(env), {}) };
}

export function saveConfig(patch, env = process.env) {
  ensureHome(env);
  const next = { ...loadConfig(env), ...patch };
  writeJsonAtomic(configPath(env), next);
  return next;
}

function loadKeys(env) {
  const file = keysPath(env);
  if (tightenIfLoose(file)) console.error(`tut: ${file} was readable by other users; permissions fixed (600).`);
  return readJson(file, {});
}

export function validateKeyFormat(key) {
  const k = String(key ?? "").trim();
  if (k.length < 8) throw new Error("That key looks too short. Paste the full API key.");
  if (/\s/.test(k)) throw new Error("A key has no spaces. Paste only the key itself.");
  return k;
}

export function setApiKey(providerId, key, env = process.env) {
  if (!providerById(providerId)) throw new Error(`Unknown provider: ${providerId}`);
  const clean = validateKeyFormat(key);
  ensureHome(env);
  const keys = loadKeys(env);
  keys[providerId] = clean;
  writeJsonAtomic(keysPath(env), keys);
}

export function removeApiKey(providerId, env = process.env) {
  const keys = loadKeys(env);
  if (!(providerId in keys)) return false;
  delete keys[providerId];
  writeJsonAtomic(keysPath(env), keys);
  return true;
}

// -> { key, source: "env" | "file" | null, envVar? }
export function getApiKey(providerId, env = process.env) {
  const p = providerById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);
  for (const name of p.envVars) {
    const val = (env[name] ?? "").trim();
    if (val) return { key: val, source: "env", envVar: name };
  }
  const saved = String(loadKeys(env)[providerId] ?? "").trim();
  return saved ? { key: saved, source: "file" } : { key: null, source: null };
}

// Provider in use: TUT_PROVIDER, else the saved choice, else the first provider that has a key in the environment.
export function resolveProvider(env = process.env) {
  if (env.TUT_PROVIDER) {
    if (!providerById(env.TUT_PROVIDER)) {
      throw new Error(`TUT_PROVIDER=${env.TUT_PROVIDER} is not valid. Use one of: ${PROVIDERS.map((p) => p.id).join(", ")}`);
    }
    return env.TUT_PROVIDER;
  }
  const saved = loadConfig(env).provider;
  if (saved && providerById(saved)) return saved;
  for (const p of PROVIDERS) if (getApiKey(p.id, env).source === "env") return p.id;
  return null;
}

export function isConfigured(env = process.env) {
  const id = resolveProvider(env);
  return Boolean(id && getApiKey(id, env).key);
}

// Never print a whole key. Shows the first 3 and last 4 characters only.
export function maskKey(key) {
  if (!key) return "";
  return key.length >= 12 ? `${key.slice(0, 3)}...${key.slice(-4)}` : "****";
}
