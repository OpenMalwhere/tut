// `tut models`, `tut models list`, `tut models set <id>`, `tut test`, and the model step used by setup.
import { getApiKey, loadConfig, resolveProvider, saveConfig } from "./config.js";
import { providerById } from "./providers-meta.js";
import { listModels, testChat } from "./providers.js";
import { chooseModel } from "./model-picker.js";

const realApi = { listModels, testChat };
const defaultOut = (s) => process.stdout.write(s);

function current(env) {
  const id = resolveProvider(env);
  const key = id ? getApiKey(id, env).key : null;
  if (!id || !key) throw new Error("tut: no provider and key yet. Run: tut setup");
  return { id, key, label: providerById(id).label };
}

export async function selectAndSaveModel({ env = process.env, api = realApi, io, out = defaultOut } = {}) {
  const { id, key, label } = current(env);
  out(`Fetching ${label} models...\n`);
  const models = await api.listModels(id, key);
  if (!models.length) throw new Error(`tut: ${label} returned no usable models for this key.`);
  const model = await chooseModel(models, { io, out });
  saveConfig({ model }, env);
  out(`\nModel saved: ${model}\n`);
  return model;
}

export async function modelsCommand(args, { env = process.env, api = realApi, io, out = defaultOut, interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) } = {}) {
  if (args[0] === "set") {
    if (!args[1]) throw new Error("tut: usage: tut models set <model-id>");
    saveConfig({ model: args[1] }, env);
    out(`Model saved: ${args[1]}\n`);
    return 0;
  }
  if (args[0] === "list") {
    const { id, key, label } = current(env);
    const models = await api.listModels(id, key);
    out(`${label}: ${models.length} models\n`);
    for (const m of models) out(`${m.id}\n`);
    return 0;
  }
  if (args.length) throw new Error("tut: usage: tut models [list | set <model-id>]");
  if (!interactive) throw new Error("tut: choosing a model needs a terminal. Use: tut models list, then tut models set <model-id>");
  await selectAndSaveModel({ env, api, io, out });
  return 0;
}

export async function testCommand({ env = process.env, api = realApi, out = defaultOut } = {}) {
  const { id, key, label } = current(env);
  const model = loadConfig(env).model;
  if (!model) throw new Error("tut: no model chosen yet. Run: tut models");
  out(`Sending a tiny test message to ${label} (${model})...\n`);
  const t0 = Date.now();
  const { text } = await api.testChat(id, key, model);
  out(`Reply: ${text || "(empty text, but the call worked)"}\nOK in ${Date.now() - t0} ms.\n`);
  return 0;
}
