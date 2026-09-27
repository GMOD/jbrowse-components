---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the coverage and ADR-181 figure reshoots, synteny colour range, the alignments read-colour key, and a marker for bars clipped at the top of an axis"
---

## Open

- **Reshoot figures with a coverage band.** The 0.99 default changes any
  window with a spike; nothing was reshot.
- **Reshoot the ADR-181 figures**, where a point moved to the middle of its
  extent or a lane became a rule: `mark_display_examples/points`,
  `read_marks/insert_size`, `read_marks/chromosome` and
  `dog10k-size-fst-scan-igf1`. ada refused ssh at the landing.
- **Synteny and ribbon colours** have no `range`, `title` or `labels`
  (`SYNTENY_COLOR_SCALES = ['none']`). Adding `range` reaches
  `orderAttributeLabels` (which returns early on an empty `domain`), the
  `CategoricalMode`, `labelColor` in `colorFunctions.ts`, and crosses the
  LinearSyntenyRPC worker; one change shows in linear synteny, dotplot and
  circular.
- **Alignments read colours**: the key is hand-built in
  `plugins/alignments/src/shared/legendUtils.ts` over `ColorBy`, not the
  encoding, so labels need a per-category override; a reads title must not take
  the merged reads-and-arcs heading (`mergedTitle`).
- **A marker for bars clipped at the top of an axis**, on wiggle and the
  coverage band, so a clipped bar does not read as its value. A visual call:
  show Colin a picture before building it across GPU, Canvas2D and SVG.
