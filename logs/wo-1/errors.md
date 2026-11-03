# WO-1 errors

| ID | Date | WO | Where (file:line) | Error message | Root cause | Fix applied | Status |
|----|------|----|-------------------|---------------|------------|-------------|--------|
| E-001 | 2026-11-03 | WO-1 | package.json scripts.test | `node --test test/` failed with MODULE_NOT_FOUND | Node 22 treats a directory argument as a module path | Use a glob: `node --test test/*.test.js` | FIXED |
| E-002 | 2026-11-03 | WO-1 | bin/tut.js (SIGINT) | REPL did not exit with code 0 on SIGINT when stdin is not a TTY (process died from the signal) | readline's SIGINT event only fires in TTY mode | Added a process-level SIGINT handler that exits 0 | FIXED |
| E-003 | 2026-11-03 | WO-1 | test/smoke.test.js:57 (SIGINT test) | On Windows: `null !== 0` (exit code null) | Node on Windows cannot deliver SIGINT to a child; `child.kill("SIGINT")` just terminates it. Test problem, not a tut bug (real Ctrl+C in a Windows console works through readline) | Skip that test when `process.platform === "win32"` | FIXED |
