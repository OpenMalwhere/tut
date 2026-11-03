// Tiny colour + layout helpers. No dependencies. NO_COLOR / non-TTY -> plain text.
import os from "node:os";

export function colorOn(out = process.stdout, env = process.env) {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR) return true;
  return Boolean(out.isTTY);
}

const CODES = { gold: "38;5;220", green: "38;5;40", blue: "38;5;75", red: "38;5;203", grey: "38;5;245", cyan: "38;5;51", bold: "1" };

export function paint(name, text, on = colorOn()) {
  return on ? `\x1b[${CODES[name]}m${text}\x1b[0m` : String(text);
}

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
export const visibleLength = (s) => [...strip(s)].length;

// Lay items out in columns that fit the terminal. Few items -> one per line.
// Items are filled top-to-bottom, then left-to-right (like `ls`).
export function columns(items, width = process.stdout.columns || 80, { gap = 2, minForColumns = 12 } = {}) {
  if (items.length < minForColumns) return items.map((s) => `  ${s}`);
  const w = Math.max(...items.map(visibleLength)) + gap;
  const per = Math.max(1, Math.floor((width - 2) / w));
  if (per === 1) return items.map((s) => `  ${s}`);
  const rows = Math.ceil(items.length / per);
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = " ";
    for (let c = 0; c < per; c++) {
      const s = items[c * rows + r];
      if (s === undefined) continue;
      line += " " + s + " ".repeat(Math.max(0, w - visibleLength(s) - 1));
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

// Kali-style two-line prompt:
// ┌──(user 𒁈 host)-[~/folder]
// └─TuT::@ 
export function promptText({ on = colorOn(), user = safeUser(), host = os.hostname().split(".")[0], cwd = process.cwd() } = {}) {
  const home = os.homedir();
  const dir = cwd === home ? "~" : cwd.startsWith(home) ? "~" + cwd.slice(home.length).replace(/\\/g, "/") : cwd;
  const b = (s) => paint("blue", s, on);
  return `${b("┌──(")}${paint("gold", user, on)}  ${b("𒁈")}  ${paint("gold", host, on)}${b(")-[")}${paint("bold", dir, on)}${b("]")}\n${b("└─")}${paint("gold", "TuT", on)}${b("::@")} `;
}

function safeUser() {
  try { return os.userInfo().username; } catch { return process.env.USERNAME || process.env.USER || "user"; }
}
