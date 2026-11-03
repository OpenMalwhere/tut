# WO-3 notes

## How it was tested
- `npm test`: 46 tests pass on Linux (27 before + 19 new). HTTP is mocked: each provider's list and chat calls are checked for URL, auth header, body and reply parsing; each provider's rejected-key reply maps to AUTH and the key never appears in a message or URL (Gemini uses a header); network failure, 429, 402 and unreadable replies map to the right codes; Anthropic pagination is followed.
- Pseudo-terminal run with a fake network layer: wrong key rejected and not saved, right key accepted, 41 models listed 15 at a time, search "claude" picked a model, test message printed `Reply: ready`, key never echoed, files mode 600. Second run (key saved, no model) went straight to the model picker; `tut test` worked.

## Results
- Everything verified except live calls to the real provider APIs (the build container cannot reach them).

## Leftover TODOs
- Owner live check: `tut models` then `tut test` with the saved OpenRouter key. Report any HTTP error text.
- Other providers: live check only if the owner has keys; otherwise they stay verified by mocks only.
- Provider model lists change; filters are heuristic (name patterns). Adjust `NOT_CHAT` in src/providers.js if a wrong model shows up or a good one is hidden.
- Reasoning models may return empty text for the tiny test message (cap 64 tokens); that still counts as success.
