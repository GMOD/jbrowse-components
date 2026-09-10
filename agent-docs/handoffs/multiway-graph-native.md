---
name: multiway-graph-native
description: The multi-way synteny display now reads eukaryote-scale alignment sources (a star of pairwise PIFs, a PanSN multi-genome PIF, and a graph-native adapter that lives in jbrowse-plugin-graphgenomeviewer) while the HPRC demo's alignments are still unpacked from the graph's GFA offline — waiting on coarse tiers for the hosted liftOver PIFs and four smaller items the reviews left open. The three tutorial figures this file once owed are shot and current as of 2026-09-09. Read before touching MultiWaySyntenyDisplay's fetch, the multi-genome adapters, or gfa_to_pairwise_paf.py.
---

# Multi-way synteny, graph-native: handoff

Thirteen commits landed on main on 2026-09-05, `1651f48a19` through
`67b2db03d2` (match by subject if they have been rebased). What they settled is
in the permanent homes: the display's design record in
[ideas/multiway-synteny-lgv-track.md](../ideas/multiway-synteny-lgv-track.md),
the wire shapes in [reference/ORTHOLOG_TABLES.md](../reference/ORTHOLOG_TABLES.md)
and [reference/SYNTENY_LOD.md](../reference/SYNTENY_LOD.md), the two unpackers
and their measured agreement in
[reference/HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) and
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md), the demos in
[reference/DEMO_DATASETS.md](../reference/DEMO_DATASETS.md). This file holds
only what is still open.

## The contract a graph-native adapter has to meet

The display asks one adapter two questions, and both are answered today by
files `make-pif` wrote from a PAF that a script unpacked from the graph ahead of
time:

- `CoreGetFeatures` on the anchor with no target, `mateShape: 'grouped'`,
  `clipToRegion: true`, `splitAtGapBp: 10000`, `lodMode`: every haplotype's
  alignment to the anchor over the requested window, each record already
  clipped to the window and cut at every indel of 10 kb or more into one
  feature per gap-free run (ids and `syntenyId` numbered per run, so each run
  is its own group and its own placement), with its CIGAR dropped, PanSN
  names.
- `CoreGetFeatures` on an upper mate lane's window with `targetAssemblyName`
  set to the lower lane: the direct records between two mates, or nothing,
  in which case `composeLaneLinks` projects the pair through the anchor.

**`GbzBaseSyntenyAdapter` answers both questions from a `.gbz.db` at query
time.** It landed in core on 2026-09-05 and moved out the same evening, before
a release carried it, to `~/src/jb2plugins/jbrowse-plugin-graphgenomeviewer`,
where its handoff holds the reader decision, the `@gmod/gbz-base` package notes
and the window measurements. What it leaves to the display: `mateShape:
'grouped'` is not implemented (the display reads either shape), and it reports
no coarse tier, so a whole chromosome stays on the bubble tier and the PIF
coarse tier.

`scripts/gfa_to_pairwise_paf.py` is the offline version of exactly that walk,
and its eight jest cases plus the E. coli and HPRC agreement numbers in
PANGENOME_GRAPHS.md are the oracle a query-time implementation is checked
against. An adapter that reads a GBZ has to do at query time what the converter
does once: locate the anchor window on the reference path, take the nodes it
covers, and for each requested haplotype recover its walk through those nodes
in order, emitting shared nodes as match runs and private runs as indels.

The constraint that is the display's rather than the adapter's: **the group key
for a nameless source is the record id.** A query-time adapter emits records
per window, so ids have to be deterministic per (haplotype, first shared node,
window) or the clicked outline and the hover re-resolve wrongly across a
refetch; `clipToRegion` already suffixes ids with the region, which is the
pattern.

The other determinism the lane order rests on is the adapter base's, and it is
settled: `ComparativeAdapterBase.getFeaturesInMultipleRegions` emits its
per-region streams in region order rather than arrival order (`eba6e34b8f`).
Every region still subscribes at once and only the emission waits. The lane
weights can tie exactly, and the sort breaks a tie on first appearance in the
feature list, so before that fix a multi-region view let whichever fetch landed
first decide the stack. `clipFeatureToRegion.test.ts` fails against the old
merge.

## The three figures are shot, and current

Nothing is owed here. This section once asked for three figures the two
tutorials lacked; all three landed in `eb5d6fe58c`, 49 minutes after this file
was written, and `a6bc98aa7e` re-published them on 2026-09-09 along with 34
others. That re-publish is what makes them trustworthy: the earlier captures
predated `05ec50660e` (2026-09-06), which cuts a clipped record at every large
indel, so they drew a lane's frame and its block count the way the display no
longer does. Comparing the superseded `hprc_chr1_whole` against the current one
by content, 8.4% of the frame differs — three haplotype lanes drop from 373 Mbp
1.5× to 249 Mbp 1×, and the right half's blocks are cut into more pieces.

- `multiway_synteny/hprc_chr1_whole` — all of hg38 chr1 over the eight
  haplotypes, the first hosted picture of the coarse tier.
- `multiway_synteny/hg38_vertebrates_17p_break` — the mammal lanes breaking and
  flipping, which TP53 gave the page no negative for.
- `multiway_synteny/hprc_lane_menu` — a lane header menu open.

[ideas/multiway-synteny-lgv-track.md](../ideas/multiway-synteny-lgv-track.md)
§4.10 records the 17p and lane-menu figures as current. **`hprc_chr1_whole` is
recorded nowhere else, so this file is its record.**

## Data

- **The hosted liftOver PIFs for panTro6, gorGor6, ponAbe3, rheMac10 and mm39
  predate the coarse tier**, so the hg38 vertebrates track serves fine detail at
  every zoom. That rebuild is owed as a whole and lives in
  [todo/rebuild-every-hosted-pif-with-the-coarse-cigar.md](../todo/rebuild-every-hosted-pif-with-the-coarse-cigar.md);
  the per-file measurement is DEMO_DATASETS.md's table, which is the list to
  work from.
- **Direct mate-versus-mate links from the graph.** The converter takes any
  path as `--reference`, so the N−1 adjacent-lane pairs can be unpacked
  directly rather than projected; the HPRC demo does not do this yet. It is a
  build-script change plus a second track or a second file the multi-genome
  adapter reads; measure whether the composed projection differs visibly
  first (the E. coli Sakai-vs-CFT073 direct alignment is the worked example).
- **464 haplotypes are not a lane stack.** Half of this moved after the file
  was written: `44e771ef80` gave the display a lane picker over the lanes the
  source declares, held as display state, and `d3593f5440` made a selection
  narrow the fetch rather than only the drawing. What is still parked is the
  provider that would populate such a picker at 464 — the design record's
  TreeSidebarMixin over a "which haplotypes differ here" answer, which is the
  piece that turns the eight-haplotype demo into HPRC.

## Smaller items the reviews left open

- A selected feature's colour still rebuilds every glyph cell on click,
  because the feature-glyph passes carry no highlight id in their uniforms
  (noted in the design record; the ribbons already take one). **There is a
  landed pattern to copy now**: on 2026-09-09 four displays moved their hover
  to ink the chrome draws — `bf7a8196c1` (pileup), `ed7eb5f9ef` (Manhattan),
  `b7bfff9d43` (multi-sample variants), `6a6c1fc70d` (multi-row canvas) — and
  this display is the one that did not.
- A hung lane fetch holds the first-load phase at loading with no deadline.
- `AllVsAllAddTrackComponent` and `resolveAllVsAllQuery` kept their names in
  the rename because they describe the query semantics; revisit if the
  "all vs all" wording confuses a reader of the Add-track form.
- The composed lane links use the display's tier rather than a per-lane tier
  off each frame's bp/px.
