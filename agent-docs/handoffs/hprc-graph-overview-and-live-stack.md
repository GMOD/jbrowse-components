---
name: hprc-graph-overview-and-live-stack
description: The HPRC graph thread as of 2026-09-26. The graph pane follows the linear view and picks its coarse tier by zoom, lanes read from the graph draw the alignment the graph states between any two haplotypes with no aligner, one command builds a host's files and config, and the tutorials open on the hosted instance. Released - gbz-base 2.8.0, the plugin 3.1.0 on npm and the store, the portal, the demos, the figures. Left - the browse clip, whose node anchor misses after a re-cut, a docs deploy, and Colin's call on the anchored graph becoming a linear-view display.
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

**What replaced that plan (2026-09-26).** The curated panel and the offline
minimap2 all-vs-all are dropped. A lane pair is the alignment the graph
states: `@gmod/gbz-base` `pairAlignments({ bases: false })` chains the nodes
two walks share as `=` and writes the sequence between two shared stretches as
`I` then `D`, and the plugin's `GbzBaseSyntenyAdapter` answers the display's
restored `lanePairsOnAnchor` route with it (jbrowse-components `dfc136f47d`,
`7a56432548`; plugin `63b9e20`..`b45fa44`, which also ported core's
`keepAlignment` into the plugin's clip helper, without which no GBZ gutter ever
received an op). Every pair of the 464 works and no aligner runs. What the
graph does not state stays a gap: at a tandem array the copies fold onto nodes
GRCh38 visits once, and the lane length carries the count.

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

## 3. Measured 2026-09-26: what composition loses, and a follow prototype

Colin asked where the simplicity went across the pangenome tutorials, graph
navigation, the graph-to-stack route, video, PangyPlot's lessons and scale. Two
experiments ran; scripts, tables and screenshots are in
`~/tutorial_spikes/pangenome_simplicity/`.

**Composition through GRCh38, per adjacent pair, bp** (hosted v2.1 `gbz.db`
plus the anchored companion, `keep` on 4-5 named haplotypes, context 1000;
`expA/measure.mjs`, tables in `expA/tables.txt`):

| locus | pair | shared on graph nodes | drawable through GRCh38 | lost |
| --- | --- | --: | --: | --: |
| C4 | HG01978#2, HG02004#2 | 182,945 | 150,178 | 32,767 |
| GSTT1 | HG00097#1, HG00146#1 | 145,014 | 90,478 | 54,536 |
| KIR | HG00133#1, NA20503#1 | 231,857 | 157,566 | 74,291 |
| HLA-DR | NA19036#2, NA18906#1 | 186,684 | 164,037 | 22,647 |
| CFH | HG01109#1, HG01123#1 | 115,337 | 115,013 | 324 |
| FLNA/EMD | HG01150#2, HG00735#1 | 99,977 | 99,934 | 43 |
| amylase | NA18608#2, HG00232#1 | 213,977 | 213,918 | 59 |

The lost column is the third C4 module, the GSTT1 branch, the KIR B-haplotype
genes and the DR52 region: the sequence each showcase locus exists to show. A
pair that includes a GRCh38-like haplotype loses under 0.3 kb, and the CFH
deletion and the FLNA inversion lose nothing, since there the shared sequence
is GRCh38's own. None of the lost bp sits on a GRCh38 node within 250 kb of
the window. The reader's chained shared runs (`sharedRuns` plus `chainRuns`
in `pairAlignment.ts`, no bases compared) are within 0.3% of the set count
wherever a node is visited once, so a graph-stated gutter is that function
with the gap filling replaced by plain gaps. The tandem array is the limit:
at amylase the chain anchors 148 kb of the 214 kb two walks share, the extra
copies fold onto nodes GRCh38 visits once, and counted by visits the pair
loses 64,352 bp. Cuts took 4.3-7.2 s hosted; HLA-DR's full window is 50,065
nodes, 65 over the reader's limit. `pairAlignments` returned FLNA's inversion
record twice with identical spans, against its own one-record-per-base rule.

**Landed the same day.** The graph pane follows the linear view (plugin main
`0fb3c0e`..`b9b36cc`): a launch from a linear view opens anchored and
following, `Pin` holds it and `Follow` hands it back, and `RgfaTabixAdapter`'s
`coarse: { uri, aboveBpPerPx }` names the one-node-per-bubble tier the pane
cuts past that zoom, with no `maxRegionBp` on that route. Every hosted graph
track carries the slot with a handover measured off its index (HPRC 1014,
bovine 880, mouse 328, Arabidopsis 117, pggb 1; jbrowse-components
`0343e1b62a`, jb2hubs `be51522310a`), the portal launcher sets
`followLinearView`, `layoutMode: 'auto'` and `coarseCut` for a wide window
(same jb2hubs commit), `scripts/build_pangenome_graph.sh` builds a host's
files and config in one command (`44a1f847ad`, `7d6bca8cab`), and the
tutorials open on the hosted instance: `pangenome_hprc` browses the graph and
absorbs the portal page and part 4, part 3 folds in the amylase and multi-way
pages, the retired slugs redirect, and the host page is one command
(`eae099f299`, `4a1695b2ea`..`294c873e86`, `5028a0a582`..`37e1186e94`).

**Released 2026-09-26.** `@gmod/gbz-base` 2.8.0 and the plugin 3.1.0 are on
npm; the plugin's pin on the reader moved to `^2.8.0` in the same push (the
symlinked checkout had hidden that `bases: false` needs it, and plugin main was
red on tsc and three adapter tests once `pnpm install` restored the npm copy).
The store serves 3.1.0 at `latest/` (jbrowse-plugin-list `e8c8cf9`), the three
demo configs with their `coarse` slots are deployed, the four portal configs
are in the bucket with their upload stamps committed (jb2hubs `4db85836dc1`),
and staging serves the launcher that sets `followLinearView` and `coarseCut`.
`pangenome/genomes_hprc_mhc_graph`, `hprc_haplotype_launch`, `graph_kiv2_walks`,
`graph_kiv2_walk_rows`, `hprc_gbz_cfhr_lanes`, `hprc_c4_graph_stack`,
`hprc_amylase_lanes`, `host_your_own`, `hprc_amylase_walk_rows` and
`pggb_bubble_tier` were shot on ada against the store's 3.1.0; the portal
launch figures give the three graph lanes compact heights so the graph and its
node menu sit in frame.

**Next.** A docs deploy, which is Colin's (`update docs` on main deploys every
agent's landed doc commits at once). `tier_to_fine`, `pggb_subgraph_launch`
and `pangenome_cactus/subgraph_launch` are filmed and in the media store (on
ada, `node scripts/generate-video.ts` from a `jb-shoot` worktree, which has
the build; ada has no system ffmpeg, so a static 7.0.2 with its ffprobe sits
in `~/.local/bin` there). `pangenome/hprc_browse` is not: it films the
staging page's launch into `jbrowse.org/code/jb2/main`, and after its three
re-cuts (C4, chr6, back to MHC) the `graphNode` anchor for `s348700+`
resolves to an empty spot in the pane (x 390, y 1220 of a 1920×1300 frame,
between the Rank 44 and Rank 57 rows) so the right-click opens no menu,
where `hprc_haplotype_launch` right-clicks the same anchor on the same config
without a re-cut and gets the menu. Debug frames from three runs are in that
session's scratchpad. Two harness fixes came out of it: a hidden wait scopes
`::-p-text()` to its selector, and a text target looks past the tour's own
caption (`data-tour-overlay`), which had been catching a click whose caption
carried the item's words.

**Open design call, Colin's (2026-09-26).** Two panes that move together read
as disorienting. The anchored graph could be a display in the linear view,
where scroll linkage is the platform's rather than a follow of ours, the tier
is an ordinary zoom-level choice made with the view's bpPerPx, and the
standalone GraphGenomeView keeps the layouts whose x is not reference bp
(force, ordered, a popped bubble, a file import, a GBZ walk cut). The follow's
refusal list already draws that line. What carries over unchanged: the cut and
re-cut (`followCut`, `cutHolds`), the tier pick, the `coarse` slot, row order
across a re-cut, selection by id, and the lane-pair route. What goes: the
viewport owner, the two reactions, Pin/Follow and the toolbar status,
`connectedViewId` for the anchored case. What moves: every `GraphGenomeView`
launch in jb2hubs, the demos, ~30 figure specs and the tutorials.

**Still open, none blocking the above.** The segments lane in the linear view
cannot pick a tier by zoom, because `RenderFeatureData` hands an adapter no
bpPerPx, so a tier track stays a lane, and the browse page's chromosome step
shows a following graph under a zoom-in message. The follow is off on a GBZ
cut, so the browse page's KIV-2 walks still open as a second, static pane, and
`hprc_v2_1_gbz_lanes` still names the curated eight. A lane pair cuts the
window once per adjacent pair (N-1 cuts per stack, 0.3-1 s each warm on the
hosted db); cutting once per stack is the speed lever. On the coarse tier the
bubble labels overlap the backbone's length labels (`pggb_bubble_tier`). Six
of the eleven pangenome pages still lead with a build (ecoli, cactus, chrM,
part 5, syri, the host page). The
portal's graph configs carry no text index and no cytobands, so the browse
page types coordinates. `ecoli_minigraph` has no hosted tier, and the portal's
bovine callset lacks `renderingMode: "phased"`. `build_ecoli_pangenome_graph.sh`
builds no tier. Expand-a-bubble-on-click across tiers is unbuilt; `popBubble`
opens a bubble inside the current cut only.
