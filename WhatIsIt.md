# WhatIsIt: tut

**Name:** TuT-Cures (package `tut-cures`; commands `tut` and `tut-kill`)
**One line:** A Node.js terminal AI agent, installed globally with npm, that acts like a system "doctor": it runs commands itself, undoes and fixes its own failed steps, and follows skill files (.md) to do tasks.

## Problem and users
- Typing and debugging system commands by hand is slow, especially for learners (ethical hacking class, Kali on a Raspberry Pi).
- Users: the owner (BCA student, Kali / Pi 4B 1GB / Windows) first; later other developers and learners.

## Original ideas (owner's words, cleaned)
- Build it with Node.js and npm so it installs globally and is called `tut` in the terminal.
- It is a cool AI tool connected with an API key. It works like a doctor: it can run commands on the system by itself.
- If an error happens, it takes the change back and does it again by its own.
- It has a `skills` folder with .md files (OKF, open knowledge file), for example how to use nmap. The agent reads these and performs tasks with them.
- Support API keys for OpenRouter, Grok, Anthropic, OpenAI and Gemini. When a key is added, it should automatically fetch the available models so the user can choose.
- The owner will supply a custom logo; it must render in the terminal.
- Plan the work with the Project Memory Keeper system (these docs).
- (Added 2026-11-03) Add DuckDuckGo web search: if the agent gets an error it cannot resolve, it should fetch data from the web itself, and also use the web to learn more about a tool.
- (Added 2026-11-03) If a tool the agent needs is not available in the OS, it should detect that and install what is needed by itself (from the OS package manager, free sources, even GitHub).
- (Added 2026-11-03) Work orders and processes must not be killed: they keep running in the background until the user calls `tut-kill`.
- (Added 2026-11-03) Logo supplied: gold pharaoh head with cobra crest and ankh, on black (`assets/logo-1000.jpg`, `assets/logo-500.jpg`). Project name TuT-Cures.

## Requirements
| ID | Priority | Requirement |
|----|----------|-------------|
| R1 | Must | Installable globally with npm; the command is `tut`. |
| R2 | Must | Interactive chat in the terminal (REPL). |
| R3 | Must | Providers: OpenRouter, xAI Grok, Anthropic, OpenAI, Gemini. |
| R4 | Must | Entering an API key auto-fetches that provider's available models; user chooses one. |
| R5 | Must | Agent runs shell commands on the system by itself (tool use) and reads the results. |
| R6 | Must | Self-heal: on error, take the change back and retry with a fix on its own (bounded retries). |
| R7 | Must | `skills/` folder of .md files (OKF, open knowledge file), for example how to use nmap; agent loads and uses them. |
| R8 | Must | User's custom logo rendered in the terminal. |
| R9 | Should | Safety: permission modes, command blocklist, confirmations, authorized-use reminder for security tools. |
| R10 | Should | Config and API keys stored securely (~/.tut, file mode 600, env var override). |
| R11 | Should | Rollback journal of every change so it can be undone. |
| R12 | Should | Runs on Linux (Kali on Raspberry Pi 4B 1GB arm64), Windows, macOS; low memory. |
| R13 | Nice | Streaming output, session history, agent drafts new skills. |
| R14 | Nice | Install and update skills with one command. |
| R15 | Should | Web search (DuckDuckGo, no API key) and page fetch: when the agent hits an error it cannot fix, or needs to learn about a tool, it searches the web, reads pages, and uses what it finds to resolve the problem itself. |
| R16 | Should | Text fetched from the web is untrusted data: it can inform the agent but never runs on its own. Any command derived from it still goes through the permission mode and blocklist. Queries are shown in ask mode and secrets are redacted. |
| R17 | Should | Missing-tool detection and auto-install: when a command or tool is not available in the OS, tut detects it, finds the right package for this OS and CPU (apt, dnf, pacman, brew, winget, then pipx/npm/go/cargo, then a GitHub release for the right architecture), and installs it after approval. Version pinned, checksum checked, about 3 GB of disk kept free, no `curl \| sh` without explicit approval, every install journaled so it can be undone. |
| R18 | Must | Background persistence: tut runs its work in a background service that keeps running after the terminal or SSH closes, until the user runs `tut-kill`. `tut` re-attaches to it; `tut-kill` stops the service and every process it started. A background job that needs approval pauses and waits; it never auto-approves. |

## Tech stack, platforms, constraints
- Node.js (LTS) + npm, JavaScript (ESM). Keep dependencies few: fetch is built in.
- Platforms: Windows 11 (Windows Terminal, PowerShell), Linux incl. Kali arm64 on Raspberry Pi 4B 1 GB RAM, macOS.
- Provider APIs are called over HTTPS with the user's own keys. No server of our own.
- Web search: DuckDuckGo needs no key. It has no official full-results API, so the plan is its HTML endpoint through built-in fetch, with the Instant Answer API as fallback, all behind one swappable adapter.
- Must stay light on RAM (Pi 1 GB).

## Out of scope (for now)
- GUI or web app. Our own hosted backend. Billing or accounts. Running models locally.
- Attacking systems the user is not authorized to test (the tool will remind and refuse unsafe defaults).

## Glossary
- **tut**: the CLI tool and command name.
- **Skill**: a markdown file telling the agent how to do one kind of task.
- **OKF (open knowledge file)**: the skill file format: markdown with a small frontmatter block (name, description, requires, risk) and fixed sections (when to use, steps, commands, verify, rollback). Exact spec to be fixed in WO-8.
- **Self-heal**: detect a failed step, roll it back from the journal, and retry with a fix.
- **Journal**: a log of reversible changes (backups and undo commands) used for rollback.
- **WO**: work order, one small testable chunk of the plan.
- **web_search / web_fetch**: the two agent tools for searching DuckDuckGo and reading a page as clean, size-capped text.
- **Untrusted content**: anything that comes from the web or a file; used as information only, never as instructions.
- **Background service (daemon)**: the long-running tut process that owns sessions and jobs; started by `tut`, stopped only by `tut-kill`.
- **tut-kill**: command that stops the background service and every process it started.
- **Job**: one command or task the service runs; has an id, a log file and a status.

## Open questions (assumptions made, confirm later)
1. Logo: RECEIVED 2026-11-03 (`assets/logo-1000.jpg`). Resolved; WO-4 renders it.
2. Project name TuT-Cures, command `tut`, stop command `tut-kill` (confirmed by owner's wording). npm name `tut-cures` not yet checked for availability.
3. Default permission mode assumed to be `ask` (approve each command), with `auto` as opt-in.
4. OKF assumed to mean "open knowledge file" in the format above.
6. Background service assumed to start on the first `tut` and stay until `tut-kill`; starting automatically at boot or login is NOT assumed (ask the owner).
7. Auto-install defaults to asking for approval each time, like all commands (WO-6).
5. DuckDuckGo scraping can break or be rate-limited. Assumed acceptable; the adapter is swappable (for example SearXNG or Brave Search with a key) if it fails.

## Change log
- 2026-11-03: Initial requirements captured (R1 to R14).
- 2026-11-03: Added R15 (DuckDuckGo web search and fetch for self-resolving errors) and R16 (web content is untrusted). New WO-11.
- 2026-11-03: Added R17 (missing-tool detection and auto-install) and R18 (background service until `tut-kill`). New WO-12 and WO-13. Logo received. Project named TuT-Cures.
