---
name: sv-channels-preset-redesign
description: "Track menu → Presets → SV channels (landed 2ac114015f) hides every band's reads, which Colin called judgemental. Three review rounds converged on a filter spelling: build category-filters-leave-coverage-whole Idea 2, key svChannel per chain in read mode, make a filter-list write merge by field, then the preset writes facet svChannel + filter svSignal + pileup.show true + arcs + ordinaryPairs off + sashimi off. Open: a grammar-spelling review (svChannel vs svSignal as one field, the boolean predicate shape) was stopped before it reported; Grow-the-track is settled from captures."
---

# SV channels: from hiding the reads to a filter

## Landed

- `2ac114015f` and its parent: SV channels is a one-shot action under Track
  menu → **Presets** (`plugins/alignments/src/LinearAlignmentsDisplay/menus/presets.ts`,
  settings and `matchesSvChannels` in `menus/svChannelsPreset.ts`), calling
  `applyPlot` then `persistTrackConfigNow`. ADR-258 and ADR-237 amended.
- Today it writes `pileup.show: false`, `facet: { field: 'svChannel' }`,
  `readConnections: { show: true, mark: 'link', ordinaryPairs: { show: false } }`,
  `sashimi.show: false`.

## Colin's calls so far

- Hiding reads in every band is "judgemental". Reviewers agreed: arc
  right-click resolves to nothing (`hitTestPipeline.ts`), the guide's routes
  out of the evidence need a read, and the chip's coverage-only chevron only
  renders while the pileup shows. The noise is the `none` band.
- `coverageOnly` (a keyed facet member) was rejected as a spelling ("sounds
  weird"); a camelCase compound slot is a grammar smell.
- Configurable presets: raised by Colin, declined for now by the reviews (a
  lab's own arrangement is `displayDefaults`; `plotExamples` are plugin code,
  not "people make their own"). Park in ADR-258 as a Rejected row naming the
  config-side spelling (a `presets` list on the display config, merged by
  label) for when asked.
- ADR-257's "the row axis owns its settings" is open for reuse here, but both
  design reviewers declined section settings under `facet`: SectionFacet is
  shared with displays that have no coverage (ADR-257 itself declined
  `facet.collapse`), band height exists unfaceted, and reads' predicates live
  in `filter` (ADR-232 rule 1).
- Blast radius is not a concern next to the right design.
- Never `applyPlot(..., { whole: true })` for a preset: it nulls `unit`,
  `filter`, `sort`, `encoding`, `coverage`, soft clips and arc placement,
  including `displayDefaults` values.

## The converged plan (rounds 1–3)

1. **Build `ideas/ready/category-filters-leave-coverage-whole.md` Idea 2.**
   Category fields (`svSignal`, `split`, `spliced`, `alone`, `name`) pick drawn
   reads only; flags, MAPQ and tags also thin coverage. One `filter` word, the
   reach stated in the slot doc (today's doc says the opposite). The idea
   doc's line numbers are stale: `sampleFeatures` ~321, `selectChains` ~331,
   `partitionFeatures` ~345 in `executeRenderAlignmentData.ts`; `dropsRead`
   is `dropsRecord`; worker change 2 already holds on main. Move `name` and
   `spliced` into `filterChainFeatures` so pileup, consensus, `exportedReads.ts`
   and `GetGlobalValueForTag` share one drawn-read definition. Compact once
   after the detail arrays. Bench gate: a filtered render within 1.1x of the
   unfiltered render at the same locus (no bench drives
   `executeRenderAlignmentData` today; `readPath.profile.ts` no longer runs).
   Five `cancer_sv` figures relying on `split` thinning (incl.
   `realigned_reads`) get a `split` facet.
2. **`svChannel` keys per chain in read mode too** (`chainSvChannelKey`):
   `svSignal` keeps whole chains, so today a split read's concordant mate
   passes the filter and files as `none` (38 of 40 split primaries in
   `volvox-sv.bam`). Make `withSvTier` and `splitReadChannel`
   (`shared/svChannel.ts`) agree on the two edge cases (an unadjacent placed SA
   piece; MAPQ-0 with adjacent SA) so ADR-258's "`none` holds exactly what the
   filter hides" is true. Share one chain grouping between the keep mask and
   the partition.
3. **A bag write of a predicate list merges by `field`**
   (`mergeConfSettings`, `packages/core/src/configuration/getConf.ts`): an entry
   replaces its field's entries, `{ field }` alone removes them, `null`
   resets. Today `applyPlot({ filter: [svSignal] })` drops a user's MAPQ and
   tag entries, against `applyPlot`'s own doc.
4. **The preset becomes**
   `facet: { field: 'svChannel' }`, `filter: [{ field: 'svSignal', equal: true }]`
   (check the real category spelling, `categoryEntries`), `pileup: { show: true }`
   (tracks the current preset touched hold `false`),
   `readConnections: { show: true, mark: 'link', ordinaryPairs: { show: false } }`
   (a split read's concordant mate still draws a grey arc),
   `sashimi: { show: false }`. `matchesSvChannels` follows; so does
   `products/jbrowse-web/src/components/NoConfigMessageSampleData.ts`
   (`volvoxSvChannelsTrack`). The chip offers no coverage-only chevron on a
   band drawing no rows.
5. Docs: `sv_visualization.md` (SV channels section, band diagram, the "way
   back" sentence), `alignments_track.md`, `sv_multisamples.md`; figures
   `sv_channels`, `sv_channels_long_reads` (`website/scripts/specs/sv.ts`,
   their hand-set heights).

## Next

- **Grammar-spelling review, not yet run to a result.** Questions: should
  `svSignal` and `svChannel` be one field (filter `svChannel ≠ none` beside the
  facet), is `{ field, equal: true }` the right boolean-category predicate,
  are `readConnections` / `ordinaryPairs` / `mark: 'link'` in the right roles,
  should the sample-vs-drawn reach be spelled in config rather than the slot
  doc, and are "Presets" / "SV channels" the right words.
- Then build steps 1–4 in a worktree, Idea 2 first.
- Capture before/after at the 1000 Genomes INVdup locus and HG008-T CDKN2A
  long reads for Colin; decide from them whether the preset also writes
  `heightMode: 'grow'` (not a plot key, so through the display's setter).
- Another session had uncommitted work on `tables.ts`' coverage band and the
  hit test in the primary checkout; rebase over it.
- Unrelated red on main: `pnpm verify --full` esm build TS2883
  `HairlinesByGroup` (`plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts:70`),
  from `14c8581a0f`.
