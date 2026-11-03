# WO-13 errors

| ID | Date | WO | Where | Error | Root cause | Fix | Status |
|----|------|----|-------|-------|------------|-----|--------|
| E-004 | 2026-11-03 | WO-13 | test/service.test.js (job start `sleep 600`) | On Windows: `assert.ok(isAlive(jobPid))` failed | `sleep` is not a Windows command, so the shell job exited at once. Test problem, not a service bug | Tests use `node -e "setTimeout(...)"` as the long job (works on all OSes) | FIXED |
