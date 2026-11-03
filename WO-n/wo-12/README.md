# WO-12: Missing-tool detection and auto-install

- **Goal:** When a command or tool is not available in the OS, tut detects it, finds the right package for this OS and CPU, and installs it after approval.
- **Requirements covered:** R17
- **Depends on:** WO-6 (permissions), WO-7 (rollback journal), WO-11 (web search to find the package)
- **Status:** TODO

## Design
- Detect: exit code 127, "command not found", ENOENT, or the agent checking `command -v <tool>`.
- Know the machine: OS and version (`/etc/os-release`, platform), CPU architecture (arm64 on the Pi), available package managers (apt, dnf, pacman, apk, brew, winget, choco, scoop).
- Find the package: package-manager lookup (`apt-cache`, `apt-file`, command-not-found data), then skills (WO-8), then web search (WO-11).
- Install order of trust: OS package manager, then pipx / npm / go / cargo, then GitHub release (matching OS and architecture, pinned tag, checksum verified), then git clone and build only with explicit approval.
- Show a plan before installing: source, version, download and disk size, license, repo age and stars (for GitHub).
- Guards: approval per WO-6; refuse if free disk would drop under about 3 GB; no `curl | sh` unless explicitly approved; user-level install under `~/.tut/tools` where possible.
- After install: verify with `<tool> --version`, record in the rollback journal (WO-7) so `tut uninstall <tool>` can undo, offer to save a skill file (WO-8).

## Acceptance criteria (Done-when)
- On the Pi: after removing a small tool (for example cowsay), asking tut to use it makes tut detect it is missing, propose `apt install`, install after approval, run it, and undo the install from the journal.
- A GitHub arm64 release install verifies the checksum and refuses a mismatch.
- The install is refused when free disk would drop under about 3 GB.
- Web or release text cannot trigger an install without the permission flow (R16).

## Sub-steps
- [ ] (fill in when the WO starts)
