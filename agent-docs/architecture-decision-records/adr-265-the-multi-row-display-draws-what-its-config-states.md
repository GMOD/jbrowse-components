---
status: Accepted
summary: "The multi-row display states its plot: a `rect` per feature, rows on `rows.field` (default `type`, else asks); unset, a mark paints the file's own BED color; One row per and Color by read the whole view's census. Supersedes ADR-263's lane rule; amends ADR-243, 245, 249"
---

# ADR-265: The multi-row display draws what its config states

## Status

Accepted (2026-11-11), on Colin's "aim for the ideal end state, not stopgaps"
after four reviews of the display on real data; the default rows rule,
`type` else ask, is Colin's call the same day, over one row. Supersedes the parts of
[ADR-263](adr-263-a-row-field-is-a-lane-field-and-the-field-scans-share-one-census.md)
that pick the rows field by the lane rule and that feed One row per and Color
by from the start-of-display scan; its one census and its Group by builder
stand. Amends
[ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md),
whose scan picked the plot,
[ADR-243](adr-243-a-mark-paints-a-files-own-colors-through-an-identity-key.md),
whose multi-row key named each color by its features' names, and
[ADR-245](adr-245-protein-domains-are-their-own-track.md), whose domain track
the display drew by recipe.

## Context

The UCSC hg38 ClinVar SNVs bigBed (`clinvarMain.bb`) around
chr16:56,190,614-56,338,854, switched to the multi-row display, failed three
ways:

- **A random, persisted rows field.** The lane rule ran on the scan's sample,
  which held 1 of the 399 features in view. Even over all 399 it picks
  `origName`, a row per variant, since sparse SNVs never overlap within any
  field. The pick was then written into the config.
- **A key naming colors by lists of VCV accessions.** That was the fieldless
  identity color labelling each color by its features' `name`s.
- **Color by `type` painting every block "block".** A single-block BED12 row
  read as spliced, drew as `SPLICED_MARKS` (a line and a `flatten`), and the
  BED parser's block children carry `type: 'block'`, which shadows the row's
  own `type` column.

Each was a guess from a sample, and each was persisted as if the user had said
it.

## Decision

- **The plot is stated.** The multi-row config schema declares
  `marks: markListSchema([{ mark: 'rect' }])`, as the Manhattan display
  declares its point. `multiRowPlot`, the subtype's `defaultPlotOf` and the
  `menusOfferPlotFields` hook are deleted, and with them the mark display's
  overridable `defaultPlotOf`, which nothing else overrode.
- **Rows by `type` by default, a declared slot default.** The multi-row
  display's `rows` is `MultiRowRows`, a `MarkRows` whose `field` slot
  declares `type` as its default; the shared `Rows` keeps `''`, no rows, for
  wiggle and every other display. A subtype overrides a nested slot's default
  by declaring its own sub-schema over the base's (`baseConfiguration`), which
  inherits the `field` shorthand, the keyed writes and the lifts, and
  replaces the base's `rows` wholesale, as the Manhattan display replaces
  `marks`. `type` is the one column every annotation format means the same
  by: a GFF3 rows on `gene`, `mRNA`, `pseudogene`, a ClinVar bigBed on its
  variant types. Being the slot's default, it shows in the generated config
  docs and `jbrowse validate`, and every reader of `rowsField` (the row
  table, sort and clustering, the sidebar, SVG export) takes it through
  `getConf`; there is no effective-field getter.
- **One row is written: `rows: ''`.** The grammar's spelling of no field.
  Against a `type` default `''` is not the default, so the snapshot keeps it
  and None survives. "One row per → None" writes it, and "Type" writes `type`,
  which leaves the slot at its declared default.
- **The keyed rule reads the field in force.** The schema copies a keyed
  field's declared default onto its `writes` as `unwritten` (`type` here,
  the variant display's `sample`), so every reader of the declaration
  compares and reads the field in force: `changesKeyedField` under setConf,
  Reset (`baseRows`), the bag folds (`mergeConfSettings`, the share-link
  delta, whose diff names the field in force beside an arrangement), and
  `keyedInForce` for a read of the rows whole: the plot (`plotOf`, so Edit plot shows
  `type` and a field typed over it drops the type rows' arrangement), the
  rule list (`markPlotSettingsOf`) and `jbrowse validate`. An arrangement a
  config writes beside no `field` names the `type` rows and leaves with a
  pick of `sample`, and emptying the field in Edit plot writes `''`. For a
  display whose default is `''` nothing changes: an empty field names no
  values. A snapshot-only reader once missed the default (2026-11-13), which
  is why it lives on the declaration rather than at each site.
- **Else ask.** Where the loaded regions, split on the field in force
  (default or written), hold features and none carries it (a plain BED or
  RepeatMasker's table has no `type`), every feature draws in the one row of
  no value, a "One row per..." chip shows, and the display opens the picker,
  as the mark display opens Edit plot on an undecided plot. Dismissing it is
  choosing one row, so it writes `rows.field: ''` through `setConf`: a written
  field is no longer the default, and neither a reload, a share link nor
  another instance of the track asks again (2026-11-13; it was once a volatile
  flag, asking again in every session). The loaded regions are the whole view
  the render fetch read, the same features the candidates RPC would download
  again, so the decision costs no fetch and reads no sample; asking writes
  nothing.
- **Formats state their plot.** The protein-domain tutorial, its build script
  and figure spec write `rows: 'name'`, the transcript-and-matches marks and
  `encoding.color: { field: 'name' }`; "Edit plot..." offers the same plot as an
  example beside the spliced one. The RepeatMasker spec writes
  `rows: 'repClass'`.
- **Unset, a mark paints the file's own color, strictly.** A mark naming no
  color under a display whose written `encoding.color` names none (`saysColor`)
  paints each feature's BED color (`BED_COLOR_FIELDS`), with a placeholder `0`,
  `'0'` or `'0,0,0'` read as no color and painting the default. The display's
  `unsetColor` hook says so (`FILE_COLOR`, an identity `ColorSource` with
  `strict`), threaded through `markColorOf`, `markColorsOf`,
  `layerRequestsOf` and `markLayerRequest`, all of which pass through
  `paintedColorNode`, and `strict` crosses the wire to the worker's
  `ownColorField`. Nothing is written into the config or onto a mark, so a
  display-level color stated later still reaches every mark naming none
  (ADR-248). An identity scale written explicitly keeps UCSC's `itemRgb on`
  reading, where `0,0,0` is black.
- **Row colors win.** The precedence is a stated `encoding.color`, then the
  row's resolved color (`rows.colors`, then `rows.color`), then the file's
  color, then the default. `withRowColors` gains the identity case
  (`rowAbgr ?? color[k]`); `rowColorPaint` already counts the unset tier as
  naming no color, since `saysColor` reads only what is written.
- **No stated key, no legend.** An identity color with no `domain` contributes
  no legend section (`buildMarkLegend`) and no rows (`identityRows`). The
  feature-name labelling is deleted: `COLOR_LABEL_FIELD`, the wire's
  `labelField`, the worker's `colorLabels` and the `labels` on identity
  entries. A track keys its file's colors by stating them, as the ChromHMM
  configs now do.
- **The pickers read the whole view, with counts.** One row per offers None
  (one row) and Attribute...; Color by offers Default (the file's colors),
  Strand, Attribute... and Solid color...; the itemRgb row is gone. Both
  Attribute... rows open the feature display's picker, moved to display-kit
  (`AttributeFieldInput`, `attributeVerdict`, `ColorByAttributeDialog`), over
  `MarkGetFieldCandidates`, which reads the visible blocks under the display's
  byte budget and summarizes them with `summarizeGroupByCandidates`, now in
  core beside `fieldCensus.ts`.
- **The census lists no geometry and no blobs.** `censusFields` drops a BED12
  row's `blockCount`, `blockSizes`, `blockStarts`, `chromStarts`, `thickStart`
  and `thickEnd`, and any field holding markup (`<a…`, `&#9733;`), JSON or text
  past 256 characters (`isBlobText`). The feature display's Group by and the
  plot scan read the same census, so they lose those fields too.
- **The scan fields only multi-row read are deleted**: `lane`, `spliced`,
  `childTypes`, `bedColored`, `attributes`, `laneFieldOf`, `holdsLanes`,
  `splicedChildren`, `statesBedColor` and `rowFields.ts`. Edit plot's own scan
  stays.

## Consequences

- A track switched to the display from Display types draws a row per
  `type`, or one row and the picker where its features carry none; nothing is
  persisted without a pick.
- A config whose `rows` writes a `sort` or `labels` but no `field` names the
  types' rows now, where it named the one row's.
- ClinVar draws a row per variant type in its `reserved` colors with no key,
  and its pickers list
  `clinSign`, `type`, `molConseq` and the like, with counts, and never
  `_mouseOver`, `reviewStatus`, `phenotype` or `_jsonHgvsTable`.
- A config whose rows carry `rows.color` tints and whose display states no
  color now paints the tints over the file's colors. The Roadmap ChromHMM
  config already wrote an identity key, so its blocks keep their state colors.
- A plain BED12 of `0,0,0` colors paints the default blue, not black, unless
  its config writes an identity scale.
- The pickers' scan applies no `filter` admission, unlike the feature
  display's: a value only filtered-out features carry is still listed.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| One row with a "One row per..." chip as the default | The display exists to split features into rows; one row is the feature track's picture with a chip on it |
| The fewest-valued field in view | Still a guess from the data, and the window decides it: a pan that brings in another column's values changes every row |
| The track's color key, a row per color | Couples two channels the grammar keeps apart, and a file without colors has no key |
| An evidence-based lane rule: scan the whole view, require a row to hold several features, cap the row count | Still a guess from data, persisted as a choice; ClinVar's sparse SNVs pass any overlap test on any id column, and a rule good enough for one file misfires on the next |
| Single-block is not spliced | Fixes the line but not the shadowed `type`, and keeps a plot the user never stated changing with the window |
| A `flatten` rewrite that keeps the parent's `type` on its blocks | A grammar change for one display's guess; the stated `rect` never flattens |
| A track-level plot, written once per track for every display | The multi-row and feature displays read different settings, and a track-level copy is a second home for the display's grammar (ADR-204) |
| Gating Display types, offering the multi-row display only where a scan finds rows | Hides the display behind the same guess, and a scan at menu time is the start-of-display scan again |
| Writing the file-color default into `encoding.color` or onto the marks | A written identity on the marks would beat a display-level color stated later (ADR-248), and a written one on the display is a key the user never asked for |
