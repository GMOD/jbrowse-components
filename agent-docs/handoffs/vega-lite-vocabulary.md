---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words (predicate filter, channel object under encoding, mark, axis, legend: null, coord, data, render). Landed: the predicate compiler and the synteny views' filter and mark. Open: the channel object, the other filter families, guides, layout and the writers, concept by concept across the app. Read before adding or renaming any display or view setting."
---

# Vega-Lite vocabulary: what is left

The alignments displays' end state, slot by slot, and its amendments to
ADR-238 are
[ADR-240](../architecture-decision-records/adr-240-the-alignments-display-speaks-vega-lite.md);
its order of work slots into the steps below.

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
- The linear synteny view's `navigation` (`follow`, `anchor`), which replaced
  `followSynteny` and `followAnchorIndex`. `diagonalizeAnchorRow` stays apart:
  a gesture takes the follow anchor, and only the reorder dialog sets this one.
- LGVSyntenyDisplay's self lane as a `facet.hidden` entry, which replaced
  `hideSelfAlignments`.
- Wiggle's `mark` as Vega-Lite's mark object, `{ type, interpolate }`, a bare
  name lifting to the type; the chord displays' `mark` is a plot setting
  beside it.
- The mark display's `marks[].mark` as the same object (`MarkDef`), so the
  two displays spell a mark alike (ADR-216). The members one mark type reads
  moved inside it: a link's `linkShape` is `mark.interpolate` (`dome`, `arc`,
  `linear`), a span's `rowProportion` is `mark.height: { band }`, and a line's
  `gapBp` is `mark.gapBp`. render-core's link params still say `linkShape`
  and `line`; `markEntryOf` maps the one word onto them.
- MAF's `alignments.inversions`, `.frames` and `.reference` as `{ show }`
  parts, which replaced `showInversions`, `showAnnotations` and the top-level
  `showReferenceRow`. `rowIdentityAutoZoom`, `showAllLetters` and
  `showAsUpperCase` went outright: identity always yields to the bases at
  base level, letters follow `color`, and they keep the file's case. MAF's
  `color`, `y`, `scales` and `showLegend` wait on steps 1 and 3 below.

## Next, one concept at a time across the app

Move a concept everywhere in one pass, so it never has two spellings at once:

1. **The channel object under `encoding`.** It replaces the color-object
   variants, `scales.y`, `opacity` and the size slots. This collides with
   whoever is reshaping the alignments, wiggle, Hi-C, LD and MAF color objects,
   so agree on the order with that thread first.
   - **The row displays, decided 2026-10-22:** the mark display keeps `facet`,
     `rows` and `encoding.row` as three words; their members respell. The
     order slot on `facet` and `rows` became `sort` across every row display
     (landed). Then `scales.y` becomes a display-level `encoding.y` holding
     `scale` and `axis` and no field, which every mark's `encoding.y: 'score'`
     reads, in the same pass as wiggle, whose `scales.y` is the same
     wiggle-core object. The tree sidebar's `showTree`, `showBranchLength`,
     `showRowLabels` and `treeAreaWidth` go to an `axis` beside `rows` in step
     3, not inside it, since `rows` writes whole.
   - **The channel object's plan, reviewed 2026-10-22** (it is ADR-240's
     step 2; claim it here before starting):
     - Words: ADR-240's (`scale.names`, `scale.group`, `legend.descending`, a
       display-wide `legend.show` beside each channel's), `scale.type`
       `ordinal` for `categorical`, and a scalar `scale.quantile` for a
       ramp's `domainQuantile` (amend ADR-240's `{ quantile }`, which no slot
       type holds and which would split today's one q). A bare string inside
       `encoding` is a field, as on the mark display.
     - A written `field` always paints (Colin); the field Color by → Default
       leaves is display state (ADR-240 amendment 4), so Default and back
       refetches nothing and keeps its domain and names. Today's Default also
       clears a constant (`ColorWritesMixin.ts`), and the radios tick Solid
       for a constant with no field; both change with it.
     - Step 0, in today's flat spelling: `scale: 'none'` goes
       (`colorForField`, `colorForValue`, `pickSolidColor`, `markEdit`, the
       shape, wiggle and synteny scale lists), LGVSynteny's `strand` default
       moves to `impliedField`, `baseColor`'s `none` becomes
       `pileup.bases.show`.
     - Pass A, together: every color object, the hand-written ones included
       (HicColor, MafColor, MarkShape, MarkSize, RowColor, WiggleColor,
       `baseColor`, `readConnections.color`), and every reader of the flat
       member names: `markColor.ts` and `legend.ts`, `wiggleColor.ts`,
       canvas's `renderConfig.ts` fetch key, `ColorWritesMixin.ts`,
       `markEdit.ts`, `plot.ts`'s checks (which look at top-level keys only)
       and the CLI's copy of `colorScale.ts`. A link's width is
       `strokeWidth`.
     - Pass B: `encoding.y` writes by member, as `scales.y` does, and only
       color, shape and size write whole; `ScoreScaleMixin` takes its path, so
       coverage reads `coverage.encoding.y`.
     - Cut rather than respell: a channel `sort`, `legend.labels`,
       `minimalTicks`, WiggleColor's `field` (`impliedField` supplies
       `score`). Hosted hub configs keep a lift for each name they write.
   - ADR-238's "one position per category is `encoding.y` on a `band` scale"
     fits the one-glyph row displays and not the mark display, whose `y` is
     the value every mark folds into one scale and whose rows each hold a plot
     of it; there the band is Vega-Lite's `row` channel with a shared `y`.
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
     The linear synteny view already passes `cigarMode` to the worker as one
     resolved value.
   - The multi-way display's ribbons part takes over `ribbonColor`,
     `drawCurves` and `bridgeSkippedLanes`. `drawCurves` draws the linear
     synteny view's bump, so it becomes `mark.interpolate: 'bump'`.
     `bridgeSkippedLanes` is Vega-Lite's `mark.invalid: 'filter'`, which
     joins a path across a missing value, and `false` breaks the path there
     as d3's `defined` does. A bridged ribbon also draws at `BRIDGE_ALPHA`.
   - The same pass moves the multi-way display's other top-level words:
     `hideUnlabelled` into `ribbons.filter` as the synteny views' `{ field,
     valid: true }` entry, `showGeneLabels` to `genes.labels.show`,
     `showLaneTicks` to `axis.show` (it should then gate the anchor rule's
     ticks too, which it skips today), and `color`, `utrColor` and `text`
     under `encoding`. `splitStrands` and `inlineLaneNames` change layout and
     have no spelling yet.
   - Off-screen mate marks honor only the `length` filter: the worker sends
     no attribute lanes with the mates, so an `identity` predicate cannot
     reach them.

## Writers to update after each landing

- **ggjbrowse:** respell its R lists and re-pin its engine (memory
  `a-config-rename-reaches-ggjbrowse`). Its synteny and dotplot lists are
  respelled up to `data.resolution`. The multi-way export's `pins` is now a
  list of `{ lane, refName, at }` and `{ lane, refName, flipped }` records,
  and `lane_choice` in `R/multiway.R` still sends a lane-keyed map, which the
  engine rejects by name; respell it with the next engine pin. Its `rows` and
  `facet` lists still write `domain` (`R/multiway.R`, `scripts/gallery.R`, two
  tutorials, two testthat files).
- **jb2hubs:** `hubtools/src/repeatClassDisplay.ts` and
  `website/src/components/geneOrderStar.ts` write `rows.domain`. Display-kit's
  `retiredOrderSpelling` lifts it to `sort` until they write `sort` and the
  hosted hub configs regenerate, then it goes.
- **jbrowse-img:** its flags (`--minAlignmentLength`, `--drawCurves`) still
  carry the old names and write the new settings.
- **The figure specs, tutorials and `demos/` configs:** `pnpm verify --full`
  and the pre-commit config check catch a dead key.
