# WO-3 changes

| File | Created / Modified | Reason |
|------|--------------------|--------|
| src/providers.js | Created | Adapters for the five providers: list models (also proves the key), test chat, error mapping |
| src/model-picker.js | Created | Choose a model by number, id or search |
| src/model-cli.js | Created | `tut models`, `tut models list/set`, `tut test`, model step reused at start |
| src/onboarding.js | Modified | Validate key before saving, fetch models, choose model, optional test message |
| bin/tut.js | Modified | `models` and `test` commands; model picker when a key exists but no model |
| src/help.js | Modified | Document the new commands |
| test/providers.test.js | Created | 19 tests with mocked HTTP (all five providers, errors, picker, onboarding, commands) |
| test/config.test.js | Modified | WO-2 onboarding tests now pass a stub provider API |

## 2026-11-03: owner live check (OpenRouter)
- Owner ran `tut`: key accepted, 415 models listed live, model chosen and saved. `tut test` (real chat call) not yet reported. WO-3 stays IN-PROGRESS until it passes.
- Picker changed to show all models in columns (see wo-4 changes).
- 2026-11-03: WO-3 marked DONE after owner's live OpenRouter check (tut test OK, 1844 ms).
