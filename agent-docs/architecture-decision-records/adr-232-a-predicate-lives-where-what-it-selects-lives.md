---
status: Accepted
summary: "A predicate lives where what it selects lives: a display's `filter` holds its tests on the records it fetched and on the data derived from them, so the alignments display's `filter.junctions` and `filter.connections` replace `sashimi.filter` and `readConnections.filter`, and every part that draws junctions or connections reads them, the curved connectors over the pileup included; and the coverage allele floor becomes the color rule `coverage.minAlleleFraction`. The canvas, mark and multi-sample variant displays' `filter` becomes an object whose `expressions` member takes the jexl list, also its shorthand. A schema with a `shorthand` declares `writes: 'whole' | 'members'`; a band is fixed `{ show, height }` or the remainder `{ show }`; a guide is a top-level `show<Guide>`; a schema declares its plot words, and `PLOT_VOCABULARY` goes. The variant lane becomes `variants`, MAF's row band `alignments`. Amends ADR-204, 215, 218 and 231; decided, built before the 5.0.0 slot-path freeze"
---

# ADR-232: A predicate lives where what it selects lives

## Status

Accepted (2026-10-17), to build in the [order of work](#order-of-work) before
the 5.0.0 tag freezes config slot paths (ADR-120).

Colin's steer: the alignments display's settings are linked, a filter applies
across its parts, and a value that menu actions keep in step is "just
duplicated in config"; he wants config to be elegant, with a "shared source of
truth". He chose `variants` as the variant band's name and kept the coverage
band painting sequencing errors, and asked the session to arbitrate the
reviewers' disagreements and the pre-5.0 sweep. Two review rounds shaped the
decision: Opus reviews of the design against the ADRs and of the mechanism, a
Fable cold read of the generated config reference, then an Opus and a Fable
review of the revised plan.

## Context

- **Connections are drawn twice and filtered once.** Under ADR-231 each band
  has a `filter` of its own, so each predicate is stored once. The arc and
  cloud band reads `readConnections.filter`; the curved connectors that
  `pileup.showConnectors` draws over the reads read no filter
  (`features/linkedReads/`), and "Inter-chromosomal evidence → Hide" leaves
  their curves on screen.
- **The two connection marks disagree in color.** The connectors paint by pair
  orientation (an eight-slot table of their own), the arcs by
  `readConnectionsColorField`, which resolves to `insertSizeAndOrientation`
  under the default read color. The display draws a long-insert pair as a
  long-insert arc over a connector painted as a normal pair.
- **Predicates sit beside `filter` on other displays.** Canvas has
  `hideSourceFeatures` and `showOnlyGenes` (an admission test in
  `featureAdmission.ts`); the multi-sample variant display has
  `minorAlleleFrequencyFilter` and `maxMissingnessFilter` beside a jexl
  `filter` list. ADR-218 chose two `filter` shapes, a list on the feature
  displays and an object on alignments, and the variant display needs both.
- **The write mode is inferred.** `namespaceMetadata` (`getConf.ts:150`)
  replaces an object whole when its schema declares a `shorthand` and merges it
  member by member otherwise. ADR-215 declined declaring the mode because the
  shorthand said the same. A list shorthand on `filter` needs member merging,
  which the inferred mode cannot give it.
- **The plot words are a hand list in core.** `PLOT_VOCABULARY` (`plot.ts:33`)
  names alignments and MAF band objects, so a plugin's band reaches "Edit
  plot..." only through a core edit. The external graph plugin's display relies
  on the list by slot name.
- **Sashimi needs coverage.** The worker extracts junctions and fetches splice
  motifs inside the coverage branch (`runCoveragePipeline.ts:114-139`,
  `executeRenderAlignmentData.ts:383`), so with coverage hidden the display
  draws no sashimi arcs, while it draws read connections in a strip of their
  own (`reservesArcsBand`, `sectionLayout.ts:124`).

## Decision

### Rules

1. **A predicate lives where what it selects lives.**
   - A display's `filter` holds its tests on the records it fetched and on the
     data derived from them. A display declares `filter` only when its model
     reads one (`featureFilterConfigSchema.ts` records the bug
     otherwise).
   - A hidden facet section is `facet.hidden`; a row selection is `rows.kept`.
   - A `show*` slot toggles something drawn and never filters.
   - Every part that draws one kind of data reads the same two settings for
     it: `filter`, which decides whether the display draws an item, and the
     data's color channel. Size, place, shape and line width stay each part's
     own.
2. **A band is fixed or the remainder.** A fixed band is `{ show, height, … }`;
   the band that takes the height left over (`pileup`, MAF's `alignments`) is
   `{ show, … }`. The display draws a band with a `placement` over its host
   while the host is shown and in a strip of its own otherwise, and
   `placement`'s doc says so.
3. **A guide is a top-level `show<Guide>`**: `showLegend`, `showTree`,
   `showBranchLength`, `showRowLabels`, `showRowSeparators`, `showLaneTicks`.
   The tree sidebar slots stay flat: row labels draw over the plot
   (`treeSidebarConfigSchemaFields.ts:55-58`).
4. **A schema declares its plot words.** A slot definition, a field table or a
   sub-schema takes `plot: true`, inherited through `baseConfiguration` (a
   subclass opts out with `false`); a list of sub-schemas is wrapped in
   `plotList`, since an MST array has no options. `plotKeysOf` reads them in
   definition order. "Edit plot..." links each key to its row in the config
   reference, so the slot's own description is its one explanation. A plot word
   names something drawn from the track's source, and its members count with
   it: the channels, the bands, the mark lists and their parameters
   (`modifications`), and the text channels (canvas `labels`, multi-way
   `text`). Hover preferences such as `showTooltips` stay outside the plot, as
   does `rowGroups` until the dialog should show the row grouping.
5. **A schema with a `shorthand` declares `writes: 'whole' | 'members'`.**
   `ConfigurationSchema` throws at construction when one is missing, beside
   `checkShorthand` (`configurationSchema.ts:199`); a schema with no shorthand
   merges member by member. A channel whose members are alternatives (every
   color object, `facet`, `rows`, `sort`, `rowColor`) writes whole. A shorthand
   may also be a list, so `filter: ['jexl:…']` stays legal and merges as
   `{ expressions: [...] }`. An agent's plot write (`applyPlot`) follows the same mode,
   so a `filter` list writes `filter.expressions` and leaves the MAF and
   missingness thresholds, a `null` member resetting that member. The "Edit
   plot..." text is the whole plot instead (`{ whole: true }`): an example
   lands over the plot as a bag does, so the text shows what it leaves, and a
   line deleted from the text resets.

### The alignments display

```js
filter: {
  flagInclude, flagExclude, minMapq, tags,          // which reads count
  readName, svSignal, split, spliced, alone,        // which reads draw
  junctions: { minReads, nonCanonical },
  connections: { interchrom, offscreenMates, minInterchromReads },
},
coverage:        { show, height, showInterbaseIndicators, minAlleleFraction },
pileup:          { show, readHeight, maxLayoutHeight, showMismatches, showSoftClipping,
                   showOutline, showConnectors, fadeLowBaseQuality, fadeLowFrequency },
sashimi:         { show, height, placement, showCounts },
readConnections: { show, mark, height, placement, lineWidth, color, showOrdinaryPairs },
```

- The sashimi arcs, their counts, the down strip's reservation and the tables
  engine's junctions read `filter.junctions`. The arcs, the read cloud, the
  connectors over the pileup and the tables engine's arcs read
  `filter.connections`.
- `readFilterOf` (`readFilterConfigSchema.ts:124`) hands the worker the read
  members by name, so an edit to `junctions` or `connections` redraws without
  a refetch.
- The comments mark the line ideas/ready/category-filters-leave-coverage-whole
  draws: flags, MAPQ and tags thin coverage, the categories pick drawn reads.
  The line stays in the slot docs and the Filter dialog's headings; each
  member's reach is fixed, so nesting would only add depth.
- The connectors paint by `readConnectionsColorField`, as the arcs do, under
  the shared-meaning rule; `readConnections.lineWidth` stays the band's.
- The coverage band colors an allele segment only at or above
  `coverage.minAlleleFraction` (default 0) of its position's depth, the menu's
  "Color SNPs above…". The member stays a color rule beside
  `pileup.fadeLowFrequency`, under which the pileup fades a mark by the same
  per-base share through a depth-dependent threshold, never at 1 bp/px or
  closer, and drops the faded marks from hit testing. MAF keeps the member
  through the shared `CoverageBand`.
- Under rule 2, the worker extracts junctions and fetches motifs under a
  derived `junctions: coverage.show || sashimi.show`, an RPC argument
  defaulting to true, so a sashimi toggle with coverage shown refetches
  nothing. With coverage hidden the effective placement is `down`, drawn in the
  existing strip. LGVSyntenyDisplay gets no sashimi default of its own: a
  synteny block has no introns, so the slot belongs off its schema (Loose
  edges).
- `filter.tags` replaces `filter.tagFilters`; v4's `tagFilter` lifts into it.

### Other displays

| Display | After |
| --- | --- |
| LinearBasicDisplay | `filter: { expressions, genes }`; `showOnlyGenes` becomes `genes: 'only'`, with `exclude` built too; `hideSourceFeatures` goes and the source record always drops |
| LinearVariantDisplay, LinearMarkDisplay | `filter: { expressions }` |
| LinearMultiSampleVariantDisplay | `filter: { expressions, minMinorAlleleFrequency, maxMissingness }`; `variants: { show, height, showLabels }` replaces `showVariantLane`, `variantLaneHeight`, `variantLaneLabels` |
| LinearMafDisplay | `alignments: { show, rowProportion, showAllLetters, showAsUpperCase, showInversions, showAnnotations }`; `showReferenceRow` stays top-level |
| LDDisplay, LinearHicDisplay | `heightMode: 'fixed' \| 'fit'` replaces the triangle's `squashToHeight` |
| LinearBasicDisplay | `showChevrons` replaces `displayDirectionalChevrons` |

`minMinorAlleleFrequency` names the measure whole: allele frequency is not the
minor allele's, which is at most 0.5.

- `featureFilterConfigSchema` (display-kit) is `FeatureFilter`, `{ expressions }`
  with its list shorthand; `BasicFeatureFilter` and `VariantFilter` extend it.
  Each display declares `filter` itself, so no spread table hides the
  sub-schema from the config reference.
- The worker reads the whole `filter` off the display config, so `genes`
  travels as a member and no `showOnlyGenes` RPC argument stands beside it.
- `genes` is a category as a read category is, under "Filter by... → Genes"
  through the one `categoryFilterItem`. `CATEGORY_FILTERS` and that item live
  in `@jbrowse/display-kit/categoryFilter`, read by both plugins.
- The model and RPC names follow the config words: `minMinorAlleleFrequency`
  and `maxMissingness`, with `setMinMinorAlleleFrequency` and
  `setMaxMissingness`.

### The pre-5.0 sweep

The cold read listed spellings the rules do not reach. After the tag a rename
costs a `retired` entry kept for good, so the trivial ones go now.

| Item | Call |
| --- | --- |
| `filter.tagFilters` → `filter.tags` | now, with the alignments filter |
| `filter.singletons` → `filter.alone` | now: samtools' singletons are a paired read with its mate unmapped, a subset, and `filter.connections.offscreenMates` names a narrower set; v4's read cloud `drawSingletons: false` lifts into it |
| `squashToHeight` → `heightMode: 'fit'` | now: beta-only, no external writer |
| `displayDirectionalChevrons` → `showChevrons` | now, with a `retired` lift (v4.3.0) |
| canvas `displayMode`, which holds size presets and `collapsed` | later, with a lift |
| multi-row `rowHeight: 0` → `heightMode: 'fit'` | later: needs `HeightModeMixin` on five displays |
| a MultiWay `ribbons` object for `ribbonColor`, `drawCurves`, `bridgeSkippedLanes` | later |
| `modifications.shownModifications`, the modification types the display draws | later, its own look |
| one `labels` spelling across displays | never: the remaining label words name different things |
| MultiWay `lane` → `row` | never: the lane is that display's own unit, spelt alike in its five slots |
| `clusterField: ''`, `minBpPerPx: 0` | never: `''` is every absent field, and 0 is no minimum |

## Rejected

| Proposal | Why |
| --- | --- |
| Band-scoped filters kept in step by menu actions | Every shared predicate stored once per band, and a share link, an agent's plot, jbrowse-img and ggjbrowse write config without the actions, so the copies can disagree |
| A cascade, a band `filter` overriding the display's | An unset category means unfiltered (ADR-231), so a band could not say "unfiltered here". A narrowing band `filter` is coherent but nothing asks for a split, and adding one after 5.0.0 breaks nothing |
| Filters by reference, or as ordered `transform` steps | Indirection for one-to-one links; and the read members run in the worker, where no main-thread step reaches |
| `filter.sample` and `filter.drawn` | Each member's reach is fixed, so the split adds depth and moves the v4 `filterBy` lift's target |
| `filter.alleles` for the coverage floor and the pileup fade | Two rules over one quantity: a flat color floor at every zoom, and a depth curve that also gates clicks. One setting would hide a real low-fraction mismatch or put the curve on coverage |
| `readConnections.placement: 'pileup'` for the connectors | `mark` would mean nothing under it, and arcs with connectors could not draw together |
| `readConnections.showOrdinaryPairs` into `filter.connections` | Its unset would mean the mark's default where every other category's unset means unfiltered (ADR-231's reason; proposed a third time) |
| A `sidebar` object | Row labels draw over the plot, and a boolean `sidebar.showLabels` would sit beside the enum `showLabels` |
| One connector-zone object for LD and the variant display | Two members the variant display never reads; the zone is the `columns` layout's guide, and `lineZoneHeight` already means one thing on both |
| `hideSelfAlignments` into the read filter | A section hide applied on the main thread (`displayHiddenGroupKeys`); as a read member it would refetch |
| MultiWay `hideUnlabelled` into a filter | A paint rule (`colorFunctions.ts:444`) shared with the linear synteny, dotplot and chord views' state |
| A `preProcessSnapshot` turning a `filter` list into `{ expressions }` | Leaves the inferred write mode wrong for the one schema that broke it |
| A boolean shorthand (`sashimi: false`) | Nothing uses one |
| `sites` or `variantLane` for the variant band | Colin chose `variants`, named for what the band draws as `coverage` is |
| A raised coverage allele floor (IGV's 0.2) | Colin: the band paints sequencing errors |
| `expressions` on the alignments filter in 5.0 | No figure asks for a per-read expression, and adding the member later breaks nothing |
| A dialog line per plot declaration (`plot: '<line>'`) | A second owner of each slot's description (ADR-091's objection), copied lines already listing members step 3 removes; the dialog links each key to the config reference instead |
| Plot-word kinds compared at every depth, with an allowlist | Slot types give noise (`boolean` beside `maybeBoolean`, `color` beside `maybeColor`) and coarse kinds find nothing past the top level, where `filter` is the one mismatch step 4 removes |
| A schema `omits` option, dropping inherited slots, for LGVSyntenyDisplay's `sashimi`, `filter.junctions`, `baseColor` and `modifications` | Colin chose a shared base: `BaseLinearAlignmentsDisplay` and `BaseAlignmentsFilter` hold what both displays read, and the model reads the four through `readsConfOf`, so an unguarded read fails to compile where an omitted slot would read `undefined` |

## Consequences

- **Amends** ADR-204 (the hand list goes), ADR-215 (the declared write mode),
  ADR-218 (`filter` is one object with a list shorthand) and ADR-231 (the band
  filters move into `filter`, `coverage.filter` becomes
  `coverage.minAlleleFraction`, and its Rejected row on data-named filters
  falls for connections, which two parts draw). GRAMMAR_OF_GRAPHICS.md's band
  section follows when the alignments step lands.
- **A rename can read `undefined` without failing.** `readConfObject` returns
  `undefined` for a name the schema no longer declares, so a stale
  `getConf(self, 'oldName')` compiles. Each rename gets a grep sweep beside its
  `retired` lift.

### Order of work

1. **The write mode.** `writes` on every shorthand schema, the construction
   check and the list shorthand form (`schemaTypes.ts` takes string and number
   today).
2. **Declared plot words.** The `plot` flag and `plotList`, `plotKeysOf`
   reading them, `PlotExamples.test.ts` pinning every display's plot keys and
   that a key is flagged on every display declaring it or on none, and the
   graph plugin's `color`, `size`, `facet`, `rows` and `layers` flagged in its
   own release. `PLOT_VOCABULARY` existed only in v5 betas, so its removal owes
   no ABI entry.
3. **The alignments filter, in one commit.** `filter.junctions`,
   `filter.connections`, `filter.tags`, `coverage.minAlleleFraction`, and:
   - `setReadFilter` (`configSlotViews.ts:423`) writes members, or every
     Filter menu click resets `junctions` and `connections`;
   - `wholeFilterOf` (`retired.ts:244`) nulls only the read members;
   - the connection menu rows enable while either the band or the connectors
     draw (`menus/readConnections.ts:73-76`);
   - the connectors take `filter.connections`, including the
     `minInterchromReads` cluster count while the band is off;
   - `fetchAutorun.test.ts` pins that a junction or connection edit does not
     refetch;
   - the tables engine, jbrowse-img, the spec-recipe and ggjbrowse follow.
4. **`filter` objects on canvas, mark and the multi-sample variant display, in
   one commit,** with every `Array.isArray(filter)` reader: `baseJexlFilters`
   (`core/util/jexlFilters.ts:50-55`), `retiredFilterState` (:83-89), the
   variants and canvas tables, canvas `plotProblems.ts`, jbrowse-img's
   `readFilterSnapOf` and the spec-recipe's `filterStep`. LinearBasicDisplay
   redeclares the spread `filter` to add `genes`. `minorAlleleFrequencyFilter`
   and `jexlFilters` lift. The same commit adds the check that a plot word is
   the same top-level kind (slot, sub-schema or list) on every display
   declaring it, which `filter` fails until then.
5. **The sashimi fallback.** Built: the placement row greys out without
   coverage, as every arc draws down.
6. **The connectors' color**, a picture change shot before and after.
   Built: each connector carries its arc slot under every color field, packed
   in its color type, and the field picks one at paint time, so a recolor
   reclassifies nothing; a split read joining two chromosomes paints
   inter-chromosomal, as its arc does.
7. **`variants`** on the multi-sample variant display, flagged `plot`. The
   names are beta-only, so no lift; jb2hubs' pangenome configs and share links
   (`website/src/components/pangenomeLinks.ts`) update in step.
8. **MAF `alignments`**, flagged `plot`, lifting the v4 mafviewer plugin's
   `rowProportion`, `showAllLetters` and `showAsUpperCase`.
9. **The sweep's "now" rows.**

### Loose edges

- A read-category edit still refetches: the worker compacts the reads, and
  Idea 2 leaves the category filters in the worker.
- The tables engine exports no connectors.
- Chain layout's cross-region links read no filter: they join one molecule's
  alignments, as its connecting lines do, and draw with the curved connectors
  off.
- The breakpoint split view's overlay reads `filter.expressions` alone, so
  it can draw a connector to a feature that `filter.genes` hides.
- `hideSelfAlignments` and `hideUnlabelled` keep their names, and MAF's
  `showReferenceRow` stays a top-level toggle of the row the worker named as
  the reference; `rows.kept` is the reader's own selection.
