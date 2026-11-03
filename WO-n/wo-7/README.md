# WO-7: Self-heal and rollback journal

- **Goal:** On a failed command, read the error, undo what the failed step changed, and retry with a fix, up to a retry limit. Journal every change so it can be reversed.
- **Requirements covered:** R6, R11
- **Depends on:** WO-5, WO-6
- **Status:** TODO

## Acceptance criteria (Done-when)
- Demo: a step that edits a config file and fails is rolled back (file restored from backup), then retried with a corrected command that succeeds.

## Sub-steps
- [ ] (fill in when the WO starts)
- [ ] Hook: when retries are exhausted or the error is unknown, call web search (WO-11).
