# WO-5 changes
## 2026-11-03 (zip tut-wo5.zip)
- NEW `src/llm.js`, `src/agent.js`, `src/agent-cli.js`, `test/agent.test.js`.
- `src/providers.js`: `request` and `bearer` are now exported; `request` takes an optional `timeoutMs`.
- `bin/tut.js`: REPL runs the agent; `tut ask`; Ctrl+C stops a running task; banner no longer says "stub".
- `src/help.js`: `tut ask`.
- `test/smoke.test.js`: REPL test now expects the "run tut setup" hint when no provider exists.
- 2026-11-03: PowerShell exit codes now propagate correctly (added '; exit $LASTEXITCODE'); an empty model reply with no tool call now shows a visible notice instead of nothing
