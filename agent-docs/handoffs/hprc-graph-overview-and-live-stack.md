---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-25. The gutter aligner is deleted, so every gutter below the anchor composes through GRCh38 — and composition now carries the two records' own alignment, so those gutters draw indels and mismatches rather than a bare ribbon, the marks bounded by the pixel and faded to their width. Sequence two haplotypes share that GRCh38 lacks still draws as nothing; a graph-stated successor is unbuilt. The plugin is unpublished with that deletion. Walk rows draws every haplotype on its own bp, and naming the haplotypes returns whole walks where the cohort cut splits them. PangyPlot's v2.1 chr22 overview is done; chr1 is Colin's call.
---

# HPRC graph: the v2 overview and alignments between haplotype lanes

Colin's goal, 2026-09-20: a structural picture of the graph zoomed out, and
base-level detail zoomed in. PangyPlot does the whole-genome overview; this
thread covers comparing chosen haplotypes at a locus.

## 1. PangyPlot's overview at v2 scale: chr1 is the open call

chr22 of v2.1 (3.12M nodes, 1,131 walks) laid out in 32 minutes with the
`perf` branch of gbz2layout (`--balanced --updates-mult 100`, the init anchored
on GRCh38; numbers in `~/src/vendor/gbz2layout-perf/PERF_NOTES.md`), ingested
into `~/tutorial_spikes/pp_v2/ppdata` as db `hprcv2`, and captured beside the
hosted v1.1 at three windows (`shots/pp_v2_*.png`); it reads the same.
`tools/pprun.sh`, `tools/add_chr.sh <chr> <layout>` and
`tools/compare_shots.sh <dir>` run it. chr1 (amylase) needs the whole-genome
export (chr22's peaked at 14.5 GB) and about five times chr22's nodes.

## 2. Alignments between haplotype lanes: where it stands

**Colin's constraints (2026-09-24).** No analysis in the plugin and no aligner
of our own ("we can be wrong and misrepresent the data"). Tutorials show other
people how to navigate their pangenomes: the browsing user runs no commands;
the host prepares data once, from files the pangenome pipeline already emits.

**Direction both design reviews reached, then fitted to those constraints.**
The host builds an all-vs-all PAF over a panel of haplotypes (`minimap2 -c
--eqx -x asm20`, primaries; a pggb or wfmash pipeline emits one already),
indexes it with `jbrowse make-pif`, and serves it through
`MultiGenomeIndexedPAFAdapter`. That adapter names no star anchor, so
`MultiWaySyntenyDisplay` fetches each adjacent pair directly and any lane order
keeps every gutter a stated alignment. Haplotypes outside the panel stay lanes
against GRCh38, their gutters composed through it. The gutter aligner has since been deleted outright (below);
`scripts/build_graph_haplotype_stack.sh` stays, being offline. gbz-base keeps
locating haplotypes and the graph view. impg reads local files only and HPRC's all-vs-all set is
sparse, so it is a host-side prep tool, not a gutter source.

**Colin rejected the curated panel (2026-09-24)**: a hand-picked 8-16 shows
that we are not truly pangenome ready, and puts the GBZ effort in question. So
the panel plan below is not agreed, and what replaces it is open.

**Answered 2026-09-25.** A gutter mismatch fades with its width
(`KIND_BASE_TILE`) rather than holding ≥1 px at full colour — a difference you
cannot yet read fades out. Captures:
https://claude.ai/artifact/JnHcRi5HCJKyJD39oEhA86

**Next, in order.**

1. Time one whole-genome haplotype pair with minimap2 on ada (wall time, RSS,
   PIF bytes, and whether its records at the six loci below match the window
   runs). The panel's cost follows: 36 pairs for eight haplotypes plus GRCh38,
   estimated 70-200 CPU-h and ~0.5 GB hosted.
2. Build and host the panel all-vs-all for the `demos/hprc_multiway` eight and
   check it at the six loci.
3. Rework the HPRC tutorials around click paths on a hosted instance, with one
   "host your own pangenome" page for the prep. A read-only map found only
   part 1 → part 2 is a real sequence; part 3 is three separable sections.
   Retitling by topic without renaming files breaks no link.

**Measured 2026-09-24** (scripts in `~/tutorial_spikes/lane_pairs/`:
`pairbench.mjs`, `bubblebench.mjs`, `mm.sh`; captures under `captures/`):

- gbz-base per adjacent pair, context 1000: cut 0.3-1 s warm (3-7 s cold),
  align 0.06-3.5 s. Share of each walk the graph states (shared nodes, 1-vs-1
  SNPs, one-sided indels): C4 and CFH ~100%, HLA-DR 64-94%, amylase 33-64%,
  LPA KIV-2 15-99%.
- 1q21.1 inversion (chr1:144.40-144.52 Mb, carrier HG01891#1): the cut holds
  4 kb of the carrier's walk, and the graph pairs it with the other
  segmental-duplication copy (88%) rather than its allelic position on −
  (100%). minimap2 on the assembly windows: one − record, 112.7 kb, 99.9%.
- minimap2 reproduces C4's 32,738 bp module and 6,367 bp HERV-K insertions
  exactly; CFH is one record per pair; HLA-DR depends on the preset; at
  amylase and LPA a copy-number difference lands at an arbitrary copy.
- HPRC's assemblies publish `.fa.gz` with `.fai` and `.gzi`, so windows are
  range-readable.

**The gutter aligner is deleted.** `lanePairsOnAnchor` and everything it
reached are gone from both repos: the capability, `pairFeatures`,
`referencePieces`, `pairFeature`, `PairTargetError` and `laneHaplotypes` in the
plugin, and `adapterPairsOnAnchor`, the anchor-window fetch branch and
`queryAssemblyName` in core. Every gutter below the anchor now composes through
the reference. `Subgraph.pairAlignments` stays in gbz-base's CLI (`--against`,
`--stack`), where a host runs it offline and the result arrives as a file.

What that gives up, and it is real: sequence two haplotypes share and GRCh38
lacks has no anchor interval to compose through, so a band draws nothing there.
A graph-stated successor would emit shared-node runs as `=` and everything else
as explicitly unaligned, which needs no DP; nobody has built it.

**The plugin is not published with this.** Its configs name an unversioned
unpkg url, so publishing moves every hosted config at once.

**Found along the way, unfixed.** `demos/hprc/config.json` has no
`defaultSession` and its `hprc_v2_1_gbz_lanes` names only the curated eight, so
a reader who switches that track on meets the panel Colin rejected. gbz-base's
`Subgraph.alignment()` writes `M` for match and mismatch alike, so the anchor
gutter inks no mismatch until that one line writes `X`.

**A composed gutter carries the composed alignment.** `composeLaneLinks` used to
hand a gutter a ribbon and nothing inside it, so deleting the aligner would have
left every lane pair below the anchor blank. It now steps the two records
through each other (`composeAlignmentOps`): over the anchor stretch both cover,
a base each lane places is a match between them, a base only one places is that
lane's own insertion, and a base one calls a mismatch while the other calls it a
match is a mismatch between the two. Where BOTH call it a mismatch the file has
not said whether they share the alternative, so the op is `M` and no mark draws,
and an insertion both make at one anchor point is `M` for the length they share.
The second matters wherever GRCh38 carries the minor allele: at
chr1:103,619,894 five HPRC haplotypes on one graph path each state `I35`, which
composed one lane at a time drew as an indel pair between identical lanes.
Nothing is aligned here; every op comes from an op the file carries. Stepping
them through each other also places the stretch where the alignment puts it
instead of where the record's overall ratio does, which is finding 4.1's
remainder in `reference/MULTIWAY_SYNTENY_DISPLAY.md`.

Mismatches sharing a pixel on both lanes draw as one mark carrying their
mismatched length, so a gutter emits at most one per pixel of its width: the
eight hosted `demos/hprc_multiway` records state 85,864 mismatches at the widest
window the fine tier serves, against a 1,588 px canvas. The `alignmentDetail`
gate is gone with the asymmetry it protected — a record with ops draws them,
wherever it sits.
