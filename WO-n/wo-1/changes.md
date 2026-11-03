# WO-1 changes

| File | Created / Modified | Reason |
|------|--------------------|--------|
| package.json | Created | name `tut-cures`, bins `tut` and `tut-kill`, ESM, Node >= 18, test script |
| bin/tut.js | Created | CLI entry: --help, --version, `logo`, REPL stub, SIGINT handling |
| bin/tut-kill.js | Created | Stub so the command exists; real behavior in WO-13 |
| src/help.js | Created | Help text |
| src/version.js | Created | Reads version from package.json |
| test/smoke.test.js | Created | 8 tests for the CLI |
