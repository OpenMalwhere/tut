# WO-1 notes

## How it was tested
- `npm test`: 8 of 8 pass (version, help, unknown option, logo modes, NO_COLOR, REPL exit on `exit`, REPL exit on SIGINT, tut-kill stub).
- `npm install -g . --prefix /tmp/tutprefix`, then `tut --version` printed 0.1.0; `tut --help`, piped REPL and `tut-kill` all worked. Node v22 on Linux.

## Results
- DONE (2026-11-03 05:22 UTC). Windows and Raspberry Pi checks are done by the owner (and in WO-9).

## Leftover TODOs
- Check npm name `tut-cures` is free before publishing (WO-9).
