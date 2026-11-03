# WO-2 changes

| File | Created / Modified | Reason |
|------|--------------------|--------|
| src/providers-meta.js | Created | The five providers with ids, labels, env var names |
| src/config.js | Created | Config folder, config.json, keys.json (mode 600), env override, provider resolution, key masking |
| src/prompt.js | Created | Dependency-free prompts, including hidden key input |
| src/onboarding.js | Created | First-run wizard (provider, key) |
| src/config-cli.js | Created | `tut config` and `tut config path` |
| bin/tut.js | Modified | `setup` and `config` commands, first-run onboarding before the REPL |
| src/help.js | Modified | Document setup, config, env vars |
| test/config.test.js | Created | 19 tests for config, key store, hidden input, onboarding, CLI |
| test/smoke.test.js | Modified | Use a temp TUT_HOME so tests never touch the real ~/.tut |
