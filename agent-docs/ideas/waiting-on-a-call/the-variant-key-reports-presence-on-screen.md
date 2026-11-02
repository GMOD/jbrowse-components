---
name: the-variant-key-reports-presence-on-screen
description: The variant display's key lists the absent-data categories and painted values of everything fetched, where the alignments keys list what touches the settled window (ADR-093, amended 2026-11-01); converging needs the cell loops to record where they painted each category, not only that they did.
---

# The variant key reports presence on screen

`LinearVariantDisplay/variantLegend.ts` keys `paintedLegendFlags` and
`paintedDomain`, which the cell loops set once per region with no position
(`VARIANTS_DISPLAY.md`, "The legend lists what was painted"). The view fetches
wider than it shows, so a no-call or secondary-alt row can name cells off
screen. The alignments keys moved to the settled window
(`LinearAlignmentsDisplay/keyWindows.ts`). The variant cell loops would need to
record presence per variant (or per position bucket) for the same rule, and the
per-cell loop is the display's hot path, so measure the cost before choosing
the bucket.
