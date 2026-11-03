# HowMuchDone

**Overall:** 4 of 13 work orders done (31%)
`[###-------] 31%`

**Current work order:** WO-5 (Agent loop and run_shell tool), IN-PROGRESS: built and tested with a scripted model and in a pseudo-terminal; waiting for the owner's live test with OpenRouter. WO-4 still waits for owner checks (Windows Terminal colours, Pi over SSH).

## Completed work orders
- WO-1: npm package `tut-cures` with commands `tut` and `tut-kill` (stub); `--help`, `--version`, `logo`, REPL stub. 8/8 tests pass; verified with a global install in the build container.
- WO-2: config and key store (`~/.tut/config.json` + `keys.json`, env override, hidden key prompt, first-run wizard, `tut setup`, `tut config`). Verified on Linux and by the owner on Windows 11 (wizard worked, OpenRouter chosen).

## In progress
- WO-3: adapters for OpenRouter, Grok, Anthropic, OpenAI, Gemini (list models, test chat, clear errors), model picker with search, setup that validates the key then fetches models, `tut models`, `tut test`. 46/46 tests pass (mocked HTTP); interactive flow verified in a pseudo-terminal. Live check 2026-11-03 with OpenRouter: 451 models listed, model saved, `tut test` replied OK in 1844 ms. Grok, Anthropic, OpenAI, Gemini: mocks only (no key).
- WO-4: logo converter, pre-generated art, renderer (truecolor/256/plain). Owner ran `tut logo` and `tut` in Windows PowerShell on 2026-11-03: logo displayed. Still to check: Windows Terminal specifically (colors), the Pi over SSH, prompt/spinner styling.

## Errors
- Total 3 / Fixed 3 / Open 0 (see logs/ERROR_INDEX.md)

## Next 3 actions
1. Owner: apply tut-wo5.zip, `npm test`, `npm install -g .`, then run `tut`, type `show free disk space`, answer y, report the screen. Also test answering n, and Ctrl+C while it works. Then Claude marks WO-5 DONE and starts WO-6 (safety).
2. WO-13: background service and `tut-kill`.
3. Owner: check the logo in Windows Terminal colour and over SSH on the Pi (closes WO-4).

Note: WO-11 (web search), WO-12 (auto-install) and WO-13 (background service) were added after the first plan; see workOrderMap.md for the run order.

**Last updated:** 2026-11-03 06:18 UTC
