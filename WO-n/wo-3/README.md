# WO-3: Provider layer and model auto-discovery

- **Goal:** One interface for OpenRouter, xAI Grok, Anthropic, OpenAI, Gemini. Entering a key fetches that provider's model list; user picks one.
- **Requirements covered:** R3, R4
- **Depends on:** WO-2
- **Status:** DONE (OpenRouter verified live on 2026-11-03; Grok, Anthropic, OpenAI, Gemini verified by mocks only until the owner has keys)

## Acceptance criteria (Done-when)
- For each of the 5 providers: valid key lists models, invalid key gives a clear error, chosen model is saved and used for a test chat call.

## Design (as built)
- `src/providers.js`: one `listModels(provider, key)` and `testChat(provider, key, model)` for all five, over built-in `fetch` (20 s timeout, `fetch` injectable for tests). Errors are `ProviderError` with a code: AUTH, NETWORK, RATE_LIMIT, CREDITS, HTTP, BAD_RESPONSE. Messages never contain the key.
- Endpoints: OpenRouter `GET /api/v1/key` (proves the key; `/models` is public) then `GET /api/v1/models`, chat `POST /api/v1/chat/completions`. xAI `GET /v1/models`, `POST /v1/chat/completions`. OpenAI `GET /v1/models`, `POST /v1/chat/completions`. Anthropic `GET /v1/models` (x-api-key, anthropic-version 2023-06-01, paginated), `POST /v1/messages`. Gemini `GET /v1beta/models` (key in x-goog-api-key header, paginated, only generateContent models), `POST /v1beta/models/<id>:generateContent`.
- Chat-only filtering of the model lists for OpenAI, Grok and Gemini (drops embeddings, image, audio, video, tts, instruct).
- `src/model-picker.js`: pick by number, exact id, or type part of a name to search (lists can be 300+ long on OpenRouter).
- `src/onboarding.js`: provider -> hidden key -> check key + fetch models (a rejected key is NOT saved, asks again, 3 tries) -> pick model -> optional test message. If the network is down the key is still saved and the model step is left for `tut models`. Switching provider clears the old model.
- `src/model-cli.js`: `tut models` (interactive), `tut models list`, `tut models set <id>`, `tut test`.
- `tut` start: if a key is saved but no model is chosen, the model picker runs (existing WO-2 users).

## Sub-steps
- [x] Confirm current endpoints (OpenRouter /key, xAI /v1/models checked in the docs; Anthropic, OpenAI, Gemini are the standard list calls)
- [x] Adapters for all five, error mapping, pagination
- [x] Model picker with search
- [x] Onboarding: validate key, fetch models, choose, test message
- [x] `tut models`, `tut models list|set`, `tut test`
- [x] 19 new tests with mocked HTTP; interactive run verified in a pseudo-terminal with a mocked network layer
- [x] Owner: live check with OpenRouter: 451 models listed, model saved, `tut test` OK in 1844 ms
- [ ] Owner: live check for any other provider they have a key for (Grok, Anthropic, OpenAI, Gemini)
