---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-27. Plugin 4.0.9 is in the store, and the portal and demo graph tracks are GraphTrack. Left - a stale rgfa_launch_roundtrip caption, the curated eight on hprc_v2_1_gbz_lanes, gbz-base writing M for mismatches, the anchored KIV-2 cut that never lands, and two of Colin's calls (PangyPlot chr1, a GSTT1 section).
---

# HPRC graph: the overview and alignments between haplotype lanes

Colin's goal, 2026-09-20: a structural picture of the graph zoomed out, and
base-level detail zoomed in. How lane pairs work now is
[MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md) §1.1;
what they cost is
[PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) §"Lane pairs read off
the hosted HPRC graph"; the graph track's design is the plugin's
`agent-docs/GRAPH_TRACK.md`.

## Open

- **`rgfa_launch_roundtrip`'s caption** (`graph_genome_view.md`) still says
  "segment s1277 in the segments lane" over a frame showing Display types →
  Graph.
- **`demos/hprc`** has no `defaultSession`, and its `hprc_v2_1_gbz_lanes` names
  only the curated eight, so switching that track on meets the panel Colin
  rejected.
- **gbz-base's `Subgraph.alignment()` writes `M` for match and mismatch alike**
  (`src/subgraph.ts`), so the anchor gutter inks no mismatch until it writes
  `X`.
- **The anchored cut of the KIV-2 window** (the portal's LPA card, `auto`
  layout) sits on "Fetching subgraph" past three minutes; the force layout's
  window-only cut lands quickly. One hop through a 129-route VNTR plus a
  window-width margin each side is the suspect.
- Smaller: the bovine callset lacks `renderingMode: "phased"`;
  `ecoli_minigraph` has no hosted tier and `build_ecoli_pangenome_graph.sh`
  builds none; ecoli, cactus, chrM, syri and the host page lead with a build;
  `pggb_bubble_tier`'s bubble labels overlap the backbone's length labels; a
  stack cuts the window once per adjacent pair (0.3-1 s each warm), and cutting
  once per stack is the speed lever; `pairAlignments` returned FLNA's inversion
  record twice with identical spans.

## Colin's calls

- **PangyPlot at v2 scale: chr1.** chr22 of v2.1 (3.12M nodes, 1,131 walks)
  laid out in 32 minutes with gbz2layout's `perf` branch (`--balanced
  --updates-mult 100`, the init anchored on GRCh38; numbers in
  `~/src/vendor/gbz2layout-perf/PERF_NOTES.md`) and reads the same as the
  hosted v1.1 (`~/tutorial_spikes/pp_v2/`, `shots/pp_v2_*.png`). chr1
  (amylase) needs the whole-genome export (chr22's peaked at 14.5 GB) and about
  five times chr22's nodes.
- **A GSTT1 tutorial section.** Its graph is compelling (a 39.5 kb allele loop
  beside GSTT4, contributed by HG03654#2), but CAT projects GRCh38's genes and
  GRCh38's chr22 has no GSTT1, so no haplotype's annotation names it, and
  HPRC's PAF targets the no-alt set, so nothing hosted shows the gene on a
  haplotype. Either a data product for GRCh38's alt-contig genes on each
  haplotype, or a section that says the annotation cannot see it.
