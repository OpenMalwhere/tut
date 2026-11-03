// Small terminal prompts with no dependencies. Streams are injectable for tests.
import readline from "node:readline";

function cancelled() {
  const e = new Error("cancelled");
  e.code = "CANCELLED";
  return e;
}

export function ask(question, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) });
    let answered = false;
    rl.on("SIGINT", () => {
      rl.close();
      reject(cancelled());
    });
    rl.on("close", () => {
      if (!answered) reject(cancelled());
    });
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function askChoice(question, options, io = {}) {
  const output = io.output ?? process.stdout;
  output.write(`${question}\n`);
  options.forEach((label, i) => output.write(`  ${i + 1}) ${label}\n`));
  for (let tries = 0; tries < 3; tries++) {
    const n = Number(await ask(`Number [1-${options.length}]: `, io));
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    output.write("Type just the number from the list.\n");
  }
  throw cancelled();
}

// Hidden input: shows * for each character, supports paste and Backspace, Ctrl+C cancels.
export function askSecret(question, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      reject(new Error("A hidden key prompt needs an interactive terminal. Set the key as an environment variable instead."));
      return;
    }
    let buf = "";
    const wasRaw = Boolean(input.isRaw);
    output.write(question);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    const finish = (err, value) => {
      input.removeListener("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
      if (err) reject(err);
      else resolve(value);
    };
    const onData = (chunk) => {
      if (chunk.startsWith("\x1b")) return; // arrow keys and other escape sequences
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish(null, buf);
        if (ch === "\u0003") return finish(cancelled());
        if (ch === "\u007f" || ch === "\b") {
          if (buf.length) {
            buf = buf.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (ch < " ") continue;
        buf += ch;
        output.write("*");
      }
    };
    input.on("data", onData);
  });
}
