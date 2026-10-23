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
- **Canvas `displayMode`:** compact and superCompact scale `featureHeight` by
  0.6 and 0.3 (`HEIGHT_MULTIPLIERS`), and its "Feature height" menu writes the
  mode where alignments' presets write the height.
- **Pixel layout words:** the circular view's `spacingPx` (Vega-Lite's facet
  `spacing`), `paddingPx` (`padding`), `minimumRadiusPx` and `minVisibleWidth`;
  the synteny view's `overdrawPx`. Rename them together, or each concept gets
  a second spelling.
- **Dotplot `lineWidth`** is a channel (`strokeWidth`, ADR-240 amendment 2),
  not a layout word. Wiggle's `size`, which doubles as a line's width, has the
  same gap.
- The circle draws no ruler flags, so an `axis.labels` there is a new feature.
- `data.resolution` has three directions: wiggle's `resolution` grows finer,
  Hi-C's `resolutionBias` and BigWigAdapter's `resolutionMultiplier` grow
  coarser. Settle one in the same pass as Hi-C's `data` move, which also takes
  `selectedNormalization` as `data.normalization`.

## Multi-way display

- `ribbonColor`, `utrColor` and `text` go under `encoding`; `color` already
  has.
- `hideUnlabelled` becomes a `ribbons.filter` entry `{ field, valid: true }`,
  `showGeneLabels` becomes `genes.labels.show`, and `showLaneTicks` becomes
  `axis.show`, which should then gate the anchor rule's ticks too.
- `splitStrands` and `inlineLaneNames` change layout and have no spelling.
- Off-screen mate marks honor only the `length` filter, since the worker sends
  no attribute lanes with the mates.

## Settings no step covers

- Canvas: `showLabels`, `showOutline`, the three `max*FeatureDensity`
  settings, and the flat `connectorColor`, `utrColor` and `outlineColor`.
- LD: `showLabels`.
- Multi-sample variants: `showTooltips`, `showInsertionGlyphs`, `showLabels`.
- Mark display: `marks[].minBpPerPx` and `maxBpPerPx`, although ADR-238 says
  `view.bpPerPx` replaces every zoom gate. The predicate input does not exist
  yet, and building it for two rarely written bounds waits on a second use.
- `rowProportion` and `rowHeight` stay display slots (ADR-194); folding them
  into `mark.height` loses the row pitch.
