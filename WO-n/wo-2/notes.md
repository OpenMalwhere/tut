# WO-2 notes

## How it was tested
- `npm test`: 27 tests pass (8 from WO-1, 19 new) on Node 22, Linux.
- Pseudo-terminal run of `tut` with an empty TUT_HOME: wizard appeared after the logo, chose Anthropic, pasted a key; terminal showed only `*`; config.json and keys.json were mode 600, folder 700; a second run skipped the wizard and `tut config` showed the key masked (`sk-...4567`).
- Env override: covered by tests (env key wins over file key, GROK_API_KEY alias, `tut config` reports the source).

## Results
- Linux: all Done-when items verified.
- Windows 11 (owner, 2026-11-03): `npm test` 24 pass, 2 skipped (POSIX-only permission tests), 1 fail = SIGINT test (E-003, test-only problem, fixed by skipping on Windows). First run showed the wizard, hidden input worked, "Saved" printed. Pi: not yet checked.

## Leftover TODOs
- Owner to run `tut config` once to confirm the saved key shows as masked.
- Keys are stored as plain text in a private file (no OS keychain). Fine for now; a keychain option could be a later improvement (see DECISIONS.md).
- Model choice is stored as `model: null` until WO-3 adds model auto-fetch.
