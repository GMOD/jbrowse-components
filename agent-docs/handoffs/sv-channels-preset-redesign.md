---
name: sv-channels-preset-redesign
description: "Track menu → Presets → SV channels (landed 2ac114015f) hides every band's reads, which Colin called judgemental. Being built in worktree sv-filter-preset (claimed 2026-11-04): step 1 landed as ADR-259 (category filters pick drawn reads and leave coverage whole); next svChannel keyed as svSignal's own verdict, a filter-list write merging by field, then the preset writes facet svChannel + filter svSignal + pileup.show true + arcs + ordinaryPairs off + sashimi off. The grammar-spelling review reported: keep both fields, `equal: true`, the roles and the words."
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

1. **Built: ADR-259.** Category filters pick drawn reads and leave coverage
   whole; `name` and `spliced` moved out of the adapters; one drawn-read rule
   (`drawnReadMask`) for the pileup, consensus, exports and tag dialog; the
   four `cancer_sv` coverage figures take a hidden-unsplit `split` facet.
   Bench (`benches/drawnReadFilter.bench.ts`): 1.02x/1.15x/1.23x on deep
   short reads, the remainder chain grouping by name. Not reshot yet:
   `derivative_inserts`, `derivative_synteny`, `k562_fusion_inspector_reads`,
   `k562_bcr_abl_split`, `realigned_reads` (its coverage now counts every
   read) and `alignments/filter_dialog` (new headings).
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

- **Grammar-spelling review, reported (2026-11-04, one Opus reader).** Keep
  `svSignal` and `svChannel` as two fields (a yes/no test and its refinement;
  one field needs `not` or a five-level `oneOf`), `{ field, equal: true }`,
  `readConnections.ordinaryPairs.show` and `mark: 'link'`, the reach in the
  slot doc, and "Presets" / "SV channels". Its must-changes: step 3 merges a
  draft's entries per field in both `mergeConfSettings` and `writeConfMember`,
  and a bare `{ field }` keeps its stored meaning (drop that field's
  defaults), not "remove the written entries"; step 2 keys `none` as
  `svSignal`'s own chain verdict instead of making two classifiers agree, and
  moves ADR-258's adjacency rule into `withSvTier`; `filterProblems` checks
  the read categories take a boolean (done in ADR-259). Cut
  `SV_SIGNAL_LEVELS` / `SV_SIGNAL_OF_TIER`. Flag for Colin: "channel" means
  an encoding channel elsewhere in the grammar, so `svChannel` could be
  `svKind` while it is beta-only.
- Then steps 2–4 in the same worktree.
- Capture before/after at the 1000 Genomes INVdup locus and HG008-T CDKN2A
  long reads for Colin; decide from them whether the preset also writes
  `heightMode: 'grow'` (not a plot key, so through the display's setter).
