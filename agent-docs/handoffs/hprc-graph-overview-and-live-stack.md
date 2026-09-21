---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-21, after @gmod/gbz-base 2.7.0 shipped haplotype-to-haplotype alignments. Waiting on a gbz2layout run over v2.1 chr22 and the PangyPlot captures that judge its overview against the hosted v1.1 one; a reshoot of the two C4 graph-stack figures; and the graph plugin's GBZ lanes taking pairAlignments instead of composing through GRCh38. Read before re-running a v2 layout, before touching GbzBaseSyntenyAdapter, and before reshooting multiway_synteny/hprc_c4_*.
---

# HPRC graph: the v2 overview test and the live haplotype stack

Colin's goal, 2026-09-20: a structural picture of the graph zoomed out, and
base-level detail zoomed in. PangyPlot does the whole-genome overview well and
follows one haplotype at a time, so the split under test is PangyPlot's approach
for the overview and our own work for comparing chosen haplotypes at a locus.
Memory `pangyplot-v2-scale-is-in-its-own-benchmarks` has the measurements so far.

## 1. Judge PangyPlot's overview at v2 scale (in flight)

Ingest already scales: `~/src/vendor/pangyplot/benchmark_results/timing/per_chromosome_summary_v2_gbz.csv`
loads every v2 chromosome from GBZ on a 15 GB box. The open question is whether
the drawing stays readable with 464 haplotypes, and what the layout costs.

- Running: `gbz2layout` over v2.1 chr22 (3.12M nodes, 1,131 walks), CPU only,
  about 11 minutes per epoch of 30, started 08:05 on 2026-09-21. Everything is in
  `~/tutorial_spikes/pp_v2/`; progress is `chr22.layout.log`, and the result is
  `chr22.lay.tsv` and `chr22.links.tsv`. If the process is gone, rerun
  `setsid nohup bash tools/layout_chr.sh chr22 &`, which skips the finished
  export.
- Then ingest, with PangyPlot's env (rebuild it with
  `python3 -m venv env && env/bin/pip install -r ~/src/vendor/pangyplot/requirements.txt`
  if the old `/tmp` one is gone; the graph daemon is already built at
  `~/src/vendor/pangyplot/gbwt/graphd/pangyplot-graphd`):
  `pangyplot.py add --db hprcv2 --ref GRCh38 --chr chr22 --gbz chr22.v2.gbz --layout chr22.lay.tsv --dir ppdata --force`.
  GENCODE 48 genes are already loaded into `ppdata` as `gencode48`.
- Capture with `tools/ppshot.mjs` at the three windows in `shots/pp_v11_*.png`,
  which are the hosted v1.1 instance (90 haplotypes) at CYP2D6
  (`chr22:42100000-42180000`), APOBEC3 (`chr22:38920000-39020000`) and 8 Mb
  (`chr22:36000000-44000000`). v1.1 draws CYP2D6 as two loops off the line.
- Then decide chr1 (amylase) with Colin: exporting it loads the whole genome
  (chr22's export peaked at 14.5 GB) and its layout is several times chr22's.

## 2. Reshoot the two C4 graph-stack figures

`test_data/hprc_c4_stack/adjacent.paf` is now what the published 2.7.0 command
writes. Only its first record moved (HG01978.2 against HG02004.2, from the
reader's collinear chaining), and inside `hprc_c4_graph_bases`'s window the old
33 bp insertion and 80 bp deletion became substitutions and short indels, which
score -80 against -123 under vg's model. The caption was loosened to match.
Rebuild `@jbrowse/web`, then from `website/`
`node scripts/generate-screenshots.ts --filter multiway_synteny/hprc_c4_graph`,
look at both, `pnpm figures:push --filter multiway_synteny/hprc_c4_graph`, and
commit `figures.lock`.

## 3. The graph plugin's GBZ lanes, haplotype to haplotype

`GbzBaseSyntenyAdapter` (`~/src/jb2plugins/jbrowse-plugin-graphgenomeviewer`)
emits each haplotype against GRCh38 only, and the multi-way display composes a
band between two haplotype lanes through GRCh38, so sequence two haplotypes
share and GRCh38 lacks draws as nothing
(memory `between-row-cigars-are-the-point-of-a-haplotype-stack`). gbz-base 2.7.0
has `subgraph.pairAlignments({ target, query })` over the window the adapter
already fetches, a base aligned in one record at most. Wiring it needs a way for
the display to ask the adapter for adjacent-lane features rather than composing
them, which is the jbrowse-components half. The plugin pins `^2.6.5`.

`tools/pairCheck.ts <gfa>` checks every column of every record against both
walks' bases and counts bases aligned twice; the cached windows are in
`~/tutorial_spikes/gbz_pair/`.
