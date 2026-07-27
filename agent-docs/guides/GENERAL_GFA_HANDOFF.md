# General GFA (non-rGFA) graph support: handoff

Everything the graph genome view does with coordinates today reads rGFA tags, so
a pggb / odgi / Minigraph-Cactus base-level graph falls back to a force-directed
blob. This file is the operational half: what the constraint actually is, where
it lives in code, the two-part change, and the evidence already gathered so it
does not have to be re-derived.

Related: [PANGENOME_PATHS_HANDOFF.md](PANGENOME_PATHS_HANDOFF.md) (the minigraph
per-strain path track), [REGION_VIEW_LAUNCH.md](REGION_VIEW_LAUNCH.md) (the
launch-a-subgraph entry points).

## The finding

A general GFA is not a degraded rGFA. For the question a pangenome reader
actually asks, it is the better format, and our docs currently imply the
opposite.

- **Coordinates.** Walking the reference path assigns every node it visits a
  reference interval. rGFA states this in `SN`/`SO`/`SR` tags; a path GFA states
  it in path order. Same information, different encoding.
  `scripts/gfa_nodes_to_bed.py` in this repo already does the walk (it is what
  colors the `pangenome/local_subgraph` figure's BED), so the arithmetic is
  written and tested.
- **Carriage.** A node's sample set is every `P`/`W` record that visits it. rGFA
  cannot express this at all: `SR` is build order, so both pangenome tutorials
  have to warn readers that `discoveryRank` / `firstSeenIn` names the first
  assembly to contribute an allele, not who carries it. On a pggb graph the
  Sample rows layout would be exact rather than approximate.

## Where the constraint lives

Plugin repo, **not** this one:
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` (remote
`GMOD/jbrowse-plugin-graphgenomeviewer`). Build and deploy traps are in
`key_pattern_graphgenomeview_plugin_deploy_and_autofit`: repoint the
`node_modules/@jbrowse/*` symlinks at this checkout, use `pnpm build` (never
bare `node esbuild.mjs`), deploy with `scripts/betabuild.sh` rather than hand
`aws` commands.

| File                                              | What it does today                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/gfa-core/gfaParser.ts:44-57`                 | `StableCoordinate {refName,start,rank}`; `stableCoordinate()` returns `undefined` without SN/SO/SR |
| `src/gfa-core/gfaParser.ts:113-210`               | already parses `P` and `W` into `graph.paths` / `graph.walks`                                   |
| `src/GraphGenomeView/gfa/gfaConverter.ts:60`      | `stable: stableCoordinate(gfaNode)`, the single seam                                            |
| `src/GraphGenomeView/gfa/gfaConverter.ts:21-47`   | `surveySegments` already walks every P and W line per segment, for depth                        |
| `src/GraphGenomeView/anchoredNodes.ts`            | `isBackbone` = `stable.rank === 0`; `isOffReference` = `stable.rank > 0`                        |
| `src/GraphGenomeView/layoutModes.ts`              | both anchored modes gate on `graph.nodes.some(isBackbone)`; descriptions say "rGFA only"        |
| `src/GraphGenomeView/layout/sampleRowLayout.ts`   | `contributingSamples` reads `parsePanSN(node.stable.refName).sample`, i.e. first-seen attribution |
| `src/alleleProjection/projectAlleles.ts`          | derives allele positions from SN/SO/SR plus L-lines alone                                       |

`surveySegments` is the important one: the pass that would derive coordinates and
carriage already iterates exactly the records it needs, and throws them away
except as a traversal count.

## Part 1: path-derived stable coordinates (the plugin)

Extend the survey pass to accumulate, per path, a running offset, then:

- nodes the **chosen reference path** visits get `{refName, start, rank: 0}`
- every other node gets a **sample set** from the walks that visit it, replacing
  the single first-seen `SN` that `contributingSamples` reads today

Both anchored layouts then light up unchanged, and one node can legitimately
appear on several sample rows. Keep `available()` honest: a GFA with neither
tags nor paths must still fall through to force, and the dropdown should say why.

**Choosing the reference path.** When launched from a region the view already
knows `self.loadedRegion?.assemblyName` (`model.ts`), and path names in these
graphs are PanSN, so `panSNSample()` (`src/pansn.ts`) matches an assembly to its
path the same way `RgfaTabixAdapter`'s `assemblyNameToPanSN` does. A plain GFA
opened by file has neither, so this needs a real config slot / UI picker, not
only inference: a general GFA's path names are arbitrary.

### Two traps with data behind them

- **A path can visit a node more than once, and in the demo graph it does.**
  `odgi depth` over the five-strain E. coli graph reaches 10 at
  `chr:4,167,000-4,170,500` and `chr:3,942,000-3,946,500`, which are rRNA operons
  the graph collapses so each of the five strains walks them twice. rGFA cannot
  represent that (one `SO` per segment), so this is new: decide explicitly
  between first-visit-wins and a node carrying several intervals, and write the
  choice down. Whatever is chosen, that locus is the test case.
- **Orientation.** A path may traverse a node in reverse, so the derived interval
  has to come from the path's own offset accumulation, and the node's
  orientation relative to the reference has to survive into the layout. IAI39 is
  the strain that exercises this (350 of its ~1,074 untangled segments are
  inverted; every other strain has 4 or 5).

## Part 2: browsing a plain GFA by locus

There is no adapter for a general GFA (only `RgfaTabixAdapter` and
`MinigraphBubbleAdapter`), which is why `pangenome_ecoli.md` makes the reader
`odgi extract` a window per look.

The same path walk in a build script emits the **same two BEDs**
`scripts/build_rgfa_tabix.sh` emits, so nothing downstream changes shape:

- `<prefix>.segs.bed.gz`: `stableName start end segmentId rank`, plus a samples
  column for the general case
- `<prefix>.links.bed.gz`: one row per L-line per endpoint, both endpoints stated
  in full (a neighbour usually has no reference coordinate, so tabix cannot look
  it up by id)

With those, region query, the launch menus, hover sync and the subgraph cut all
work as they do for rGFA. Scale check before committing to a whole-graph walk:
the five-strain E. coli graph is 605,979 S-lines and 814,027 L-lines, which is
fine; a human base-level graph is not, and the rGFA route stays the answer there.

## Evidence already gathered

Re-deriving any of this is slow, so it is recorded rather than repeated. See also
`key_pattern_pggb_demo_data_resolution_ceilings`.

- **The five-strain `.og` is on this box**, and local `odgi` reads it with no
  docker: `~/ecoli_graph5/pggb/all.fa.gz.*.smooth.final.og` (109 MB), with the
  `.gfa` and the `-V` VCF beside it. Do **not** use `~/depth_build/`, which is
  the pre-IAI39 four-strain run and reads ~4 where the hosted five-strain bigWigs
  read ~5.
- **`odgi untangle` is a usable general-graph lane.**
  `odgi untangle -i graph.og -r K12#1#chr -e 5000 -m 1000 -t 8`, 2m14s, 5,433
  rows: about 1,100 reference-anchored segments per strain covering each strain's
  full length, with orientation and self-coverage columns. Inverted segments per
  strain: IAI39 350, NCTC86 5, CFT073 5, Sakai 4, K12 0. Self-coverage above 1
  (paralogy): Sakai 58, NCTC86 39, K12 30, IAI39 30, CFT073 22. `-e` is what
  makes it usable; without regular cut points it collapses to a handful of
  whole-chromosome blocks, which is what `pangenome_cactus.md` hit and dismissed
  it for. Drops into `LinearMultiRowFeatureDisplay` with `partitionField` on the
  strain. Does not scale to human at that cost.
- **`odgi degree` is a dud, measured.** Over the same 500 bp windows: mean 3.82,
  max 4.79, no dynamic range. It does not make a graph-complexity track. Do not
  re-try it.

## What this unlocks in the docs

`website/docs/tutorials/pangenome_ecoli.md` is titled "Pangenome (pggb)" and
about 330 of its ~800 lines build a **minigraph** rGFA graph from the **cactus**
image and teach the graph view. That half should move to its own page
(`tutorials/pangenome_graph_view.md`), which `pangenome_cactus.md` and
`pangenome_hprc.md` already link into by anchor, and where the plugin admonition
currently duplicated in two tutorials would live once.

The split is **blocked on Part 1** by choice: done first, it leaves the pggb page
thin exactly where it should be strongest. Done after, the pggb page gains the
sections the minigraph half currently monopolizes, and gains them in better form:

- the graph browsable at any locus with no per-window `odgi extract`
- Sample rows with real carriage, checkable against the `odgi pav` track directly
  above it
- bubbles and alleles from the pggb side: the VCF's `LV`/`PS` snarl tree **is**
  the bubble hierarchy, and it comes with genotypes, so "which strain takes which
  path" and the allele inventory both beat their minigraph equivalents
- the `odgi untangle` lane above, which no current projection replaces

Split cost, when it happens: a gallery card and `guide:` entry in
`website/src/lib/gallery.ts`, a generated tutorial thumbnail (needs a figure on
the new page to crop from), and four inbound anchors across two tutorials.

## Traps in the surrounding pipeline

- **Screenshot regen was blocked as of 2026-07-26**: another agent had
  uncommitted wiggle score-legend work sitting in `products/jbrowse-web/build`,
  so any regenerated PNG would bake it in. Check `git status` on
  `plugins/wiggle` before regenerating anything.
- The two graph figures use a local-path config, so their `<Figure>` tags carry
  `link=""`, and `pangenome/graph_force` sets a raised `diffThreshold` for FMMM
  jitter. Read the website `CLAUDE.md` section on raised thresholds before
  concluding a figure "did not change".
- `website/docs/tutorials/CLAUDE.md` now says to avoid specific numeric values in
  prose. Commit `05a3b3b5ba` added several (depth loci, VCF record counts,
  per-strain absence rates) before that rule landed; bringing them back to
  qualitative statements is an open cleanup.

## Definition of done for Part 1

`pangenome/local_subgraph` (in `website/scripts/specs/graph.ts`) redrawn in the
**Anchored** layout instead of force-directed, with `pangenome/graph_force`
retained as the force example. That figure is the proof: it already pairs the
graph panel against the same nodes on the K12 axis, so an anchored version makes
the two panels share an axis rather than only a color ramp.
