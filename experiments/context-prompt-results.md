# Contextual transcription prompt experiment

The stable snapshot is on main and checkpoint-before-context-prompt. The contextual-transcription branch changes only the language model's instructions. It adds general file/rank and pronunciation guidance; no input-specific replacements or parser changes.

Live tests on 2026-11-05 with Groq-hosted openai/gpt-oss-20b:

| Input | First context prompt | Pronunciation revision | Desired |
| --- | --- | --- | --- |
| 8, 8, rook. | h8 | h8 | a8 |
| 8–8 Rook. | h8 | clarification | a8 |
| A, a, rook. | a1 | clarification | a8 when recovering the user's reported speech |
| Rook h8. | h8 | h8 | h8 |
| Put a king on e5 and a bishop on c3. | e5 king; c3 bishop | e5 king; c3 bishop | same |
| Put a rook somewhere. | clarification | clarification | clarification |

The instruction-only experiment does not reliably resolve the reported error. Do not merge as a proven fix. Contract checks and production builds passed, but semantic acceptance did not. The live app was restored to Site version 6. Further changes should be evaluated against these cases and additional unaffected coordinates before merging.
