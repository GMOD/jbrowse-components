---
name: vega-lite-layout-and-multiway-leftovers
description: ADR-238 settings with no spelling or step yet: layout words (canvas displayMode, the views' pixel spacing), the multi-way display's leftovers, and show*, density and min-max settings no step covers. Read before respelling any of them.
---

# Vega-Lite leftovers with no home

Each item needs a call before work. Check the ADR-238 spelling first.

## Layout

- **ADR-240 amendment 3 governs height:** `heightMode` and `growMaxHeight`
  stay and `autosize` is not borrowed. The vocabulary handoff orders
  `pileup.mark.height`.
- **Canvas `displayMode` stays a mode** (2026-10-26 review): compact and
  superCompact scale `mark.height` by 0.6 and 0.3 on the main thread
  (`HEIGHT_MULTIPLIERS`) and also step the label font and row padding, so a
  preset never refetches. Writing presets as `mark.height` values would move
  every preset click onto an RPC and change the layout of any track with a
  custom height. `collapsed` stays in it: `collapse` clashes with "Collapse N
  expanded genes" and with alignments' `collapseSections`.
- **Pixel layout words:** the circular view's `spacingPx` (Vega-Lite's facet
  `spacing`), `paddingPx` (`padding`), `minimumRadiusPx` and `minVisibleWidth`;
  the synteny view's `overdrawPx`. Rename them together, or each concept gets
  a second spelling.
- **Dotplot `lineWidth`** is a channel (`strokeWidth`, ADR-240 amendment 2),
  not a layout word. Wiggle's `size`, which doubles as a line's width, has the
  same gap.
- The circle draws no ruler flags, so an `axis.labels` there is a new feature.

## Multi-way display

- `showLaneTicks` becomes `axis.show`, which should then gate the anchor
  rule's ticks too.
- `splitStrands` and `inlineLaneNames` change layout and have no spelling.
- Off-screen mate marks honor only the `length` filter, since the worker sends
  no attribute lanes with the mates.

## Settings no step covers

- Zoom and density gates: the mark display's `marks[].minBpPerPx` and
  `maxBpPerPx`, and the canvas display's `maxLabelFeatureDensity` and
  `maxDescriptionFeatureDensity`. ADR-238 says a `view.*` predicate replaces
  every zoom gate, but the predicate input does not exist yet. Building it
  moves all four, each label threshold into its label part's `filter`; the
  gene-name fallback (gene names still draw past the name threshold while the
  genes alone are under it) needs a spelling first.
- `rowProportion` and `rowHeight` stay display slots (ADR-194); folding them
  into `mark.height` loses the row pitch.
