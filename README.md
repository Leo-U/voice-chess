# Voice Chess — Groq edition

Separate public chess editor based on the preserved OpenAI edition. Voice uses only Groq's `whisper-large-v3`; there is no OpenAI fallback. Visitors do not need an account. Positions are stored in each browser, not shared between visitors.

## Voice setup

Create a Groq API key at https://console.groq.com/keys. In this Site's settings → Environment variables, save `GROQ_API_KEY` with Secret enabled, then redeploy the saved version. Never paste the key into chat or source. For local development, an ignored `.env.local` may supply the same variable.

Record for up to 60 seconds. The app sends a clip to Groq after a pause in speech and sends any remaining audio when you finish. This app does not persist audio. The transcript is shown and parsed into chess edits. Groq free-tier quotas and terms apply; no paid fallback is used automatically.

## Short placement and color controls

Click Start recording and Stop recording, or hold R and release to submit. The shortcut is inactive in text fields. Leaving the window releases a held R key; unloading the page cancels recording.

Set an active color by saying “let’s do black next” or “switch to white”. The active color persists for later commands on the page. A color named for one piece overrides the active color for that piece alone. If no color is established, a placement needs an explicit color. A recording starts with the active color and applies spoken switches to subsequent phrases. Pause after a complete command to apply it while recording. Audio is processed in order and each completed batch can be undone separately. When the browser cannot detect pauses, commands apply after recording ends.

## Commands

- `white knight on f3`
- `clear e4`
- `move e2 to e4`
- `white pawn from e2 to e4`
- `e2, e4, e7, e5, g1, f3`
- `undo`, `redo`, `clear board`, `starting position`, `flip board`

Coordinate sequences must have an even number of squares. Edits within each processed clip apply atomically and undo together. This is a free-placement editor, not a legal-move engine. FEN turn, castling, en passant, and counters remain explicit settings.

## Checks

`node test.cjs`
`node test-coordinate-moves.cjs`
`node test-short-commands.mjs`
`node test-recorder-recovery.mjs`
`node test-browser-timers.mjs`
`node test-live-placements.mjs`
`node test-transcribe.mjs` (mocked service)

Build and preview through supplied Sites helpers. UI source is in `content/editor.html` and `public/`. Transcription route is `app/api/transcribe/route.ts`, backed by `server/transcribe.mjs`.

Recording recovery: browser audio finalization has a four-second deadline and transcription has a thirty-second deadline. Cancel is available while opening the microphone, finalizing, or transcribing. Cancelled results cannot change the board.

## Natural language experiment (2026-11-05)

The pre-LLM baseline remains saved as Site version 5 (commit `105d5ad473eeada4c1a1f71314c6140c5ac38db2`), local branch `baseline-before-llm`, and tag `baseline-before-llm-2026-11-05`. A tracked-source backup (without credentials) is in `../backups/voice-chess-groq-before-llm-2026-11-05.tar.gz`.

Completed voice recordings use Whisper transcription followed by `POST /api/interpret`. Typed placements use the same interpreter. All placements, including shorthand, are interpreted by Groq-hosted `openai/gpt-oss-20b` with strict JSON schema output, using the existing server-only `GROQ_API_KEY`. This does not use the OpenAI API or require another credential. Groq account limits apply; there is no fallback provider. The actual natural language instructions are exported as `PLACEMENT_PROMPT` in `server/interpret.mjs`.

Unrelated words are ignored; explicit colors override the selected color. Incomplete or ambiguous placements ask for clarification without board changes. Each request receives the current active color and the new text, without prior utterances or board context. Arbitrary positions are allowed. Model output is validated before applying a batch atomically; a batch can be undone once. Exact existing move/remove/editor commands remain on the local parser. Live recording uses short clips of audio separated by pauses.

Interpretation has an 18-second server deadline and 20-second client deadline, separately from transcription. Cancel during either stage ignores late results. Edits already applied can be undone on the board. Tests: `node test-interpret.mjs` and `node test-interpret-recorder.mjs`. Manual acceptance cases include the recorded black shorthand batch, conversational fillers, self-corrections, selected/explicit colors, ambiguous instructions, and non-placement chatter.
