# WO-4 changes
## 2026-11-03: UI colours, prompt, model columns (zip tut-wo4-ui.zip)
- NEW `src/ui.js`: `paint`, `columns` (few items -> one per line; 12+ items -> ls-style columns that fit the terminal width), `promptText` (two-line prompt in owner's style `┌──( user  𒁈 host  )-[dir]` / `└─@ `).
- `src/model-picker.js`: shows ALL models (no 15 limit), numbers kept, searching still works.
- `bin/tut.js`: REPL uses the new prompt (updates the folder each line).
- `test/providers.test.js`: +2 tests (columns keep all 1000 models; plain prompt text). 48 tests total.
- 2026-11-03: prompt changed again to owner's style: ┌──(user 𒁈host)-[dir] / └─TuT::@ 
- 2026-11-03: fixed garbled two-line prompt (readline cannot take a newline in its prompt): line 1 is printed by tut, readline gets only line 2
- 2026-11-03: screen is cleared when tut starts in a terminal; space after the 𒁈 glyph (it overlapped the host name); typing 'tut models' etc. inside the REPL shows a hint

- 2026-11-03: banner text "(agent not built yet...)" replaced; approval prompt uses the gold style.
