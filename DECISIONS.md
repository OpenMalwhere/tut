# DECISIONS

| Date | Decision | Alternatives rejected | Why |
|------|----------|-----------------------|-----|
| 2026-11-03 | Node.js + npm, JavaScript ESM, global install | Python CLI, Go binary | Owner's choice; npm gives easy global install and updates |
| 2026-11-03 | Use built-in `fetch` and few dependencies | axios, big SDKs for each provider | Pi has 1 GB RAM; one thin provider layer is lighter |
| 2026-11-03 | Provider layer = our own adapter per provider over plain HTTPS | Official SDKs for all five | Fewer dependencies, same interface for model listing |
| 2026-11-03 | Default permission mode is `ask`; `auto` is opt-in | Auto by default | A tool that runs commands by itself must be safe by default |
| 2026-11-03 | OKF = markdown + frontmatter + fixed sections (spec finalized in WO-8) | JSON/YAML-only skills | Human-editable and readable by any model |
| 2026-11-03 | Docs live in the project root and are the only memory | Chat history | Any agent or human can resume from a zip |
| 2026-11-03 | Add DuckDuckGo web search and fetch as WO-11 (R15/R16); keep WO-1..WO-10 numbers; run WO-11 between WO-8 and WO-9 | Renumber all WOs; fold into WO-7 | An earlier handoff dump already cites WO-1..WO-10; web search is its own testable unit that WO-7 calls when retries fail |
| 2026-11-03 | Search via DuckDuckGo HTML endpoint with built-in fetch, Instant Answer API as fallback, one swappable adapter | Paid search API, npm scraper packages, provider-native search | No key, no new dependencies on a 1 GB Pi; DDG has no official full-results API, so the adapter must be replaceable |
| 2026-11-03 | Web content is untrusted data; anything derived from it passes WO-6 checks; query shown in ask mode with secrets redacted | Letting fetched text drive commands directly | Prompt-injection risk when an agent can run shell commands |
| 2026-11-03 | Project name TuT-Cures; package `tut-cures`; commands `tut` and `tut-kill` | Single `tut` command with a `kill` subcommand | Owner asked for a separate `tut-kill`; npm name availability still to check |
| 2026-11-03 | Logo is converted at build time (Pillow) to pre-generated half-block art, 48 columns, three modes (truecolor, 256, plain); renderer has no dependencies | Runtime image libraries, SVG/Sixel, raw PNG in terminal | Works over SSH and on the Pi; zero runtime cost; falls back safely |
| 2026-11-03 | Background service: `tut` starts a detached service; the CLI talks to it over a local socket (Unix socket 0600, Windows named pipe), not TCP; `tut-kill` stops it and every child | tmux/screen dependency, systemd units, foreground-only | Works on Windows, Linux and the Pi with no extra tools; survives SSH drops; no network exposure |
| 2026-11-03 | WO-13 (service) runs before WO-5 (agent loop) | Build the agent loop first and wrap it later | The agent loop should be written to run inside the service, avoiding a rewrite |
| 2026-11-03 | Auto-install order of trust: OS package manager, then pipx/npm/go/cargo, then GitHub release (pinned tag, checksum), then clone and build only with explicit approval; ask first; keep about 3 GB free; journal every install | Install from anywhere without checks; `curl \| sh` | Free sources can host malicious code, and tut can run commands by itself |
| 2026-11-03 | A background job that needs approval pauses (WAITING_APPROVAL) and never auto-approves | Auto-approve when no terminal is attached | Unattended command execution must stay safe |
| 2026-11-03 | Settings in `config.json`, API keys in a separate `keys.json`; both mode 600, folder 700; atomic writes; env vars override the file | One file for everything; OS keychain (needs native modules) | Keeps secrets out of anything the user might share or print; no dependencies; fine for a single-user machine. Keychain option can come later |
| 2026-11-03 | Env var names: OPENROUTER_API_KEY, XAI_API_KEY (alias GROK_API_KEY), ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY (alias GOOGLE_API_KEY); `TUT_PROVIDER` forces the provider; `TUT_HOME` moves ~/.tut | Custom TUT_*_KEY names | Matches names other tools already use, so existing environments just work |
| 2026-11-03 | Hidden key prompt written with raw mode (shows `*`), no dependency; keys are never accepted as command-line arguments and never printed in full | `readline` with muted output, npm prompt libraries, `tut setup --key=...` | Command-line args end up in shell history and process lists |
| 2026-11-03 | Onboarding in WO-2 saves only provider and key; model choice is added by WO-3 | Fetch models during WO-2 | Model listing needs the provider adapters from WO-3 |
| 2026-11-03 | A key is validated by the model-list call before it is saved (OpenRouter: `/key` first, since `/models` is public). A rejected key is never saved; a network error saves the key and defers the model step | Save first and check later; refuse to save when offline | Stops typos from being stored, but offline setup must not lose the key |
| 2026-11-03 | Test message is tiny (cap 64 tokens, prompt: reply with one word) and asked for in setup (default yes); `tut test` repeats it. An empty reply still counts as success | Always send silently; larger test | Costs fractions of a cent, user stays in control; reasoning models can return empty text |
| 2026-11-03 | Chat-model filtering by name patterns (drop embeddings, image, audio, video, tts, instruct); model picker supports number, exact id, or search | Show raw provider lists | OpenRouter lists hundreds of models; the heuristic can be tuned in one regex |
| 2026-11-03 | Gemini key sent in the `x-goog-api-key` header, never in the URL | `?key=` query parameter | URLs end up in logs and error messages |

## 2026-11-03: WO-13 background service
- Local socket only (Unix 0600 / Windows named pipe), no TCP. Service starts after the first `tut` in a real terminal, not at boot/login (owner did not answer; revisit).
- `tut-kill` force-kills only a process that answered on the socket; stale pid files are cleaned, never trusted.
- `tut job start` is a temporary hand-driven job command until WO-5 creates jobs from the agent.

## 2026-11-03: WO-5 agent loop
- Neutral message format inside tut; each provider adapter translates it (OpenAI-style, Anthropic, Gemini).
- Every command asks y/N until WO-6; config "auto" is ignored for now. No terminal = nothing runs.
- Commands run without provider API keys in their environment.
- The agent lives in the tut process; only start_job uses the WO-13 service.
