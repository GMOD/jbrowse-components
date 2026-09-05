---
name: multiway-graph-native
description: The multi-way synteny display now reads eukaryote-scale alignment sources (a star of pairwise PIFs, a PanSN multi-genome PIF, and a graph-native adapter that lives in jbrowse-plugin-graphgenomeviewer) while the HPRC demo's alignments are still unpacked from the graph's GFA offline — waiting on three tutorial figures the pages still lack, coarse tiers for the hosted liftOver PIFs, and four smaller items the reviews left open. Read before touching MultiWaySyntenyDisplay's fetch, the multi-genome adapters, or gfa_to_pairwise_paf.py.
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
  `clipToRegion: true`, `lodMode`: every haplotype's alignment to the anchor
  over the requested window, each record already clipped to the window with
  its CIGAR dropped, PanSN names, one feature per record.
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

## Owed to the two new tutorials

Neither page shows what the work claims, and both are one figure each:

- **A whole-chromosome HPRC figure** (chr1 over the eight haplotypes), which
  would be the first hosted picture of the coarse tier at all, and the one
  that says "eukaryote scale" in a picture rather than in prose.
- **A vertebrates window at a synteny break**, where the primate lanes stay
  whole and the mouse, dog and cow lanes break, flip and change contig, so the
  `[rev]` marker and the "also on" contig note appear for a reason. At TP53
  every lane runs straight and the page has no negative.
- **The interaction surface**: one annotated figure of a lane header menu open
  (re-anchor, open in its own view, pin a contig), and a sentence each on
  group hover, lane reordering by drag, and the level-of-detail menu.

Both pages want a shared "reading the stack" section for the scale label, the
reversed marker and what a composed ribbon is. Specs go in
`website/scripts/specs/synteny.ts` beside the two that exist.

## Data

- **The hosted liftOver PIFs for panTro6, gorGor6, ponAbe3, rheMac10 and mm39
  predate the coarse tier** (no `#pif` header, no `T`/`Q` seqids; measured in
  DEMO_DATASETS.md). `MultiPairwiseSyntenyAdapter` offers coarse only when
  every child has it, so the hg38 vertebrates track serves fine detail at
  every zoom until those five are rebuilt with the current `make-pif`. The
  chains are UCSC's; the rebuild is chain → PAF → `make-pif`, whichever script
  wrote the existing ones (find it by the `.over.pif.gz` naming).
- **Direct mate-versus-mate links from the graph.** The converter takes any
  path as `--reference`, so the N−1 adjacent-lane pairs can be unpacked
  directly rather than projected; the HPRC demo does not do this yet. It is a
  build-script change plus a second track or a second file the multi-genome
  adapter reads; measure whether the composed projection differs visibly
  first (the E. coli Sakai-vs-CFT073 direct alignment is the worked example).
- **464 haplotypes are not a lane stack.** The lane-selection provider the
  design record parks (TreeSidebarMixin over a "which haplotypes differ here"
  answer) is the piece that turns the eight-haplotype demo into HPRC.

## Smaller items the reviews left open

- A selected feature's colour still rebuilds every glyph cell on click,
  because the feature-glyph passes carry no highlight id in their uniforms
  (noted in the design record; the ribbons already take one).
- A hung lane fetch holds the first-load phase at loading with no deadline.
- `AllVsAllAddTrackComponent` and `resolveAllVsAllQuery` kept their names in
  the rename because they describe the query semantics; revisit if the
  "all vs all" wording confuses a reader of the Add-track form.
- The composed lane links use the display's tier rather than a per-lane tier
  off each frame's bp/px.
