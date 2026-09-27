---
name: show-flatten-once-in-the-mark-display-examples
description: No tutorial or figure uses the mark display's flatten step. A new section of mark_display_examples.md on dtu's per-transcript statistic — flatten to transcripts, a point each, a threshold colour, a reference line at significance — would show it once.
---

# Show `flatten` once in the mark display examples

Left over from the mark-display showcase collection on 2026-09-27, whose other
two pages landed: the examples gallery
(`website/docs/config_guides/mark_display_examples.md`) and small multiples in
its "One row per file" section.

`flatten` turns a feature carrying a list into one feature per element: a gene
whose GFF attribute lists a value per transcript becomes one feature per
transcript, which a point mark can then plot. No tutorial or figure uses it.
`dtu`'s per-transcript statistic is the natural case: flatten to transcripts, a
point each, a threshold colour, and a reference line at significance. It fits as
one more section of the examples page.
