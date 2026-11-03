# WO-4: Terminal UI and logo renderer

- **Goal:** Render the user's custom logo in the terminal at startup, with colors and a plain fallback; basic prompt/spinner styling.
- **Requirements covered:** R8, R2
- **Depends on:** WO-1
- **Status:** IN-PROGRESS

## Acceptance criteria (Done-when)
- Logo shows on `tut` start in Windows Terminal and on the Pi over SSH; falls back to plain text if colors/Unicode unsupported.

## Sub-steps
- [x] Logo received (assets/logo-1000.jpg, assets/logo-500.jpg)
- [x] Build-time converter tools/make-logo.py -> src/logo-art.js (48 columns)
- [x] Renderer src/logo.js: truecolor, 256-color, plain; NO_COLOR respected; `tut logo`
- [x] Owner ran it in Windows PowerShell: logo displays (2026-11-03)
- [ ] Owner confirms it looks right in colour in Windows Terminal and over SSH on the Pi
- [ ] Prompt and spinner styling (after the agent UI exists)
- [x] 2026-11-03: colours helper `src/ui.js` (gold/blue/grey, NO_COLOR respected), Kali-style two-line prompt in the REPL, model list now in columns (owner request)
- [ ] Owner: check the new prompt and model columns in Windows Terminal and over SSH on the Pi
