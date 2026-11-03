# ERROR_INDEX

Totals: **5 total / 5 fixed / 0 open**

| ID | Date | WO | Where | Error message | Root cause | Fix applied | Status |
|----|------|----|-------|---------------|------------|-------------|--------|
| E-001 | 2026-11-03 | WO-1 | package.json scripts.test | `node --test test/` failed with MODULE_NOT_FOUND | Node 22 treats a directory argument as a module path | Use a glob: `node --test test/*.test.js` | FIXED |
| E-002 | 2026-11-03 | WO-1 | bin/tut.js (SIGINT) | REPL did not exit with code 0 on SIGINT when stdin is not a TTY | readline's SIGINT event only fires in TTY mode | Added a process-level SIGINT handler that exits 0 | FIXED |
| E-003 | 2026-11-03 | WO-1 | test/smoke.test.js:57 (SIGINT test) | On Windows: `null !== 0` (exit code null) | Node on Windows cannot deliver SIGINT to a child; `child.kill("SIGINT")` just terminates it. Test problem, not a tut bug (real Ctrl+C in a Windows console works through readline) | Skip that test when `process.platform === "win32"` | FIXED |
| E-004 | 2026-11-03 | WO-13 | test/service.test.js (job start `sleep 600`) | On Windows: `assert.ok(isAlive(jobPid))` failed | `sleep` is not a Windows command, so the shell job exited at once. Test problem, not a service bug | Tests use `node -e "setTimeout(...)"` as the long job (works on all OSes) | FIXED |
| E-005 | 2026-11-03 | WO-4 | test/providers.test.js (prompt test) | Expected one space around the glyph, got two | Owner edited src/ui.js by hand to two spaces; test and code disagreed | Code and test now both use two spaces each side | FIXED |

Format of each entry in `logs/wo-X/errors.md`: ID (E-001) | Date | WO | Where (file:line) | Error | Root cause | Fix | Status (OPEN / FIXED / WONT-FIX). Never delete entries.
