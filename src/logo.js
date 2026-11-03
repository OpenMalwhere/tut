// Terminal logo renderer. Zero dependencies. Art is pre-generated (tools/make-logo.py).
import art from "./logo-art.js";

const GOLD_TC = "\x1b[38;2;233;170;50m";
const GOLD_256 = "\x1b[38;5;214m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

export function detectColorLevel(env = process.env, stream = process.stdout) {
  if (env.NO_COLOR !== undefined || env.TERM === "dumb") return "plain";
  if (!stream.isTTY) return "plain";
  const ct = (env.COLORTERM || "").toLowerCase();
  if (ct.includes("truecolor") || ct.includes("24bit")) return "truecolor";
  if (env.WT_SESSION || ["vscode", "iTerm.app", "WezTerm"].includes(env.TERM_PROGRAM)) return "truecolor";
  if ((env.TERM || "").includes("256color")) return "ansi256";
  return "plain";
}

function center(text, visibleLen, width) {
  const pad = Math.max(0, Math.floor((width - visibleLen) / 2));
  return " ".repeat(pad) + text;
}

export function renderLogo(level = detectColorLevel(), { version = "", tagline = "your terminal doctor" } = {}) {
  const body = art[level] ?? art.plain;
  const gold = level === "truecolor" ? GOLD_TC : level === "ansi256" ? GOLD_256 : "";
  const bold = level === "plain" ? "" : BOLD;
  const reset = level === "plain" ? "" : RESET;
  const name = "T u T - C u r e s";
  const sub = version ? `${tagline}  v${version}` : tagline;
  const lines = [
    body,
    "",
    center(`${bold}${gold}${name}${reset}`, name.length, art.width),
    center(sub, sub.length, art.width),
  ];
  return lines.join("\n");
}

export const logoInfo = { width: art.width, height: art.height };
