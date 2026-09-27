---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the colour-key title/labels work built but unverified, the coverage figure reshoot, synteny colour range, the alignments read-colour key, and a marker for bars clipped at the top of an axis"
---

Landed on 2026-09-26: every `scales.y` takes `rules`, `grid`, `title` and
`minimalTicks`, with `grid` read per axis (ADR-142 §"Amended 2026-09-26"). The
coverage band's density tier draws its own counts scale, the depth scale floors
at 0, and the coverage band's `domainQuantile` starts at 0.99 (ADR-179 amended).
The cookbook gained "Settings every track type shares".

## Built, not landed: colour keys take `title` and `labels`

VariantCellColor, MultiWayGeneColor and WiggleColor spread `colorTitleSlot` and
`colorLabelsSlot`. A written title heads the key that describes the colour
(unset keeps the display's own heading, `""` draws none), and labels rename the
listed values; on wiggle they name threshold intervals. `paintedColorEncoding`
(display-kit `colorConfigSchema.ts`) strips labels from what the variants and
mark workers receive, so renaming a key entry refetches nothing. The wiggle
two-swatch colour edit keeps title and labels.

Typecheck, `pnpm verify` and the variants, wiggle, multi-way, mark and
display-kit suites passed. A later `jb-test main` run on ada failed 20 suites,
several plainly unrelated (`WorkspaceTab.test.tsx` expects `hg19!,hg38!`,
`legacySessions`, the MCP docs sections). Before landing, run those 20 on main
alone and compare; the candidates that could be this change are the wiggle
SVG vector export snapshot, `ChannelObjectSlotWrites` (the walk finds the
channel objects), the markProblems leaf check (`markRequest.ts` now imports
`paintedColorEncoding`), and the synteny export's colour-by legend.

## Open

- **Reshoot figures with a coverage band.** The 0.99 default changes any
  window with a spike; nothing was reshot.
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
- A reference line is a member of the scale, so it has no zoom range and no
  per-row value (GRAMMAR_OF_GRAPHICS.md). Parked.
