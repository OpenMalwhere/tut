# WO-5 errors
(none yet)

| E-006 | 2026-11-03 | WO-5 | test/agent.test.js (failing-command test, run on Windows) | Expected exit code 3, got 1, stderr still correct | PowerShell does not propagate a native command's exit code as its own unless told to | Commands now run as `${command}; exit $LASTEXITCODE` on Windows | FIXED |
