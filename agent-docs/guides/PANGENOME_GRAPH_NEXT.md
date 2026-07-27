# Pangenome graph view: what to do next

A work queue, in the order I would take it. What already shipped and the facts
behind it are in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) — read that
first, this file assumes it.

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

Currently pinned: `e47796d9cccc`. Bumping it is a one-line diff — regenerate the
graph figures in the same commit.

This is what the old failure mode looked like, so it is recognisable if the pin
is ever dropped: the deployed bundle's Color dropdown said "Stable rank (rGFA)"
while the plugin source said "Stable rank", so publishing the source's own label
broke `pangenome/rgfa_segment_neighbourhood`, whose spec clicked the old text.
It read as a spec bug and was not.

## 3. Carriage: read the `samples` column that is already written

`scripts/pggb_gfa_to_bed.py` emits every carrier per segment (column 6 of
`segs.bed.gz`, columns 14 and 15 of `links.bed.gz`), and nothing reads them. On
an rGFA a row means "the assembly that contributed this first"; with this column
read, a path-derived graph's sample rows would mean carriage, which is the one
thing the format can say and rGFA structurally cannot.

Plumbing, all in the plugin:

- `rgfaBed.ts`: parse the extra columns into `RgfaSegment.samples`, and emit
  `SM:Z:a,b,c` from `formatSegment` (rGFA inputs simply have no column, so this
  stays backward compatible)
- the GFA parser: read `SM` into `GraphNode.samples`, which already exists and
  is already populated by `pathAnchoring.ts` for whole-file imports
- the node popup already lists `carriedBy` when it is set, so that comes free

Stop there and it is already worth it. Drawing a node once per carrier is a
bigger change — `sampleRowLayout` emits one position per node id and the
renderer keys geometry by that id, so real multi-row carriage needs synthetic
per-carrier ids plus hit detection resolving them back. Its own comment block
says so.

## 4. Two small view improvements, started and parked

Both are cheap, and together they are one deploy.

- **Default the colour scheme when the graph is anchored.** `colorScheme`
  defaults to `'uniform'`, so a launched graph opens flat grey and both
  tutorials spend a step saying "now pick a colour"
  (`pangenome/rgfa_segment_neighbourhood` literally drives that click as part of
  the figure). Mirror `layoutModes`' `'auto'`: add an `'auto'` entry to
  `COLOR_SCHEMES`, default to it, and resolve through an
  `effectiveColorScheme` getter — a bare getter must return a resolved value
  (root `CLAUDE.md`), so the renderer reads the getter and the dropdown reads
  the raw prop. Anchored resolves to `reference-position`, unanchored keeps
  `uniform`. Then drop the colour-click stage from that spec.
- **Draw a key for the reference-position ramp.** Nothing on screen says
  red-to-magenta means left-to-right of the cut window; two tutorials carry that
  sentence in prose instead. A gradient strip labelled with the window's ends,
  shown only when that scheme is active, retires the sentence.

## 5. The one that changes what the view is: level of detail

Everything above improves a view that browses **a 1 kb window** of a base-level
graph. That is not a budget problem, it is an abstraction problem: every GFA
segment is a node, so node count grows with sequence and the view can only
decline past `DEFAULT_MAX_GRAPH_NODES`.

The design, and every piece of it now exists except the middle one:

1. the tabix pair from `build_pggb_tabix.sh` is the range index
2. **missing**: a precomputed superbubble hierarchy beside it — each bubble's
   reference span, its content summary (node count, allele count, longest
   allele), and its parent, so a query can return *collapsed bubbles* above a
   size threshold instead of their contents
3. a collapsed-bubble glyph in the renderer, and expand-in-place on click
   (PangyPlot's `/pop`)

Then zoom controls abstraction rather than scale, and the graph is navigable at
chromosome scale like any other track.

**Spike this before committing to it.** Run `vg snarls` (or BubbleGun) over
`~/ecoli_graph5/pggb/*.smooth.final.gfa` and answer three questions with
numbers: how many top-level bubbles, what fraction of the 606k segments they
absorb at a few thresholds, and how deep the nesting goes. That tells you
whether a chromosome's worth of collapsed bubbles is a few thousand nodes (a
drawable view) or a few hundred thousand (a dead end).

Two findings to respect, both already paid for:

- **chain contraction is the wrong primitive.** adr-014 measured `vg mod -u` on
  HPRC chr20 at 0.95% reduction, because at 90 haplotypes almost no node has
  bidirected degree 2. Superbubbles do not depend on degree-2 runs.
- **BubbleGun as published does not reach human chr1.** The PangyPlot team
  measured chrY 2 s / 1 GB, chrX 30 s / 11 GB, chr9 ~40 min / 13 GB, chr1
  hanging at 15+ GB; the pointer-heavy Python data model is the cause and a flat
  int64-CSR rewrite is their fix. For E. coli none of this matters, so the spike
  is cheap; for human it is the whole cost.

## Traps worth knowing before you touch the figures

All of these cost time on 2026-07-26.

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
