# WO-5 notes
- No safety layer yet: only the y/N approval protects the user. WO-6 adds auto mode rules, blocklist and path limits. Until then keep every command on ask.
- Gemini function declarations use lowercase JSON-schema types; if the real API rejects them, switch to uppercase types (unverified).
- Windows: PowerShell output with non-English characters may look garbled (console encoding). Fix later if it shows up.
- The agent runs inside the `tut` process, not inside the background service; only `start_job` uses the service. Attach/detach of a running agent is a later idea.
- Web text and file contents are told to the model as data, not instructions; real prompt-injection handling is WO-6/WO-11.
