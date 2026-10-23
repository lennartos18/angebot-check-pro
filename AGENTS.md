# AGENTS.md

- Price evaluation runs in `analyze-angebot` in three steps: AI only transcribes positions (strict tool schema, null instead of invented values), code validates (sums, duplicates, qty × price), AI only returns per-position price ranges. Why: letting the AI pick the traffic-light level produced contradictions.
- The traffic-light level and all evaluation texts are computed deterministically in `supabase/functions/analyze-angebot/classify.ts` (thresholds as constants, covered by `classify_test.ts`); the frontend only displays the server's `einordnung_stufe`. Why: one rule set, no diverging thresholds.
- Evaluation texts must stay charta-compliant: regional, indicative wording with a data-basis note; never absolute "Marktpreis" claims. Why: legal/trust positioning.
- Only craftsman (Handwerk) documents are supported; uploads are limited to PDF/JPG/PNG/WEBP. Why: car-workshop and spreadsheet paths were removed in the reset.
- Whole analysis must finish within ~45 s; each AI call has its own timeout derived from the remaining budget. Why: user requirement.
