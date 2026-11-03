# WO-13: Background service and tut-kill

- **Goal:** `tut` starts a background service that keeps jobs alive after the terminal or SSH closes; `tut status`, `tut logs`; `tut-kill` stops the service and every process it started.
- **Requirements covered:** R18
- **Depends on:** WO-1, WO-2
- **Status:** IN-PROGRESS (built and tested on Linux; owner checks on Windows and the Pi pending)

## Acceptance criteria (Done-when)
Start a long job (sleep 600) from `tut`, close the terminal, reconnect: `tut status` shows it running; `tut-kill` stops the service and the job, leaves no processes (`pgrep` empty), removes the pid file and socket; idle service memory under about 60 MB on the Pi.

## Design (as built)
- `bin/tut-service.js` -> `src/service.js`: the daemon. Detached, no terminal. Listens on a LOCAL socket only (Unix socket mode 0600 in the tut folder; Windows named pipe `\\.\pipe\tut-cures-<hash of folder>`). No TCP. One JSON line in, one JSON line out. SIGHUP is ignored so closing the terminal does not stop it.
- `src/service-client.js`: `ensureService`, `request`, `ping`, `killService`, `killTree`. State file `service.json` (pid, endpoint, running job pids) in the tut folder.
- Jobs: started with the shell in their own process group (Windows: process tree), output to `logs/job-<id>.log` in the tut folder.
- `tut` (real terminal only) starts the service the first time; `TUT_NO_SERVICE=1` turns that off. Not started at boot or login (owner not asked; assumed).
- Commands: `tut status`, `tut job start <command>`, `tut job stop <id>`, `tut job list`, `tut logs <id> [--lines=N]`, `tut-kill`. (`tut job start` is the temporary hand-driven way to create jobs until the agent exists in WO-5.)
- `tut-kill`: asks the service to stop (it kills every job first), waits, and only if that fails force-kills the job pids from the state file and the service. It force-kills only a process that answered as our service on the socket, never a pid read from a stale file.
- A job that needs approval while no terminal is attached must pause, never auto-approve: this rule is for WO-5/WO-6; the service only runs what it is told.

## Sub-steps
- [x] Service, client, CLI commands, tut-kill
- [x] Tests: start once and reuse, socket mode 600, jobs and logs, tut-kill leaves no service/job/pid file/socket, stale state file, job stop, nothing-running cases
- [x] Manual run in separate processes: start job, status, logs, tut-kill, no leftovers (Linux)
- [ ] Owner: run on Windows (sleep job, close terminal, `tut status`, `tut-kill`)
- [ ] Owner: run on the Pi (`node -v` first), check idle memory with `tut status`
- [ ] Attach to a live session (`tut attach`) is NOT built: waits for the agent loop (WO-5)
