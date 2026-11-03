# WO-13 changes
## 2026-11-03 (zip tut-wo13.zip)
- NEW `src/service.js`, `src/service-client.js`, `src/service-cli.js`, `bin/tut-service.js`, `test/service.test.js`.
- `bin/tut-kill.js`: stub replaced by the real stop command.
- `bin/tut.js`: `tut status`, `tut job ...`, `tut logs ...`; first `tut` in a terminal starts the service.
- `src/help.js`: new commands and TUT_NO_SERVICE.
- `test/smoke.test.js`: tut-kill test now uses a temp TUT_HOME (it must never touch the owner's real service) and checks the message.
