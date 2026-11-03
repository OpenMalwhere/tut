# WO-6: Safety and permissions

- **Goal:** Permission modes (ask / auto / dry-run), dangerous-command blocklist, confirmation prompts, authorized-target reminder for security tools.
- **Requirements covered:** R9
- **Depends on:** WO-5
- **Status:** TODO

## Acceptance criteria (Done-when)
- In ask mode every command needs approval; blocked commands (for example `rm -rf /`) never run; dry-run only prints.

- Web or file text is untrusted data (R16): commands derived from it get the same permission and blocklist checks (tested together with WO-11).

## Sub-steps
- [ ] (fill in when the WO starts)
