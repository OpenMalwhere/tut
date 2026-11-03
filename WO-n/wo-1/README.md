# WO-1: Project scaffold and CLI entry

- **Goal:** Global npm package; `tut` runs, `tut --help` and `tut --version` work, REPL stub starts.
- **Requirements covered:** R1, R2
- **Depends on:** -
- **Status:** DONE (verified 2026-11-03 05:22 UTC)

## Acceptance criteria (Done-when)
- `npm i -g .` then `tut --version` prints version; `tut` opens a prompt and exits cleanly on Ctrl+C.

## Sub-steps
- [x] package.json, bin entries, ESM, Node 18+
- [x] bin/tut.js: --help, --version, logo, unknown-option error
- [x] REPL stub, exits on `exit` and Ctrl+C
- [x] tut-kill stub (real one in WO-13)
- [x] tests (8) and global-install check
