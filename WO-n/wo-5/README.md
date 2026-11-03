# WO-5: Agent loop and run_shell tool

- **Goal:** the user types a task in plain words; the model picks a shell command; tut asks permission, runs it, sends the real stdout/stderr/exit code back; the loop continues until the model answers.
- **Requirements covered:** R5
- **Depends on:** WO-3, WO-4, WO-13
- **Status:** IN-PROGRESS (built and tested with a scripted model and in a pseudo-terminal; real model test by the owner pending)

## Acceptance criteria (Done-when)
Prompt "show free disk space" makes the agent run `df -h` (Windows: a PowerShell equivalent) itself and answer from the real output.

## Design (as built)
- `src/llm.js`: one chat turn with tool calling for all 5 providers. Neutral messages (user / assistant+toolCalls / tool). OpenRouter, OpenAI and Grok share the OpenAI format; Anthropic uses tool_use / tool_result blocks (consecutive results merged into one user message); Gemini uses functionCall / functionResponse. Chat timeout 120 s.
- `src/agent.js`: `runAgent` loop (max 12 steps), tools `run_shell` (timeout 60 s default, max 600), `start_job` (runs inside the WO-13 background service), `job_logs`. Output cut to head 3000 + tail 5000 characters for the model. Commands never see provider API keys in their environment. A failed request leaves the history unchanged. History is trimmed to 60 messages at turn boundaries.
- Permission: ALWAYS ask (y/N) for every command, even if config says auto. Auto mode and the dangerous-command blocklist are WO-6. No terminal = nothing is approved = nothing runs.
- Shell: Windows runs commands in PowerShell, Linux/macOS in sh; the system prompt tells the model which.
- `src/agent-cli.js`: session in memory; reads the saved provider, key and model on every task (so `tut models` takes effect at once).
- `bin/tut.js`: the REPL sends text to the agent; approval is read through the same prompt; Ctrl+C while the agent works stops it (kills the running command) instead of quitting; `tut ask <task>` does one task and exits.

## Sub-steps
- [x] llm.js adapters + tests with mocked HTTP (shapes, merging, header/key placement)
- [x] agent loop, run_shell, start_job, job_logs, timeouts, truncation, key stripping
- [x] REPL wiring and `tut ask`; pseudo-terminal run with a mocked model (approve flow works)
- [ ] Owner: live test with OpenRouter (see HowMuchDone): "show free disk space", then a refused command, then Ctrl+C
- [ ] Not live-tested: Anthropic, Gemini, OpenAI, Grok tool calling (mocks only; no keys)
