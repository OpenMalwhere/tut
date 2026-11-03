// First-run wizard: provider -> API key (hidden) -> check key + fetch models -> pick model -> optional test message.
import { PROVIDERS } from "./providers-meta.js";
import { getApiKey, loadConfig, saveConfig, setApiKey, tutHome, validateKeyFormat } from "./config.js";
import { ask, askChoice, askSecret } from "./prompt.js";
import { ProviderError, listModels, testChat } from "./providers.js";
import { chooseModel } from "./model-picker.js";

export async function runOnboarding({
  env = process.env,
  io = { ask, askChoice, askSecret },
  api = { listModels, testChat },
  out = (s) => process.stdout.write(s),
} = {}) {
  try {
    out(`\nTuT-Cures setup. Your key is stored only on this computer (${tutHome(env)}).\n\n`);
    const idx = await io.askChoice("Choose your AI provider:", PROVIDERS.map((p) => p.label));
    const provider = PROVIDERS[idx];

    let key;
    let models = null;
    let savedKey = false;
    const existing = getApiKey(provider.id, env);
    if (existing.source === "env") {
      key = existing.key;
      out(`\nFound ${existing.envVar} in your environment, so I will use it. Nothing to paste.\n`);
      out("Fetching models...\n");
      try {
        models = await api.listModels(provider.id, key);
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        out(`${e.message}\n`);
      }
    } else {
      for (let tries = 0; tries < 3 && !savedKey; tries++) {
        const typed = await io.askSecret(`\nPaste your ${provider.label} API key (hidden, then press Enter): `);
        try {
          key = validateKeyFormat(typed);
        } catch (e) {
          out(`${e.message}\n`);
          continue;
        }
        out("Checking the key and fetching models...\n");
        try {
          models = await api.listModels(provider.id, key);
        } catch (e) {
          if (!(e instanceof ProviderError)) throw e;
          if (e.code === "AUTH") {
            out(`${e.message}\n`); // wrong key: do not save it, ask again
            continue;
          }
          out(`${e.message}\nSaving the key anyway. Run \`tut models\` later to pick a model.\n`);
        }
        setApiKey(provider.id, key, env);
        savedKey = true;
      }
      if (!savedKey) return { cancelled: true };
    }

    const sameProvider = loadConfig(env).provider === provider.id;
    saveConfig({ provider: provider.id, ...(sameProvider ? {} : { model: null }) }, env);
    out(`\nSaved. Provider: ${provider.label}.${savedKey ? " Key stored in a private file." : ""}\n`);

    let model = sameProvider ? loadConfig(env).model : null;
    if (models?.length) {
      model = await chooseModel(models, { io, out });
      saveConfig({ model }, env);
      out(`\nModel saved: ${model}\n`);
      const answer = await io.ask("\nSend a tiny test message to check it works? [Y/n] ");
      if (!/^n/i.test(answer)) {
        try {
          const { text } = await api.testChat(provider.id, key, model);
          out(`Reply: ${text || "(empty text, but the call worked)"}\nAll set.\n\n`);
        } catch (e) {
          if (!(e instanceof ProviderError)) throw e;
          out(`Test failed: ${e.message}\nYour settings are saved. Try again later with: tut test\n\n`);
        }
      }
    }
    return { provider: provider.id, model, savedKey, cancelled: false };
  } catch (e) {
    if (e.code === "CANCELLED") {
      out("\nSetup cancelled. Run `tut setup` any time.\n");
      return { cancelled: true };
    }
    throw e;
  }
}
