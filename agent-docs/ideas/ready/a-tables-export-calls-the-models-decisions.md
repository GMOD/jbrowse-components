---
name: a-tables-export-calls-the-models-decisions
description: Each display's tables.ts re-derives some of what its model decides (palette order by contig, split to its own entry), so an R or CLI export can paint or key a picture the view does not. The fix per site is one pure function both call.
---

# A tables export calls the model's decisions

GRAMMAR_OF_GRAPHICS.md rule 2 holds the tables export to the one object every
surface reads. A census on 2026-10-20 found these sites where a `tables.ts`
computes a display decision by its own code, ranked by how readily the two
disagree today.

## Can disagree now

The parity suites in `packages/tables/src/parity/` (TEST_INFRASTRUCTURE.md)
hold a known disagreement as a drift pinned to the export's value today; the
wiggle and variants suites hold none. Their last ones closed by running the
display's own views on the tables' static hosts
([the static hosts](../../reference/TABLES.md#the-static-hosts)):
the `rows.tree` order, wiggle's categorical key (`legend`, `legendTitle`) and
its rules on a heatmap (`scoreRulesDrawn`), and the variants records-band
key, `genotypes: { show: false }` (`drawsGenotypeRows`) and an identity color
callback's names (`variantDataColorScales`). The synteny and dotplot suites
hold none either: their key asks the view's `hasColorKey`, so the default
color keys nothing as on screen, and a `trackName` argument gives a key by
`track` the chip the view labels with the track's name.

The multi-way suite (`multiway.parity.test.ts`, stood up by `standUpMultiway`
with every lane's genome in the session) holds one: given no `assemblies`, a
mate lane's `segments` run to the view's edge where the view stops them at the
contig's end; given the lanes' genomes they stop there too, through the
display's own `laneStackOn` callbacks. Its labels (`rows.labels`) and a kept
lane the window aligns nothing to run the display's `laneLabelOf` and
`unalignedChosenLanesOf`.

A VCF read through `features` paints its records as a `LinearBasicDisplay`
paints features (`featureStaticHost.ts` creates that type), where a
`VariantTrack` now draws them with the records band (ADR-255), which colors
each record by its SV class (`recordColorViews`, `svClassColors`) and keys
the classes (`recordsColorScaleViews`). So an SV VCF comes back in one color
with an empty `legend`, and a display entry copied from a `VariantTrack`
(`records.displayMode`, `records.mark`) does not apply. The fix is to run the
records band's own color and key views on a variant host for
`VCF_ADAPTER_TYPES`, or to serve those files from `variants` with
`genotypes.show: false`; "A VCF read as features" in TABLES.md and
ggjbrowse's `R/features.R` describe the removed display until then.

The synteny tables' thin-ribbon width (`fadeThin`, `linear-comparative-view/
src/tables.ts`) restates `LinearSyntenyView.autoFadeWidthPx` less its
`filter(px => px > 0)`: with ten or more zero-span blocks the export fades
where the view does not. One `autoFadeWidthOf(numFeats, cappedMeanPx)` both
call closes it.

## Equivalent today, by hand

- Wiggle's range, domain, color and mark sources run the model's own
  getters, and the wiggle and variants
  rows, row colors and row color key run `TreeSidebarMixin`'s
  ([the static hosts](../../reference/TABLES.md#the-static-hosts)).
- Alignments' read colors, read key and read palette run the model's own
  getters (`alignmentsColorViews`, `readPaletteViews`), and the coverage band's
  autoscale its `coverageScaleViews`, with no autoscale group
  (`ungroupedAutoscaleViews`). `alignmentsReads.parity.test.ts` holds no drift: the read
  key, its title, its color bars and each read's color agree across strand,
  tag, MAPQ, insert size, modifications and base quality, a written title
  and `descending`.
- Alignments' worker args (`tables.ts`, the RPC `args`) restate the display's
  `rpcProps` and already differ in what they send (`colorField` raw rather
  than `workerColorField`; no `showCoverage`, `junctions` or
  `tooltipField`), with no column wrong today; and `stackedSections` restates
  `buildLanes` plus the model's `sections` getter. Each closes by moving the
  model's getter into a views function the static host installs.
- Features' fetch args (`featureStaticHost.ts`: `geneGlyphMode`, the
  `peptides` gate, `displayConfig`) restate `zoomFetchArgs()`/`rpcProps()`
  in `baseModel`'s inline views; the parity suite does not compare
  `aminoAcids`, so a change to the peptide gate would pass it.
- The synteny tables' `offscreenRows` restates `forEachMark`'s test in
  `drawOffscreenMates.ts`, which calls itself the one place a mark's x is
  decided; an exported predicate both call closes it.

## Closed

- Variants' cell colors and the export's `variants.color` run the display's
  `cellColorViews` and `recordColorViews`. The record color was a drift:
  under the default and `phaseSet` the export painted the full-dose alt hue
  where the records band paints the SV class or `featureDefaultColor`
  (`recordColors` in the parity suite).

- The features carry-overs (collapsed mode's forced `subfeatureLabels`, the
  `resolvedGeneGlyphMode` call, the `labelVisibility` inputs and
  `labelDensityPerPx`, `heightMode` read as `autoHeight` and
  `fitHeightToDisplay`, `facet.hidden` read as `hiddenGroups`, the hand-built
  `FeatureBandHost`, the color key's `isHidden`/`order`) run the model's own
  views on a static MST host (`FeatureStaticHost`,
  [the static hosts](../../reference/TABLES.md#the-static-hosts)).
  The parity suite compares rows, transcripts, truncation, labels, sections and
  the key over 19 configs at two zooms and finds no drift.
  The export's `fitMeasureFeatureIds` had counted a hidden section's features;
  the layout never places them and every measure skips an unplaced feature, so
  that was equivalent. The key was not: the export keyed every value the worker
  recorded, while the display keys only values an on-screen feature's fetched
  box paints (`onScreenColorValues`), so a transcript crossing the region on
  its intron alone put a value in the export's key that nothing drawn paints
  (pinned in `packages/tables/src/features.test.ts`).

## Not a defect

A lane pair the file lacks fails the multi-way export, where the view marks
that one gutter failed with a Retry beside it (749f6c8de6): an export has no
gutter-level error state, and a table of failed gutters ggjbrowse does not read
would drop the gutter silently. Positions compare within 1 px, since the view
places the anchor at whole pixels, and a lane's line is compared within the
view, since the view draws it a screen either side for panning.

The synteny tables decide the `auto` thin-ribbon fade from one level with no
latch, where the view latches (`SyntenyFadeMixin.ts`) and takes the narrowest
level: the latch is hysteresis against flicker while zooming, which a static
export has no history for.

Canvas label density counted a feature crossing two regions twice; the tables
count each feature once now, as the display's on-screen ids do.

The alignments tables key reads and arcs apart (`legend`, `arcLegend`) where
the display's one legend box merges them when they share a color
(`getAlignmentsColorScales`). Merging in the export was built and reverted on
2026-10-20: ggjbrowse draws reads and arcs as separate layers, each with its
own guide, so an arcs-only plot lost its key. Merging is the legend box's
presentation, which a host composing its own guides does for itself.

The alignments tables lay out every row, where the view caps rows to its
viewport (`layoutGroupsToViewport`), and stack sections `pileup.collapsed`
would fold (a `warnings` entry says so): row caps and collapsed lanes are
viewport policy, and no read color reads a row.

Variants categorical slots start empty in the tables, where the view holds
them session-wide (`display-kit/src/heldColorSlots.ts`): a stateless export
has no session to hold them.
