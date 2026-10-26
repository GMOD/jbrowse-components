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

- `ribbonColor`, `utrColor` and `text` go under `encoding`; `color` already
  has.
- `hideUnlabelled` becomes a `ribbons.filter` entry `{ field, valid: true }`,
  `showGeneLabels` becomes `genes.labels.show`, and `showLaneTicks` becomes
  `axis.show`, which should then gate the anchor rule's ticks too.
- `splitStrands` and `inlineLaneNames` change layout and have no spelling.
- Off-screen mate marks honor only the `length` filter, since the worker sends
  no attribute lanes with the mates.

## Settings no step covers

- Canvas, after the 2026-10-26 pass (outline cut, `mark.height`,
  `transcripts`, `containers`):
  - `showLabels` and the two label densities: the gate runs on the main
    thread over worker output, so it cannot be a predicate, and descriptions
    must drop whenever names do. Moving `show` into `labels` would also make
    each toggle an RPC key, since the worker reads `labels` whole.
  - `geneGlyphMode`: a three-way choice. `all` also turns off the fit
    ladder's isoform trim and the 100 bp/px switch, so `transcripts.limit`
    plus a boolean spells it twice, and `transcripts.fit` clashes with
    `heightMode: 'fit'`.
  - `subfeatureLabels` and `subParts`: `parts` already means a display's
    named sub-objects (ADR-238), and `subfeatureLabels` labels transcripts,
    container children and cleavage products, not the boxes `subParts`
    selects.
  - `connectorColor` and `utrColor`: the connector color also paints strand
    arrows and repeat-region lines, so neither `introns` nor `connectors`
    names all it paints. Converge with the multi-way display's `utrColor`.
  - `encoding.color.value` keeps its per-box jexl callback: an identity-scale
    field evaluates on the transcript (volvox colors CDS and exon apart), and
    at 1e5 distinct colors moves a values table over RPC.
  - `mouseover` stays: jb2hubs writes it into every hosted feature track, and
    `tooltip` is the multi-sample display's `{ show }` part.
- LD: `showLabels`.
- Multi-sample variants: `showLabels`.
- Mark display: `marks[].minBpPerPx` and `maxBpPerPx`, although ADR-238 says
  `view.bpPerPx` replaces every zoom gate. The predicate input does not exist
  yet, and building it for two rarely written bounds waits on a second use.
- `rowProportion` and `rowHeight` stay display slots (ADR-194); folding them
  into `mark.height` loses the row pitch.
