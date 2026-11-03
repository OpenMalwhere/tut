// `tut config` (show settings, keys masked) and `tut config path`.
import { PROVIDERS } from "./providers-meta.js";
import { configPath, getApiKey, keysPath, loadConfig, maskKey, resolveProvider, tutHome } from "./config.js";

export function configCommand(args, env = process.env, out = (s) => process.stdout.write(s)) {
  if (args[0] === "path") {
    out(`${tutHome(env)}\n`);
    return 0;
  }
  if (args.length) {
    process.stderr.write("tut: usage: tut config [path]\n");
    return 2;
  }
  const cfg = loadConfig(env);
  out(`Config folder:   ${tutHome(env)}\n`);
  out(`Settings file:   ${configPath(env)}\n`);
  out(`Keys file:       ${keysPath(env)} (private, mode 600 on Linux/macOS)\n\n`);
  out(`Provider in use: ${resolveProvider(env) ?? "(none yet: run `tut setup`)"}\n`);
  out(`Model:           ${cfg.model ?? "(not chosen yet, comes with provider support)"}\n`);
  out(`Permission mode: ${cfg.permissionMode}\n\nKeys:\n`);
  for (const p of PROVIDERS) {
    const k = getApiKey(p.id, env);
    const state =
      k.source === "env" ? `from environment ${k.envVar} (${maskKey(k.key)})` :
      k.source === "file" ? `saved (${maskKey(k.key)})` : "not set";
    out(`  ${p.label.padEnd(14)} ${state}\n`);
  }
  return 0;
}
