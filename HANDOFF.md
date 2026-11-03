# HANDOFF (start here)

## RULE ZERO: read before you do anything
**Before writing any code or any text, read ALL 3 files and BOTH folders:**
- Files: `HowMuchDone.md`, `workOrderMap.md`, `WhatIsIt.md`
- Folders: `WO-n/` (all work order folders) and `logs/` (ERROR_INDEX.md and per-WO errors)
Do not rely on chat memory. These files are the memory. If a WO folder or log disagrees with the code, trust the code, fix the docs, and note it in DECISIONS.md.

## Project in 3 lines
- TuT-Cures: a Node.js CLI (global npm install, commands `tut` and `tut-kill`) that is an AI system "doctor".
- It runs shell commands itself, rolls back and retries when a step fails, follows .md skill files (OKF), searches the web (DuckDuckGo) when stuck, and installs missing tools by itself.
- It runs in a background service until `tut-kill`. Providers: OpenRouter, Grok, Anthropic, OpenAI, Gemini (keys auto-fetch models). Logo (gold pharaoh) is rendered in the terminal.

## Exact current state (2026-11-03 05:56 UTC)
- Code exists. Zero runtime dependencies. 46 tests; on Windows a few POSIX-only ones are skipped, on Linux all 46 pass (`npm test`).
- **WO-1 DONE**: `package.json` (name `tut-cures`, bins `tut` and `tut-kill`), `bin/tut.js`, `bin/tut-kill.js` (STUB, real one is WO-13), `src/help.js`, `src/version.js`.
- **WO-2 DONE** (verified on Linux and by the owner on Windows 11): `src/config.js` (`~/.tut/config.json` + `keys.json`, mode 600, env override), `src/providers-meta.js`, `src/prompt.js` (hidden key input), `src/onboarding.js` (first-run wizard), `src/config-cli.js`; commands `tut setup`, `tut config`, `tut config path`.
- **WO-13 DONE** (Windows verified; Pi memory check moved to WO-9): background service, `tut status`, `tut job`, `tut logs`, real `tut-kill`.
- **WO-4 IN-PROGRESS**: logo renderer (`tools/make-logo.py` -> `src/logo-art.js`, `src/logo.js`). Owner confirmed the logo displays in Windows PowerShell; Windows Terminal colour and Pi over SSH still unchecked.
- **WO-3 DONE** (OpenRouter verified live 2026-11-03; other 4 providers mock-verified): `src/providers.js` (five adapters: list models, test chat, ProviderError codes), `src/model-picker.js`, `src/model-cli.js`; `tut models [list|set <id>]`, `tut test`; setup now validates the key, fetches models, picks one, offers a test message.
- Not started: WO-5, 6, 7, 8, 9, 10, 11, 12, 13.

## Just finished
- 2026-11-03 (later): WO-5 built: src/llm.js (tool-calling for 5 providers), src/agent.js (loop, run_shell/start_job/job_logs, always asks y/N), src/agent-cli.js, REPL + `tut ask`. 69 tests pass on Linux; real REPL run in a pty with a mocked model works. Live OpenRouter test pending.
- 2026-11-03 (later): WO-13 built (src/service.js, service-client.js, service-cli.js, bin/tut-service.js, real bin/tut-kill.js; tut status/job/logs). 53 tests pass on Linux, manual end-to-end run clean. Windows and Pi unverified.
- 2026-11-03 (later): owner live check of OpenRouter model list worked (415 models). Added src/ui.js, columns model list, Kali-style prompt (tut-wo4-ui.zip). Waiting: owner runs `tut test`; then WO-3 DONE, then WO-13.
- 2026-11-03 06:18 UTC: built WO-3 (provider layer + model auto-fetch + `tut models`, `tut test`), 19 new tests, interactive check with a mocked network. Decisions in DECISIONS.md.
- Earlier: WO-2 done (E-003 Windows SIGINT test fixed by skipping on win32); WO-1; logo renderer; R17/R18 and WO-12/13 added (run order WO-1, 2, 3, 4, **13**, 5, 6, 7, 8, 11, **12**, 9, 10).

## Do immediately next
1. Owner: apply tut-wo5.zip and live-test the agent (see HowMuchDone). Then Claude marks WO-5 DONE and starts WO-6.
2. Owner: check logo colours/prompt in Windows Terminal and over SSH on the Pi (WO-4).
4. After each change, update the docs (see Update rules).

## How to run, build, test
- Requires Node 18 or newer. In the project root: `npm install -g .` then `tut --help`, `tut --version`, `tut logo`, `tut`.
- Tests: `npm test` (runs `node --test test/*.test.js`).
- Regenerate the logo: `python3 tools/make-logo.py 48` (needs Pillow; only for building).
- Target machines: Windows 11 PC (dev), Raspberry Pi 4B 1 GB running Kali (`ssh cvaki@god.local`) for low-RAM tests. Pi has Node packages available through apt; check `node -v` first.

## Known issues, gotchas
- Real provider APIs have not been called yet (build container has no access); adapters follow the documented endpoints. Model-name filters are heuristic (`NOT_CHAT` in src/providers.js).
- Windows Terminal colour and Pi SSH rendering of the logo are unchecked (WO-4).
- Keys are stored as plain text in a mode-600 file (no OS keychain); on Windows the file relies on the user profile permissions.
- `tut-kill` is a stub until WO-13.
- OKF skill format is an assumption until WO-8 fixes the spec.
- DuckDuckGo has no official full-results API: use its HTML endpoint through one swappable adapter. Fetched web text is untrusted (prompt-injection risk).
- Auto-install pulls code from free sources: ask first, pin versions, check checksums, keep about 3 GB of disk free, no `curl | sh` without explicit approval.
- Background service must never auto-approve commands while no terminal is attached.
- Pi has only 1 GB RAM: keep dependencies and idle memory small.
- Only run security tools on systems the owner owns or is authorized to test.

## Update rules (after EVERY meaningful change, in the same turn)
1. Code change -> `WO-n/wo-X/changes.md`
2. Error -> `logs/wo-X/errors.md` and `logs/ERROR_INDEX.md` (never delete entries)
3. Status or progress -> `HowMuchDone.md` and the Status column in `workOrderMap.md`
4. Always -> rewrite this file (current state + next action)
5. Requirement changed -> `WhatIsIt.md` and `DECISIONS.md`
Never mark a WO DONE until its Done-when is verified. If unsure, mark IN-PROGRESS.

## Reading order
HANDOFF -> HowMuchDone -> workOrderMap -> WhatIsIt -> latest `WO-n/wo-x` and `logs/`

**Last updated:** 2026-11-03 06:18 UTC
