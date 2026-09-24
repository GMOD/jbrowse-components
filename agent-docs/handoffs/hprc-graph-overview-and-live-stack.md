---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-24. The graph plugin's GBZ lanes now align adjacent haplotypes to each other (both halves on local mains, the plugin unreleased and its hosted bundle not redeployed). PangyPlot's v2.1 chr22 overview is laid out, ingested and captured, and reads like the hosted v1.1 one; chr1 is Colin's call. Read before releasing or deploying the graph plugin, or before laying out another v2 chromosome.
---

# HPRC graph: the v2 overview test and the live haplotype stack

Colin's goal, 2026-09-20: a structural picture of the graph zoomed out, and
base-level detail zoomed in. PangyPlot does the whole-genome overview well and
follows one haplotype at a time, so the split under test is PangyPlot's approach
for the overview and our own work for comparing chosen haplotypes at a locus.
Memory `pangyplot-v2-scale-is-in-its-own-benchmarks` has the measurements.

## 1. PangyPlot's overview at v2 scale: chr1 is the open call

chr22 of v2.1 (3.12M nodes, 1,131 walks) laid out in 32 minutes with the
`perf` branch of gbz2layout (`--balanced --updates-mult 100`, the init anchored
on GRCh38; numbers in `~/src/vendor/gbz2layout-perf/PERF_NOTES.md`), ingested
into `~/tutorial_spikes/pp_v2/ppdata` as db `hprcv2` in 34 minutes on a loaded
box, and captured at the three windows of `shots/pp_v11_*.png` as
`shots/pp_v2_*.png`. CYP2D6 draws as loops off the line, APOBEC3B's deletion as
one loop, and 8 Mb as a flat backbone, as v1.1 does. The local PangyPlot is
v0.3.0 and the hosted one v0.2.8, so the renderer differs too.

`tools/pprun.sh` serves `hprcv2` on port 7755, `tools/add_chr.sh <chr> <layout>`
ingests another chromosome, and `tools/compare_shots.sh <dir>` puts each pair of
captures side by side. Before chr1 (amylase): its export loads the whole genome
(chr22's peaked at 14.5 GB), PangyPlot's own benchmark table gives it about five
times chr22's nodes, and the disk was full on 2026-09-24.

## 2. Releasing the plugin's lane pairs

`GbzBaseSyntenyAdapter` answers a window of the anchor with `queryAssemblyName`
and `targetAssemblyName` by cutting the two lanes' walks out of that window and
aligning them with gbz-base 2.7.0's `Subgraph.pairAlignments`, and its type
declares `lanePairsOnAnchor`, which makes `MultiWaySyntenyDisplay` ask for every
adjacent pair (`reference/MULTIWAY_SYNTENY_DISPLAY.md` §"Lane links"). Only a
cut walked from the companion index's anchor rows holds each walk whole; without
them a pair answers nothing and composes through GRCh38, as before.

Each half is inert without the other: the hosted plugin bundle declares no
capability, and a JBrowse without the display change never reads it. The plugin
half is three commits after 3.0.3 on its local main, unpushed. To ship it:
`pnpm version patch` in the plugin, then the plugin's betabuild script for the
hosted bundle. The deploy redraws every graph figure (memory
`graph-figures-lag-the-unpublished-plugin`); among the lane figures,
`pangenome/hprc_gbz_cfhr_lanes` keeps its story, the carrier boundary narrowing
to a point, which a local capture against the new bundle confirmed.
