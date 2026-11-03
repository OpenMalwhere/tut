// Pick a model from a (possibly long) list: number, exact id, or type part of a name to search.
import { ask } from "./prompt.js";
import { columns, paint } from "./ui.js";

export async function chooseModel(models, { io = { ask }, out = (s) => process.stdout.write(s) } = {}) {
  let shown = models;
  let filter = "";
  for (let round = 0; round < 12; round++) {
    const list = shown; // show ALL models: columns when many, one per line when few
    const width = (typeof out.columns === "number" ? out.columns : process.stdout.columns) || 80;
    out(`\n${paint("gold", filter ? `Models matching "${filter}"` : "Available models")} (${shown.length} found):\n`);
    const items = list.map((m, i) => `${paint("grey", String(i + 1).padStart(String(list.length).length) + ")")} ${m.id}`);
    out(columns(items, width).join("\n") + "\n");
    const a = await io.ask(shown.length > 15 ? "Type a number, an exact model id, or part of a name to search: " : "Type a number or an exact model id: ");
    if (!a) continue;
    if (/^\d+$/.test(a)) {
      const n = Number(a);
      if (n >= 1 && n <= list.length) return list[n - 1].id;
      out("No such number.\n");
      continue;
    }
    const exact = models.find((m) => m.id === a);
    if (exact) return exact.id;
    const q = a.toLowerCase();
    const found = models.filter((m) => m.id.toLowerCase().includes(q) || String(m.name ?? "").toLowerCase().includes(q));
    if (!found.length) {
      out(`Nothing matches "${a}".\n`);
      continue;
    }
    if (found.length === 1) return found[0].id;
    shown = found;
    filter = a;
  }
  const e = new Error("cancelled");
  e.code = "CANCELLED";
  throw e;
}
