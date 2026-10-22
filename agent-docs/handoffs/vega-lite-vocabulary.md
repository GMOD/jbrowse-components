---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words (predicate filter, channel object under encoding, mark, axis, legend: null, coord, data, render). Landed: the predicate compiler and the synteny views' filter and mark. Open: the channel object, the other filter families, guides, layout and the writers, concept by concept across the app. Read before adding or renaming any display or view setting."
---

# Vega-Lite vocabulary: what is left

[ADR-238](../architecture-decision-records/adr-238-every-display-speaks-vega-lite.md)
holds the decided end state. This file tracks the order of work. Other
sessions reshaping a display's settings meanwhile should write the ADR's
spelling, not a new house word. That means no new `min*`, `max*`, `show*` or
`hide*` setting, and no new color-object variant.

## Landed

- `@jbrowse/core/util/fieldPredicate`: the predicate compiler over typed
  lanes, and display-kit's `FieldPredicate` schema.
- The linear synteny, dotplot and circular views' `filter`, a predicate list
  that replaced `minAlignmentLength`, `minIdentity` and `hideUnlabelled`
  (`SyntenyFilterMixin`, `filterLanes.ts`).
- The linear synteny view's `mark.interpolate`, which replaced `drawCurves`.
- The two comparative views' `coord.ratio`, which replaced `sameScale` and
  `lockAspectRatio`.
- The linear synteny view's `offscreen.show`, which replaced
  `showOffscreenMates`. It is the first part built on ADR-231's `show`
  member, which ADR-238's amendment puts in the place of `null`.
- `axis` on the linear genome, dotplot and linear synteny views, which
  replaced their `showGridlines`, `showTickLabels` and `drawLocationMarkers`.
- The synteny and circular views' `render.antialias`, which replaced
  `fadeThinAlignmentsMode`.
- `data.resolution` on the comparative views and the LGVSynteny and
  multi-way displays, which replaced `lodMode`.
- The chord displays' `mark.depth`, which replaced `bezierRadiusRatio`.
- Wiggle's `mark` as Vega-Lite's mark object, `{ type, interpolate }`, a bare
  name lifting to the type; the chord displays' `mark` is a plot setting
  beside it.
- The mark display's `marks[].mark` as the same object (`MarkDef`), so the
  two displays spell a mark alike (ADR-216).

## Next, one concept at a time across the app

Move a concept everywhere in one pass, so it never has two spellings at once:

1. **The channel object under `encoding`.** It replaces the color-object
   variants, `scales.y`, `opacity` and the size slots. This collides with
   whoever is reshaping the alignments, wiggle, Hi-C, LD and MAF color objects,
   so agree on the order with that thread first.
2. **The other filter families as predicate lists**: alignments, canvas,
   variant, MAF and junction/connection rows. The compiler fuses flag bits
   (`bits` lanes) and measures 1.5x the hand-written flag and MAPQ test alone,
   about 2 ns a read against 359 ns of BAM decode (measurement
   `field-predicate-read-filter`). Before the alignments filter moves onto
   it, A/B the whole fetch on `1000x.shortread.bam` on ada; a loss in
   seconds there keeps the hand-written path behind the same config.
   The same pass moves each band's layer toggles and thresholds into its
   layers' `show` and `filter` (ADR-238 "Layers inside a part"):
   `coverage.interbase`, `coverage.alleles`, `pileup.mismatches`,
   `sashimi.labels`, the modification layer.
3. **Legends, with step 1**: Vega-Lite gives each channel its own `legend`,
   so `legend.show` on the channel takes over every display's `showLegend`.
4. **Wiggle's `resolution` and Hi-C's `resolutionBias`** under `data`, each
   in its own units (ADR-238's amendment); the comparative `lodMode` is done.
   Settle one direction in the same pass: wiggle's `resolution` grows finer,
   while Hi-C's `resolutionBias` (+1 is one bin coarser) and BigWigAdapter's
   `resolutionMultiplier` (scales bpPerPx) grow coarser.
5. **Layout**: `height`, `autosize` and `maxHeight` take over `heightMode`,
   `growMaxHeight`, `rowHeight`, `featureHeight` and `pileup.readHeight`.
   The canvas `displayMode` belongs here too: compact and superCompact scale
   `featureHeight` by 0.6 and 0.3 (`HEIGHT_MULTIPLIERS`), and its "Feature
   height" menu writes the mode, where alignments' presets write
   `pileup.readHeight`.
   - The views' pixel layout words move in the same pass: the circular
     view's `spacingPx` (Vega-Lite's facet `spacing`), `paddingPx`
     (`padding`), `minimumRadiusPx` (the zoom-out extent) and
     `minVisibleWidth` (the width below which a region elides), with the
     synteny view's `overdrawPx` and the dotplot's `lineWidth`. Renaming
     the circle's alone would give each concept a second spelling.
   - The circle draws no ruler flags, so it has no `axis` to respell; an
     `axis.labels` there would be a new feature, not a rename.
6. **Comparative leftovers**:
   - The `indels` part takes over `cigarMode` and `drawCigar`, after step 1.
   - The multi-way display's ribbons part takes over `ribbonColor`,
     `drawCurves` and `bridgeSkippedLanes`. `drawCurves` draws the linear
     synteny view's bump, so it becomes `mark.interpolate: 'bump'`.
     `bridgeSkippedLanes` is Vega-Lite's `mark.invalid: 'filter'`, which
     joins a path across a missing value, and `false` breaks the path there
     as d3's `defined` does. A bridged ribbon also draws at `BRIDGE_ALPHA`.
   - The mark display's `marks.linkShape` (`dome arc line`) has no planned
     spelling yet; see ADR-238's note on `interpolate`. It, `gapBp` and
     `rowProportion` are still entry members beside `mark`, where
     Vega-Lite would put them in the mark object.

## Writers to update after each landing

- **ggjbrowse:** respell its R lists and re-pin its engine (memory
  `a-config-rename-reaches-ggjbrowse`). Its synteny and dotplot lists are
  respelled up to `data.resolution`.
- **jbrowse-img:** its flags (`--minAlignmentLength`, `--drawCurves`) still
  carry the old names and write the new settings.
- **The figure specs, tutorials and `demos/` configs:** `pnpm verify --full`
  and the pre-commit config check catch a dead key.
