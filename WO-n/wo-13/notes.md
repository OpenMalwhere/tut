# WO-13 notes
- Windows is unverified: named pipe, taskkill /T /F and the hidden detached start were written from the docs, not run.
- If the service crashes hard, its jobs can be orphaned; `tut-kill` does not hunt for them (a stale pid could belong to something else). Handle with a job registry check in a later WO if it matters.
- package.json "files" (if any) must include bin/tut-service.js: check `tut status` after `npm install -g .`.
