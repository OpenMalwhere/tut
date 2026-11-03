# WO-4 notes

## How it was tested
- Unit tests in test/smoke.test.js: truecolor output has 24-bit codes, 256 mode has 38;5 codes, plain has no escape codes, NO_COLOR forces plain.
- Plain render inspected as text: pharaoh head, striped headdress, cobra crest and ankh are recognizable at 48x19 cells.

## Results
- Renderer works in the build container.
- 2026-11-03: owner ran `tut logo`/`tut` in Windows PowerShell on the dev PC; the pharaoh logo and name displayed correctly (pasted output). Not yet confirmed whether that was Windows Terminal (color) or the legacy console. Pi over SSH not yet checked.

## Leftover TODOs
- Owner feedback on size and look (width can be changed: `python3 tools/make-logo.py <columns>`).
- Legacy Windows console (no Windows Terminal) fallback check.
