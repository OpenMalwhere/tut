// Connects the agent to the saved provider, key and model. One session = one conversation in memory.
import { getApiKey, loadConfig, resolveProvider } from "./config.js";
import { providerById } from "./providers-meta.js";
import { runAgent } from "./agent.js";
import { paint } from "./ui.js";

export function createSession(env = process.env) {
  const messages = [];
  return {
    messages,
    async run(text, opts = {}) {
      const provider = resolveProvider(env);
      const key = provider ? getApiKey(provider, env).key : null;
      if (!provider || !key) throw new Error("No provider is set up yet. Run: tut setup");
      const model = loadConfig(env).model;
      if (!model) throw new Error("No model chosen yet. Run: tut models");
      const label = providerById(provider).label;
      return runAgent({
        messages, userText: text, provider, key, model, env,
        onThinking: () => process.stdout.isTTY && process.stdout.write(paint("grey", `  thinking (${label}, ${model})...\n`)),
        ...opts,
      });
    },
  };
}
