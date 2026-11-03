# WO-2: Config and secure key store

- **Goal:** ~/.tut/config.json, API keys stored with chmod 600 (or env vars), first-run onboarding.
- **Requirements covered:** R10
- **Depends on:** WO-1
- **Status:** DONE (verified on Linux; owner ran the first-run wizard on Windows 2026-11-03)

## Acceptance criteria (Done-when)
- First run asks for provider + key, saves to ~/.tut, file mode 600 on Linux/macOS; env var override works.

## Design (as built)
- `~/.tut/config.json`: provider, model, permissionMode (no secrets). `~/.tut/keys.json`: API keys. Both mode 600, folder 700 (Linux/macOS). Windows relies on the user profile folder permissions.
- Writes are atomic (private temp file, then rename). A broken JSON file gives a clear error and is never overwritten.
- Env vars win over the file: OPENROUTER_API_KEY, XAI_API_KEY or GROK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY or GOOGLE_API_KEY. `TUT_PROVIDER` forces the provider. `TUT_HOME` moves the folder (tests).
- Key input is hidden (raw mode, shows `*`), supports paste and Backspace, Ctrl+C cancels. Keys are never put on the command line and never printed in full.
- Commands: `tut setup` (wizard), `tut config`, `tut config path`. First `tut` run in a terminal starts the wizard if no provider and key exist; without a terminal it only prints a hint.

## Sub-steps
- [x] src/providers-meta.js: the five providers and their env var names
- [x] src/config.js: load/save, key store, env override, provider resolution, masking, permission tightening
- [x] src/prompt.js: ask, askChoice, askSecret (hidden)
- [x] src/onboarding.js: first-run wizard; src/config-cli.js: `tut config`
- [x] bin/tut.js wiring (`setup`, `config`, first-run), help text
- [x] test/config.test.js (19 tests) and smoke tests isolated with TUT_HOME
- [x] Verified end to end in a pseudo-terminal on Linux (key not echoed, files 600/700)
- [x] Owner ran `tut` on Windows: wizard asked provider, hid the key, printed Saved (OpenRouter)
- [ ] Owner runs the same on the Pi over SSH (optional now, needed for WO-9)
