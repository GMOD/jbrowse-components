---
name: pangenome-graph-next
description: The graph genome view's work queue, in the order to take it: what shipped and why, the level-of-detail route, the axis change, and the demo opportunities. Read with reference/PANGENOME_GRAPHS.md before touching jbrowse-plugin-graphgenomeview or its figures.
---

# Pangenome graph view: what to do next

A work queue, in the order I would take it. What already shipped and the facts
behind it are in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) — read that
first, this file assumes it.

**State as of 2026-08-06.** Closed: §1 deterministic layout, §2 pinned bundle,
§3 carriage read path, §4 colour default and ramp key, §5 the level-of-detail
tier (producer, hosted files, and the browser bug that blocked it), §6's y axis,
§9 reference-only index (built and hosted, and its premise corrected — it is not
a drop-in), three of §8's four UI debts. Open: §6's remaining half (x from the
connected linear view), §7 in-view navigation, §8's requestable row set, and the
demo list.

**One thing is blocked, and it is the same thing for both §2 and §6: a clean
worktree to regenerate figures in.** §6 moves every anchored figure by design and
the pin bump owed since 2026-08-06 moves them too, so both wait on the same
sweep. Nothing else is blocked; the plugin work can go on without it.

**Published 2026-08-06, latest `aee5e17f4b2c`** (which added `maxRegionBp`; the
carriage read went out just before it as `bfe47428e7ae`). This clears the
betabuild this file had been asking for: the tier fix, two dependency bumps, the hoverSync
registration fix, the drawing-pane ceiling and the carriage read (§3) all went
out together, and the unversioned entry point now serves them.

**Still owed: deploy §6, bump the pin in the three fixtures, and regenerate the
graph figures — all in one commit, per §2.** Not done because the
jbrowse-components worktree has been carrying 40-100 uncommitted source files
from other agents throughout; a regen against that tree bakes somebody else's
work in progress into the published figure set, which is exactly what a pin
exists to prevent. The test for whether a given figure is safe to regenerate is
whether an unfiltered sweep moves it at all: the graph figures all moved, so all
of them are blocked on a clean tree.

Deploying §6 ahead of the regen is safe but pointless-to-half-wrong: the
fixtures pin a hash, so the screenshot generator would keep rendering the old
bundle, while a reader clicking a published figure's LIVE LINK (which points at
the unversioned entry point) would see rows a figure's caption does not describe.
Do the three together.

**The plugin e2e cannot verify this today**, and the reason is worth knowing
before spending an hour on it: `test/` boots a real JBrowse from
`.test-jbrowse-demos`, a copy taken 2026-07-24, and the current plugin calls
`contributeToExtensionPoint`, which that host does not have — every suite fails
in setup with `e.contributeToExtensionPoint is not a function`. A fresh host
means building jbrowse-web, which means a clean tree, i.e. the same block. What
stands in for it is `model.test.ts`'s "what the row axis draws, in pixels":
`recordingCanvas` now records coordinates, so the whole pipeline can be asserted
on the numbers the renderer was handed.

Durable spillover from §5 lives outside this file and should not be copied back
in: the wasm string-decode defect it turned up is ADR 0002 in the
`gmod/bgzf-filehandle` repo (same fix in `bbi-js`), and the jsdom blindness that hid
that whole class is enforced by `config/jest/textEncoder.js` in this repo.

The view is a third-party plugin,
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`; build and deploy traps are in
the `key_pattern_graphgenomeview_plugin_deploy_and_autofit` memory. Never hand-run
the `aws` commands, `pnpm betabuild` gates on lint/typecheck/tests and verifies
what the CDN actually serves.

## ~~1. Deterministic layout~~ — done, 2026-07-27

Not the way this file proposed. **The defect was two lines of C++, not a missing
precomputed layout**: `FMMGraphLayout::init` called `randSeed(clock())` and then
asked for `InitialPlacementForces::RandomTime`, which reseeds from
`time(nullptr)` and ignores `randSeed` entirely (OGDF
`FMMMLayout::create_initial_placement`). Seeded `RandomRandIterNr` instead, seed
overridable per call.

`pangenome/hprc_mhc_bandage` and `pangenome/hprc_c4_subgraph` went from 1.952%
and 1.992% run-to-run to 0.097% and 0.007%, both `diffThreshold` entries are
deleted, and no graph spec carries a raised threshold any more. The residual is
the ordinary remote-data/AA noise every other figure has.

Two things this change also bought, worth knowing:

- the engine's C++ now lives **in the plugin** (`src/bandage/native`, ~1,100
  lines) rather than in a BandageNG checkout, so a layout change is a reviewable
  diff beside the figures it moves. OGDF stays external — 85 MB of build tree,
  built once, `OGDF_DIR` in `scripts/build-wasm.sh`.
- `pnpm test:wasm` asserts determinism across two runs and two module
  instances, and that a different seed *does* move the drawing (so the assertion
  cannot pass vacuously on a graph too small to care).

`odgi layout` is still the answer to a different question — a *global* layout
whose windows are consistent with each other, rather than each window laid out
on its own. The input is still `~/ecoli_graph5/pggb/*.smooth.final.og.lay.tsv`
and adr-028's `LO:Z:` carrier is still the design. It is no longer urgent, and
note it would not have fixed the two figures above: both are HPRC rGFA windows,
and no `odgi layout` for that graph exists.

## ~~2. Pin the plugin bundle~~ — done, 2026-07-27

Every `pnpm betabuild` now writes an immutable copy under a content-addressed
prefix (`demos/graphgenomeviewer/<hash>/`, the entry point's own md5) beside the
unversioned entry point, verifies both resolve, and prints the pinnable url. The
three fixtures (`test_data/graphgenomeview/{config,hprc,ecoli_pangenome}.json`)
pin it; `test_data/graphgenomeview/README.md` states the rule. The unversioned
url stays current, which is what the published figures' live links point at.

**A bump that skipped the regen, and why it turned out not to matter
(2026-08-06).** `0093d998d280` landed in the fixtures with no figure regenerated,
which breaks the rule above. Measured rather than argued: the same two graph
figures rendered in one build at the old pin and the new one differ by **0.054%**
(`pggb_carriage`) and **0.036%** (`pggb_locus_graph`), against a 0.5% gate — so
an unfiltered sweep keeps the committed images and nothing visible changed. That
is the specific delta of `f2108cc`, which adds fields to LINEAR features and
touches no graph drawing; do not generalise it to the next bump. The way to
settle one is this A/B, not a full sweep: flip the fixture, render two figures,
call `pngDiffFraction`.

The pinned hash lives in the three fixtures, and only there — don't restate it
here, it has drifted twice already. Bumping it is a one-line diff; regenerate the
graph figures in the same commit.

This is what the old failure mode looked like, so it is recognisable if the pin
is ever dropped: the deployed bundle's Color dropdown said "Stable rank (rGFA)"
while the plugin source said "Stable rank", so publishing the source's own label
broke `pangenome/rgfa_segment_neighbourhood`, whose spec clicked the old text.
It read as a spec bug and was not. No spec drives that dropdown any more (§4
retired the last one), so this exact break cannot recur — but the class can, on
any label a spec still clicks by text.

## 3. Carriage: the read path is wired, the display is not

Done 2026-08-02, and more generally than this section proposed. Rather than a
bespoke `samples` field, column 6 became a **GFA tag column** passed through
verbatim onto the synthesized S-line, so `SM:Z:` reaches `GraphNode.tags.SM` via
the ordinary parser and the level-of-detail tier's summary rides the same
mechanism with no second plumbing job. See "The tag column is the extension
point" in [reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md).
Carriage is also now per haplotype (`HG002.1`) rather than per sample, which was
a real defect on any diploid graph.

Left to do:

- ~~**show it.**~~ Done 2026-08-06, plugin `418bf7c`. `gfaConverter.makeNode`
  reads `SM:Z:` into `GraphNode.samples`, which `model.ts` already rendered as
  `carriedBy`. Walk-first precedence, three tests, and an in-app A/B (0 of 53
  nodes before, 53 of 53 after) recorded in
  [reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md).
- ~~**rebuild and rehost the E. coli pggb pair**~~ done 2026-08-06. The hosted
  pair now carries `SM:Z:` per haplotype; see the tag section in
  [reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md). This makes
  the first bullet the only thing between the index and visible carriage.
- **draw a node once per carrier**, still the bigger change this section
  described: `sampleRowLayout` emits one position per node id and the renderer
  keys geometry by that id, so real multi-row carriage needs synthetic
  per-carrier ids plus hit detection resolving them back. Its own comment block
  says so.

## ~~4. Two small view improvements~~ — done, 2026-08-06, plugin `5960af0`

Both shipped as described, with one correction worth keeping.

- **The colour default is `'auto'`**, resolved by `effectiveColorScheme` the way
  `layoutModes`' `'auto'` is. The colour-click stage is gone from
  `pangenome/rgfa_segment_neighbourhood`, and its long comment about *why*
  reference position rather than rainbow stayed with the spec — that reasoning
  survived three review rounds and outlives the click it was written for.

  **The correction: `'auto'` asks the GRAPH, not the layout.** This section said
  "anchored resolves to `reference-position`", meaning the layout mode, and that
  would have retired nothing — the figure that drives the click is a
  *force-directed* drawing of an rGFA, which is exactly the case where the
  layout has no reference axis and the ramp is still the only quantity the
  linear lane beside it can share. The condition is `graph.anchoredBy`.
- **The ramp has a key**, top right, shown only while the ramp is what is
  painted, built from the same three numbers `getNodeColor` uses rather than
  from picked hex stops. The path legend moved into a stack with it, since a
  path-coloured graph can be reference-position coloured too.

## 5. Level of detail: producer done, and the browser blocker is FIXED 2026-08-05

The tier draws. `pangenome/probe_tierhosted` renders 5 Mb of HPRC chr1 from the
hosted tier as **29 nodes / 28 edges, layout 231 ms**, where the fine index over
the same span is 3,034 segments and undrawable.

**The bug was ours, in `src/bandage/bandage-layout.js`.** emscripten's
`UTF8ArrayToString` decodes a view over `HEAPU8` — over `WebAssembly.Memory`,
whose buffer is a resizable `ArrayBuffer`, which browsers refuse to decode.
`UTF16ToString` has the same shape. Both take that path **only for strings
longer than 16 units**; shorter ones fall through to a manual char loop.

That threshold is why it read as a data bug for a whole session. The fine index
names nodes `s10274` (6 bytes, manual loop, fine). The tier names backbone nodes
`bb_GRCh38#0#chr1_0` (18 bytes, TextDecoder, throws). 100% failure on one index,
0% on the other, with everything else identical. Fixed in
`jbrowse-plugin-graphgenomeview` `e0bc34a`, patched in `scripts/build-wasm.sh`
because that script overwrites the generated file wholesale.

**Two process failures cost far more than the bug, both worth not repeating.**

- **`test_data/graphgenomeview/_localdist` is a stale hand-copy and nothing
  refreshes it.** `GRAPH_PLUGIN_LOCAL=1` serves that directory, so every "I
  rebuilt the plugin and it still fails" result was read off a build hours old.
  A dependency bump, two upstream patches and two rounds of instrumentation were
  all judged against a bundle that contained none of them. **`cp -r
  <plugin>/dist test_data/graphgenomeview/_localdist` before any
  `GRAPH_PLUGIN_LOCAL` run**, or better, make the generator do it.
- **Bisecting on inputs cannot find a bug whose error names a type.** Nine
  rounds eliminated window size, file size, route, compressor, index flavour,
  tag column, plugin version and two dependency versions, and none of them was
  it. One instrumented run — wrap `TextDecoder.prototype.decode`, **throw** the
  stack rather than logging it, since a worker's console does not reach the page
  — named the frame immediately. Reach for that on the second round, not the
  tenth.

What is left here is the view side, unchanged and now unblocked:

The spike this section asked for is done, and it did not need `vg snarls` or
BubbleGun at all: HPRC already publishes the bubble decomposition we host
(`hprc-v2.0-mc-grch38.bubbles.bed.gz`, 130,510 rows with segment count, path
count and allele lengths per row), so the tier is a pass over a file we serve
rather than a run over a 63 GB graph.

`scripts/build_bubble_tier.sh` emits **the same segs/links pair** at bubble
granularity. A whole 249 Mb chr1 comes back as 474 nodes at
`--min-content 10000`, 3,342 at 1000, 18,888 at full bubble resolution, against
~751k segments in the graph. Numbers, the three decisions behind them, and the
`bubbleTier.test.ts` coverage are in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md), "Level of
detail".

The part this file got wrong is worth keeping: it budgeted for a
**collapsed-bubble glyph and a renderer change**, and neither was needed. A
collapsed bubble already satisfies the segs contract (a reference span, an id, a
rank), so the tier drew correctly with no plugin change beyond the tag column.
Reach for a new glyph only once the tier is on screen and demonstrably unclear.

What is actually left:

- **the view picks a tier by `bpPerPx`**, the way
  [SYNTENY_LOD.md](../reference/SYNTENY_LOD.md)'s two PIF tiers already work.
  Config is a prefix per tier plus its bp range, and there is no new rendering
  mode.
- **expand-on-click** (PangyPlot's `/pop`). The tier node id *is* the bubble's
  source segment, so expanding is a fine-index query over the same span with no
  cross-reference to maintain.
- ~~**build and host the tiers**~~ done. The HPRC pair is hosted as
  `hprc-v2.0-mc-grch38.tier10000.*`, and the E. coli pggb pair was rebuilt with
  the tag format on 2026-08-06.

**The payoff is now proven rather than projected**, which is the one thing that
changed here on 2026-08-06: `pangenome/hprc_whole_chromosome` draws all 249 Mb
of chr1 as 474 nodes in 18 ms. What stood in the way was not the producer but
the bp ceiling, which is a session prop (`maxRegionBp`) as of plugin
`aee5e17f4b2c` — an interim mechanism that the first bullet above retires. The
scale thread, including two negatives worth not re-deriving (the tier is a dud
on a bacterial rGFA; `gfatools bubble` returns nothing on a pggb GFA), is in
`pangenome-scale-ladder.md`.

Two findings to respect, both already paid for, and both now moot for this route
since the bubbles are precomputed upstream:

- **chain contraction is the wrong primitive.** adr-014 measured `vg mod -u` on
  HPRC chr20 at 0.95% reduction, because at 90 haplotypes almost no node has
  bidirected degree 2. Superbubbles do not depend on degree-2 runs.
- **BubbleGun as published does not reach human chr1.** The PangyPlot team
  measured chrY 2 s / 1 GB, chrX 30 s / 11 GB, chr9 ~40 min / 13 GB, chr1
  hanging at 15+ GB. That is the cost this route avoids by consuming
  `gfatools bubble` output the graph already ships with.

### 5b. The same coarsening for a graph loaded as a FILE — designed, not built

Screenshot review of `pangenome/pggb_haplotype_paths`, 2026-08-04: "there is a
lot of space spent to e.g. 1bp entries. is there any 'coarsening' procedure we
can take similar to ~/src/PangyPlot". Answered as a design because building it is
a plugin change plus a publish.

**The complaint is arithmetic, not taste.** `ecoli_pggb_is5.gfa` is 20 segments /
26 links / 5 paths over 1,414 bp, and twelve of the twenty segments are 1 bp. The
figure runs `bubbleSpread: 'open'`, whose floor is `2.5 * MEAN_NODE_LENGTH` = 100
FMMM units, and `bandageAutoScale` puts this graph at 0.566 units/bp — so
everything under 177 bp clamps, which is nineteen of the twenty nodes. Drawn
length: 19 x 100 + 678 for the 1,199 bp IS5 arm = 2,578 units, of which the
twelve 1 bp alleles hold **47% while carrying 0.8% of the sequence**, and the arm
the figure is about holds 26% while carrying 85%.

**The shipped levers cannot fix it** — this is why the ask is a new mechanism and
not a spec edit. `auto` draws the alleles proportionally, as specks with no
length for a path lane to run along, which is what the floor was added for;
`compress` pulls the arm towards the mean and piles its five ribbons into the
colour confetti `drawPaths` is prone to. Both were rendered and rejected before
(see BUBBLE_SPREADS).

**Which of PangyPlot's two mechanisms applies.** Its viewer coarsens twice:
BubbleGun bubble detection collapsing each bubble to one poppable node
(`/pop` expands), and, for whole-chromosome zoom-outs, merging degree-2 runs into
polylines and grid-snapping the coordinates. The second does not apply here and
its own numbers say why: on chrY hprc.clip, 39.4% of segments are junctions and
the mean linear run is 2.8 segments, so RDP tops out at 59.5% reduction and only
grid snapping (which merges *nearby junctions*) reaches 99%. That is the same
finding as adr-014's `vg mod -u` at 0.95% on HPRC chr20, from the other side. It
is a layout-space simplification for an overview, not something that makes one
20-node window legible.

**So: collapse the bubble, and that is what lets the floor come off.** The two
are one change, and the reason is the point of the design — the floor exists only
to give a bubble's ARMS room to separate, and a collapsed bubble has no arms. Run
the numbers with both: 13 nodes, `bandageAutoScale` at 0.368 units/bp, the IS5
arm at 441 units against 79 for everything else, i.e. the arm becomes 85% of the
drawn length, which is its share of the sequence.

What it takes, in the order I would build it:

- **a pure pass over `Graph`, after parse and before layout.** Not a renderer
  change: §5 already established that a collapsed bubble satisfies the segs
  contract. `collapseTrivialBubbles(graph, { maxAlleleBp })` returning a new
  graph plus the map from collapsed id to the nodes behind it.
- **detection without BubbleGun.** The singleton-arm case is the one that
  matters and is a local test: a source with k > 1 out-links to distinct nodes,
  each with exactly one in and one out, all converging on one sink, every arm
  under `maxAlleleBp`. In this file that catches four of the six bubbles
  (2/3, 12/13, 15/16, 18/19). The fifth, 6→(7,8,9,10)→11, is a nested
  superbubble and needs the real algorithm; the sixth is the IS5 event itself
  and must NOT collapse, which `maxAlleleBp` handles on its own.
- **the floor becomes conditional on there being arms.** A `bubbleSpread` floor
  applied to a collapsed node is the bug this is fixing, one level down.
- **path lanes are the open question, and they are why this figure is the test
  case.** Every path traverses a collapsed unit, so lanes drawn the current way
  say "all five carry it" — the exact opposite of the carriage claim the figure
  exists for. The answer worth building is to colour the collapsed node's lanes
  by WHICH allele each path took, which is strictly more than the picture says
  today; the fallback is to suppress collapsing while `drawPaths` is on, which
  would leave this figure exactly as it is and buy nothing.
- **expand on click**, as §5's `/pop`. For a file-loaded graph the arms are
  already in memory, so it is view state rather than a fetch — cheaper here than
  on the tier route.

Why the tier route above does not reach this: the tier is a hosted segs/links
pair, and this figure loads a GFA through `gfaLocation` because the tabix cut has
no P lines and `drawPaths` would have nothing to draw. A file has no tier to
switch to, so its coarsening has to happen in the view.

## 6. The axis: ~~y in pixels~~ done, x from the linear view still open

**y in px shipped 2026-08-06, plugin `6684edb` + `7821b77`.** Both anchored
layouts now emit `ROW_HEIGHT_PX = 20`, `LayoutResult.pixelRows` says so, and the
model exposes `scaleX` (the zoom) and `scaleY` (pinned at 1 there). The pane is
the row count times the pitch — `MAX_CANVAS_HEIGHT`'s aspect-ratio derivation is
gone for row layouts and the ceiling that used to squeeze the pitch is gone with
it — and `zoomToFit` fits x alone, so no row count can take the backbone out
from under the linear view's axis again. Two of the three complaints below are
closed by that: the tall rows and the ~12-row misalignment.

**What it actually cost, since this section said "one number becoming two" and
that is the part to correct.** Most of the drawing mixes the axes in a single
`hypot` — a chord length, a tangent projection, a deletion's bow, a mitred
normal, an arrowhead's angle, a hover distance — and every one of those is
nonsense the moment x is bp and y is px. They each take `yToX` (`scaleY/scaleX`)
now and convert before measuring. `yToX === 1` is the isotropic path and
`geometry.test.ts` asserts it is the *identity*, not merely close, which is what
keeps the committed FMMM figures byte-stable. Details in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md).

Also worth not re-deriving: **the anisotropy does not belong in the transform
uniform, even though the uniform has had `scaleX`/`scaleY` all along.** Putting
it only there leaves every mixed-axis computation upstream still wrong. The
uniform does carry it now, but the conversion has to happen where the geometry
is built.

Still open, and it is the half that was never about y:

- **take `scaleX`/`translateX` from the connected LGV** (`bpPerPx`/`offsetPx`)
  when `connectedViewId` is set. This is what closes the third complaint:
  `hprc_mhc_anchored` is the figure whose whole argument is a shared axis, and
  the segments lane above spans the full pane while the backbone below starts
  after `FIT_PADDING` (40) plus the row-label gutter and ends short of the right
  edge. Sharing a coordinate system is not sharing a pixel mapping. With
  `scaleY` already independent this is now a change to x alone, and it is the
  same read item 7 needs.
- **the figures have not been regenerated**, so every published graph figure
  still shows the old pitch. They are blocked on the same clean tree §2 is —
  see the header. The change moves every anchored figure by design, which is
  exactly why it must not go out piecemeal.
- **`graph.slang` was not fixed** and would stretch every stroke's half-width by
  `scaleY/scaleX` on a row layout. It is dead code — `createGraphRenderer`
  returns Canvas2D unconditionally and only the generated module's vertex layout
  constants are used — and the `.slang` is in neither repo. `GraphRenderer.ts`
  states the one-token fix for whoever lands a GPU backend.

Do the LGV half before item 5. It is also what makes a compact figure possible
for the one verdict still open on `hprc_graph_vs_callset`.

## 7. The window is not navigable from inside the view

`loadedRegion` is written once by the launch and there is no action that changes
it (`refetchIfNeeded` returns early when `self.graph` is set). Pan and zoom move
the *drawing*, so seeing the next 60 kb means going back to the linear view and
rubberbanding again. Fetch cost does not scale with window size (~1.3 s,
dominated by HTTP setup), so nothing about the data makes this expensive.

Cheapest useful version: follow the connected LGV. This wants §6's remaining
half done first — once the graph takes `scaleX`/`translateX` from that view it is
already reading the transform, and a debounced refetch when its region leaves
`loadedRegion` — under `MAX_GRAPH_REGION_BP`, showing the existing "zoom in to
view graph" message past it — turns the graph into a second panel of one
navigation. A locstring field plus widen/narrow buttons is the fallback if
following turns out to fight the user.

## 8. Small UI debts — three closed 2026-08-06 (plugin `34018b5`), one left

- ~~**A declaratively launched graph view is titled "Untitled view."**~~ Done.
  The model exposes `assemblyNames` now (`[loadedRegion.assemblyName]`, empty for
  a whole-file import), which `viewTitle`
  (`packages/app-core/src/ui/App/viewTitle.ts`) and any other assembly-aware app
  machinery reads.
- ~~**The perf readout is published.**~~ Done. Behind `showPerf` / "Show
  timings" in the settings menu, off by default. The `data-*` attributes stay
  unconditional, so no browser test moved.
- ~~**The hover tooltip is pinned bottom-left**, where it covers a row label.~~
  Already fixed before this section was read — `tooltipStyle` in
  `GraphCanvas.tsx` is bottom RIGHT and its comment states exactly this reason.
  The `rgfa_hover_sync` observation that raised it was real when written.
- ~~**Sample rows are sorted alphabetically.**~~ Done, by contributed
  off-reference sequence, most first, with the name breaking ties. Which measure
  is a judgement call and the comment in `contributingSamples` states the
  tradeoff it takes: the order is now a fact about the WINDOW, so a sample is not
  in the same place in two of them.
- **A row set cannot be requested** — still open, and the item above just made it
  matter more. Rows come from whoever contributed here, so the graph in
  `hprc_graph_vs_callset` cannot be made to line up row-for-row with a genotype
  matrix of chosen donors, which is exactly what that figure's open verdict asks
  for. An explicit list of samples to row (empty rows included) would make the
  two panels comparable, would pin the order across windows, and would also let
  the graph label `HG00642.1` where the callset labels `HG00642 HP0`.

## ~~9. Rebuild the hosted index reference-only~~ — built 2026-08-05, and it does **not** buy the 12 s

`build_rgfa_tabix.sh` takes a third argument now (the reference's PanSN sample)
and emits `<prefix>.ref.segs.bed.gz` / `.ref.links.bed.gz`. Built, hosted at
`demos/hprc/hprc-v2.0-mc-grch38.ref.*`, verified rendering, and the size claim
holds: 0.48 MB of `.tbi` against 9.18 MB, rows byte-identical across seven
windows including a whole chromosome.

**The premise of this item was wrong, and the correction is the useful part.**
It said the donor rows are unreachable "at the default `context: 0`".
`subgraphContext` is `types.optional(types.number, 1)` — the default is **1
hop**, and a hop follows allele interiors, which are indexed under exactly the
donor contigs the small pair drops. So pointing the graph cut at it silently
returns the context-0 graph: the two-stubs-in-mid-air picture `graph_context.png`
exists to explain, with no error to notice. Measured on C4:

| context | full | reference-only |
| ------- | ---- | -------------- |
| 0 | 30 nodes / 36 edges | 30 / 36 — same |
| 1 (default) | 34 / 43 | 30 / 36 — **differs** |
| 2 | 34 / 45 | 30 / 36 — **differs** |

So the small pair is for a **segments track drawn on the reference** and for a
session that sets `subgraphContext: 0` deliberately. The graph cut keeps the full
pair, as does a segments lane opened on a contributing assembly (E. coli, and
HPRC's own hs1/CHM13 lane).

**The 12 s `fetch` is therefore still there, and is still worth killing.** What
would actually do it: make the hop reach donor rows without indexing every donor
contig — e.g. a third small file keyed by segment id for allele interiors only,
or having the link row carry enough of the interior that no second query is
needed. That is a producer change plus an adapter change, not a config swap.

## Demo opportunities, in the order I would shoot them

Every file, locus and measured cost behind these is in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) — the bubble
scan, the release-2 files, and why CHM13 is the only donor worth loading.

- ~~**Load CHM13 as a second assembly.**~~ Done 2026-08-02:
  `test_data/graphgenomeview/hprc.json` carries an `hs1` assembly aliased
  `CHM13`, the hosted `jbrowse.org/ucsc/hs1/hs1.gff.gz` genes, and a segments
  track on both assemblies; `pangenome/hprc_chm13_allele` is the figure — a
  142 kb CHM13-only node boxed in the graph, then that node on hs1's own chr17.
  Four things this section got wrong or left out, each measured:
  - **the plugin had to change, and did.** `resolveContributors` matched a node's
    PanSN sample against `session.assemblyNames`, so the graph's `CHM13` only
    resolved if the reader renamed their assembly after the graph. It now takes a
    lookup built off `assemblyManager` (keyed by name *and* aliases) and replaces
    the sample with the canonical name, so `hs1` with `CHM13` in `aliases` works
    and the launch names the assembly `addView` can open. Deployed as
    `9e8a983a6b62`; the adapter side still wants the explicit
    `assemblyNameToPanSN: { hs1: 'CHM13' }`, which is what that slot is for.
  - **CHM13 does not contribute "throughout".** It enters at rank 61, so
    `tabix segs.bed.gz 'CHM13#0#chr1'` is 60 segments for all of chr1, and most
    of them attach only to other donors. The figure's node was found by scanning
    the links index per chromosome for CHM13 rows with a GRCh38 endpoint.
  - **`hgdownload.soe.ucsc.edu` is not dependable from the capture box.** A
    whole-file GET times out outright (`net::ERR_TIMED_OUT`, reproduced with a
    bare in-browser `fetch`, while the same URL ranged returns 206), the ranged
    2bit header read failed 2 of 6 captures, and the RefSeq bigBed failed twice
    with generic-filehandle's "chrome CORS header caching bug" refetch failing
    too. Three broken figures were committed before this was pinned down. Read
    hs1 genes off `jbrowse.org/ucsc/hs1/hs1.gff.gz` (ours, and what the hg38 lane
    already uses), and give a fixture assembly a committed `chrom.sizes` the way
    the four haplotype rows in that config already do.
  - **a display's config is per track, not per view.** The figure draws the
    segments track in two panes; a `color` on the second pane repainted the
    first. Both panes share `hprcSegmentsLane`, and the ramp's rank>0 branch
    already paints CHM13's segments the dark grey the graph paints that node.

  Still open from this item: the synteny launch (two openable contributors is now
  true, and `jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz` is already
  hosted and used by `test_data/hg38_hs1_synteny`) and
  highlight-into-the-donor-view, neither of which has a figure yet.
- **The mitochondrial pangenome, force-directed. Built and verified, needs two
  files hosted.** HPRC release 2's pggb build ships per chromosome and **chrM is
  78 kb compressed** against 2.5-7.4 GB for every autosome, so it is the one
  human graph small enough to hand the view as a file — no index, no launch, no
  region, and it is base-level rather than SV-resolution. The whole graph is
  4,749 nodes / 6,540 edges / **234 haplotype paths** over 16.6 kb, path-anchored
  on `GRCh38#0#chrM`, node depth 1-234 (so the `depth` colour scheme means "how
  many haplotypes carry this"), and FMMM lays it out in 1.6 s at aspect ratio
  1.07.
  **But the whole graph draws as a rope** — 4,749 nodes over a 900 px pane is
  0.19 px each against a fixed node thickness. The legible cut is a narrow window
  with all 234 haplotypes; the plugin's `GRAPH_SCALE_AND_LOD.md` now records the
  measured ceiling. Two ready:
  - `chrM:8,200-8,400`, **61 nodes / 84 edges / 234 paths** — the 9 bp
    COII/tRNA-Lys deletion region, a handful of bubbles at 15 px per node.
    This is the one to shoot.
  - `chrM:16,024-16,400`, 351 nodes / 234 paths — HVS-I, the most-sequenced
    stretch of human DNA in population genetics. Denser, still speckled.

  Recipe (odgi and zstd are on the box; both outputs are in this session's
  scratchpad): fetch
  `pangenomes/freeze/release2/pggb/gfas/by-chromosome/20251014_hprc25272.p98-k311.chrM.gfa.zst`,
  `zstd -d`, `odgi build -g`, then
  `odgi extract -i chrM.og -o w.og -r 'GRCh38#0#chrM:8200-8400' -c 0` and
  `odgi view -i w.og -g`. 67 kb and 305 kb of GFA respectively. Pair with
  `bubbleSpread: 'open'` and `colorScheme: 'depth'`, and the spec is declarative
  (`gfaLocation`) with no menu-driving. Also worth stating in the tutorial: the
  12 most divergent haplotypes are pickable with `odgi similarity` plus a
  farthest-point walk, and the first pick after GRCh38 is HG03270 at 7.8%
  dissimilarity — the deep African split, which is the right answer.
- **Shoot 5q13 (SMN1/SMN2), not another MHC window.** Three overlapping
  mega-bubbles at 27-72 segments each plus an inversion, in a region RefSeq
  itself describes as impossible to organize, where copy number sets spinal
  muscular atrophy severity and short reads cannot count it. The graph, the
  bubble lane and a carriage matrix all have something different to say about the
  same 300 kb. The current locus table in `pangenome_hprc.md` is five loci picked
  off a list; this one was picked by scanning the bubble file, which is also the
  method worth writing down.
- **Draw orientation.** 246 of 130,510 bubbles carry the inversion flag, and
  `StableCoordinate.strand` reaches the node popup while nothing draws it — so
  the one structural event a graph shows better than any linear view is currently
  invisible in ours. Arrowheads or a reversed-node treatment makes AMY1,
  15q13/HERC2, 10q23 and LCR22 read as inversions on sight. This is the same
  missing data the `computeEdgeCurves` reverse-complement bug needs (see the
  plugin's `bubbleCrossing.test.ts`), so the two land together.
- **"240 kb that GRCh38 does not have."** `chr16:74,406,294-74,406,329` is a
  35 bp anchor with a 239,774 bp allele; `chr1:248,122,398-248,180,452` is 18
  segments and a clean 0 → 247,631 presence/absence over an olfactory-receptor
  cluster. The pangenome's whole claim, in one window, at a segment count that
  draws instantly.
- **Carriage, at the graph's own granularity** (`pgbi.vcf.gz`). The HPRC tutorial
  currently ends "carriage remains the callset's job" and hands off to
  `wave.vcf.gz`, whose decomposition is a finer grain than the graph's alleles.
  This file is one record per snarl with 462 haplotypes of `GT`, so a matrix
  beside the graph has one column per bubble — which is what makes
  `hprc_graph_vs_callset` legible instead of two pictures at different grains.
  `LV=0` filters to the same top-level bubbles the hosted bubble track holds.
  Joining its `AF` onto the allele inventory would also let both panels colour by
  allele frequency, which is a statement nothing else in JBrowse can make: this
  100 kb insertion is carried by 41% of 462 haplotypes, that one by 0.2%.
- **What the insertion is** (the WashU MEI BED, 10 MB, one file, hg38). The graph
  says 315 bp of novel sequence attaches here; this says `AluY`, intact, and
  lists the haplotypes carrying it. Cheapest of the data adds and it contributes
  information no projection of the graph can.
- **Linearized multiway synteny of several haplotypes** (impg `all-vs-1` PAFs).
  The open verdict on `hprc_c4_subgraph` verbatim: "would be interesting to see
  linearized multiway synteny of several haplotypes with gene annotation in
  each". The alignments exist per haplotype against GRCh38; `make-pif` indexes
  them. Gene annotation per haplotype is the unresolved half — release 1 has CAT
  GENCODE38 (`submissions/FC7E9302-…--Y1_CAT_ANNOTATION_GENCODE38`), release 2
  needs checking or a liftoff, so scope this at r1 samples that are also in r2 if
  the annotation search comes up empty.
- **A chromosome-scale band, config only.** `GRAPH_SCALE_AND_LOD.md` in the
  plugin repo works out that a `LinearWiggleDisplay` on the existing bubble
  track gives the overview band with no new rendering code
  (`MinigraphBubbleAdapter` already sets `score: segmentCount`), and it is still
  unbuilt. It is the one thing that makes the graph navigable at chromosome
  scale, and the next figure after it is a whole-chr6 variability profile with
  the MHC as a visible spike.

## Traps worth knowing before you touch the figures

Two from 2026-08-05, both from probing the tier:

- **Appending a spec to a `specs/*.ts` array leaves a sparse hole if you are not
  careful**, and the generator dies far away with
  `TypeError: Cannot read properties of undefined (reading 'mode')` inside
  `screenshot-specs.ts`, which reads as somebody else's broken spec file.
  **`Array.prototype.filter` SKIPS holes**, so `arr.filter(x => !x).length` is
  not a hole check and will tell you the array is clean — use
  `for (let i = 0; i < a.length; i++) if (!(i in a)) …`. Three separate runs were
  misattributed to a concurrent agent before this was pinned down.
- **`TMPDIR` under the session scratchpad is too long for Chrome**, which dies
  with `FATAL: Socket path too long: …/SingletonSocket` before any spec renders.
  Use a short one (`/tmp/ss`). Distinct from the "insufficient resources"
  failure a *missing* TMPDIR gives.

All of the following cost time on 2026-07-26.

- **A `stages` capture stacks the stage frames only.** The spec's own `actions`
  are setup for stage one, not a frame — put the interaction in the first stage
  or the committed PNG is just the last frame.
- **Gate a row-label spec on the toolbar too**
  (`body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]`).
  The rows land first, and a capture in between shows the graph under a header
  with no Layout/Color dropdowns in it.
- **Bare viewport coordinates in graph specs restale on any layout change above
  the graph.** `HPRC_ALLELE` broke twice in one day, once from the segments lane
  dropping 35 px. Measure a replacement on the spec's own debug capture
  (`static/img/debug_<spec>.png`, 2x device scale, so CSS = image/2), not from a
  model probe at a different viewport — that mismatch is what made the first
  replacement wrong too. A `contextNodeId` view prop would retire the whole
  class.
- **A raised `diffThreshold` keeps changes you meant to make.** See item 1, and
  the website `CLAUDE.md` section on `⚠ kept`.
- **A synteny figure draws far more than its window, on both axes for different
  reasons.** The fetch is region-scoped and `PAFAdapter` filters to the region it
  is asked for, so the surprise is what that region is:
  `LinearSyntenyDisplay.fetchRegions` is `syntenyFetchRegions` over the **query
  axis only**, which is the visible window expanded by
  `syntenyPanBufferPx = max(width * 0.5, 2000)` px of bp per side and snapped
  outward to that grid. At 1000 px and 350 bp/px that is 700 kb per side, so the
  inversion figure's level fetched `chr1:143.5-145.6 Mb` for a 350 kb frame — the
  whole 1.2 Mb fixture slice. The target axis is then unscoped by design ("query
  regions in, every mate out"), so a record whose mate sits a megabase off the
  other row's window comes back too and draws a ribbon across the frame. That is
  what put a crossed ribbon on the inversion figure's non-carrier row. Cut the
  fixture PAF to the frame, and ask
  `node scripts/probe-synteny-features.ts <spec>` what a figure actually drew
  rather than reasoning about which records the view "should" have fetched.
