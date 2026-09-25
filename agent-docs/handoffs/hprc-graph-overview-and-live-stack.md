---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-24. Alignments between haplotype lanes were to move off the graph (gbz-base pairAlignments, plugin 3.0.4) to a hosted all-vs-all PAF over a curated panel, which Colin rejected as not pangenome-ready, so the gutter source is open again; an unlanded spike draws each gutter per base. PangyPlot's v2.1 chr22 overview is done; chr1 is Colin's call.
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
against GRCh38, their gutters composed through it. Retire from the gutter path:
`Subgraph.pairAlignments` (our k-mer + DP aligner in the worker),
`lanePairsOnAnchor` in `GbzBaseSyntenyAdapter`, and
`scripts/build_graph_haplotype_stack.sh`. gbz-base keeps locating haplotypes
and the graph view. impg reads local files only and HPRC's all-vs-all set is
sparse, so it is a host-side prep tool, not a gutter source.

**Colin rejected the curated panel (2026-09-24)**: a hand-picked 8-16 shows
that we are not truly pangenome ready, and puts the GBZ effort in question. So
the panel plan below is not agreed, and what replaces it is open.

**Open calls for Colin.** How mismatches are inked in the gutter (≥1 px at full colour, or faded to
their width; captures at https://claude.ai/artifact/JnHcRi5HCJKyJD39oEhA86).

**Next, in order.**

1. Time one whole-genome haplotype pair with minimap2 on ada (wall time, RSS,
   PIF bytes, and whether its records at the six loci below match the window
   runs). The panel's cost follows: 36 pairs for eight haplotypes plus GRCh38,
   estimated 70-200 CPU-h and ~0.5 GB hosted.
2. Land the gutter spike: branch `worktree-multiway-pair-cigar`, commit
   `1fd6d062ce`, worktree `.claude/worktrees/multiway-pair-cigar`. It adds a
   `keepAlignment` clip option (packed ops in `alignmentOps`) and draws each
   record's own indels and mismatches where every gutter is a direct pair
   (`adjacentLanesAlignDirectly`, `addAlignmentDetail`). It needs no plugin
   change for core adapters; `MULTIWAY_SYNTENY_DISPLAY.md` ("never reads a
   CIGAR") and the "per-base alignment lanes" paragraph of
   `ideas/collections/multiway-synteny-lgv-track.md` change with it.
3. Build and host the panel all-vs-all for the `demos/hprc_multiway` eight and
   check it at the six loci.
4. Rework the HPRC tutorials around click paths on a hosted instance, with one
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

**Found along the way, unfixed.** The hosted `demos/hprc/config.json` still
names the retired betabuild plugin (bundle of 2026-09-20, no
`lanePairsOnAnchor`); gbz-base's `Subgraph.alignment()` writes `M` for match
and mismatch alike; the plugin vendors its own copy of `clipFeatureToRegion`
(`src/synteny/`), which has drifted from core's.
