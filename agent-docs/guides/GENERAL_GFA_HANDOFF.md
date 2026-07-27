# General GFA (non-rGFA) graph support: handoff

Everything the graph genome view does with coordinates used to read rGFA tags,
so a pggb / odgi / Minigraph-Cactus base-level graph fell back to a
force-directed blob. **Part 1 is done** — the view walks a chosen path and
anchors on it. This file is the operational half: what the constraint was, what
was decided, what is left, and the evidence already gathered so it does not have
to be re-derived.

Related: [PANGENOME_PATHS_HANDOFF.md](PANGENOME_PATHS_HANDOFF.md) (the minigraph
per-strain path track), [REGION_VIEW_LAUNCH.md](REGION_VIEW_LAUNCH.md) (the
launch-a-subgraph entry points).

## The finding

A general GFA is not a degraded rGFA. For the question a pangenome reader
actually asks, it is the better format, and our docs used to imply the opposite.

- **Coordinates.** Walking the reference path assigns every node it visits a
  reference interval. rGFA states this in `SN`/`SO`/`SR` tags; a path GFA states
  it in path order. Same information, different encoding.
  `scripts/gfa_nodes_to_bed.py` in this repo does the same walk out of band (it
  is what colors the `pangenome/local_subgraph` figure's BED), so the two can be
  checked against each other.
- **Carriage.** A node's sample set is every `P`/`W` record that visits it. rGFA
  cannot express this at all: `SR` is build order, so both pangenome tutorials
  have to warn readers that `discoveryRank` / `firstSeenIn` names the first
  assembly to contribute an allele, not who carries it.

## Part 1: path-derived stable coordinates — DONE

Plugin repo, **not** this one:
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` (remote
`GMOD/jbrowse-plugin-graphgenomeviewer`). Build and deploy traps are in
`key_pattern_graphgenomeview_plugin_deploy_and_autofit`: repoint the
`node_modules/@jbrowse/*` symlinks at this checkout, use `pnpm build` (never
bare `node esbuild.mjs`), deploy with `scripts/betabuild.sh` rather than hand
`aws` commands.

`src/GraphGenomeView/pathAnchoring.ts` is the whole of it, plus a `referencePath`
view prop, a picker in the settings dialog, and the walk being wired into
`parseAndLayout`. Both anchored layouts, `projectAlleles`,
`contributingAssemblies` and the launch menus then work on a pggb graph
unchanged, because they all read `node.stable`.

### Decisions, with the reasoning that is easy to lose

- **The reference path is a choice, not a fact.** Nothing in a general GFA marks
  one path as the reference. An explicit `referencePath` wins (matched against a
  path's PanSN sample first, then its full name); a subgraph cut from a track
  falls back to `loadedRegion.assemblyName`; a whole-file import with neither
  takes the first path in the file, which is where pggb and odgi leave the
  reference. An unmatched name falls back rather than leaving the graph
  unanchored — a stale session should not silently drop to force-directed.
- **The `:start-end` suffix comes off the path name.** `odgi extract` names an
  extracted path `K12#1#chr:1004500-1004961`; that suffix is the only statement
  of where in the genome a cut subgraph sits, and leaving it on the name gives
  PanSN a contig no linear view can open. Matched on trailing digits, not on a
  trailing colon, because stable names legitimately contain colons.
- **Rank is 0 or 1, nothing more.** rGFA's higher ranks are minigraph's build
  order; a path GFA has no equivalent, so more rows would be invented structure.
- **First visit wins** when a path reaches a segment twice. A node draws as one
  tube at one x, so the alternative is a tube spanning both copies, claiming
  reference the segment does not occupy. The repeat stays visible as depth,
  which is a multiple of the path count where a repeat is collapsed. **Test case
  for this is the rRNA operons**: `odgi depth` over the five-strain E. coli graph
  reaches 10 at `chr:4,167,000-4,170,500` and `chr:3,942,000-3,946,500`, which
  pggb collapses so each of the five strains walks them twice.
- **An off-reference node is placed on its own carrier's coordinates**, the same
  asymmetry rGFA has (a rank>0 `SO` is an offset on the contributing assembly).
  This is what makes `contributingAssemblies` — and so the whole launch-out menu
  — work on a graph with no `SN` tags at all; before, it returned nothing.
- **Carriage is on the node (`GraphNode.samples`), the row is one of them.** The
  layout emits one position per node id and the renderer keys geometry by that
  id, so a node cannot draw once per carrier without the layout emitting more
  nodes than the graph has. It draws on the row of the first path in the file
  that visits it, and the node popup lists the rest under `carriedBy`. Real
  multi-row carriage is the open piece below.

### What is left of Part 1

- **A node carried by several assemblies draws on one row.** Needs the layout to
  emit synthetic per-carrier ids and the geometry/hit-detection path to resolve
  them back to the real node. In the demo window two of eighteen off-reference
  nodes are affected (`13` and `46`, both IAI39+Sakai).
- **Orientation is recorded but not drawn.** `StableCoordinate.strand` is set
  from the anchoring path's own traversal, and shows in the node popup;
  arrowheads are an edge property in `GeometryBuilder`, so nothing on the node
  reflects it. See "prior art" below for the whole-contig case, which matters
  more than per-node strand and is **not** handled.

## Part 2: browsing a plain GFA by locus

Still open. There is no adapter for a general GFA (only `RgfaTabixAdapter` and
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

**Do not use a chunked ordinal index for this.** See prior art.

## Prior art: the abandoned `gfa-to-tabix` / `GfaTabixAdapter` effort

Removed from this repo in `fa737e4255` (adapters), `c72b88d177` (the CLI
command) and `3b98dbb985` (`tools/gfa-to-tabix`, the Rust preprocessor). It
solved the same problem at HPRC scale and left several findings worth keeping.

- **`getSubgraph` was never the failure.** It matched `vg find` byte-for-byte in
  under 300 ms at ≤100 kb. What sank the effort was `synteny_build` — the
  all-vs-all block alignment — and that is not part of Part 2 at all.
  [adr-024](../architecture-decision-records/) (removed with the rest) benchmarks
  the replacement: `odgi untangle` on HPRC chr20, ~1 h → 1 m 39 s, 7.9 GB →
  2.1 GB RSS, 167–890 MB → 11 MB of output.
- **Its chunked `pos.bed.gz` cannot carry a path walk, and silently didn't.**
  Rows covered N steps (default 100) and listed the *set* of segment ordinals in
  the chunk, so the adapter reconstructed W lines by sorting ordinals numerically
  and emitting every step forward-strand. Ordinals were assigned in
  reference-path traversal order, so the reference path's walk came out right and
  every haplotype's was wrong wherever it diverged. The per-segment BED shape
  above does not have this failure mode, and anything path-derived reading such
  an index would inherit it.
- **Whole-contig reverse-complement ("grooming") is a real problem with a
  deterministic test.** A haplotype contig assembled in the opposite orientation
  makes every one of its segments read inverted, which is not biology. The Rust
  tool flipped a walk when >99% of the *bp it shares with the reference* are
  opposite-orientation — bp-weighted so 1–2 bp SNP nodes cannot outvote a
  reversed contig — and then emitted its steps in reverse so offsets stayed
  monotonic. Inspired by `odgi groom`. Our `pathAnchoring` does none of this;
  the E. coli demo does not need it (its FASTAs are all forward) but a real
  assembly set will.
- **It never handled the `:start-end` path-name suffix.** Every path started at
  offset 0, so an extracted subgraph landed at the origin. Do not "restore" that
  arithmetic.
- **Coarsening a dense graph by chain contraction does not work.**
  adr-014: `vg mod -u` on HPRC chr20 (1,859,947 segments, 90 haplotypes) took
  1 m 37 s and reduced the segment count by **0.95%** — at 90 haplotypes almost
  every node borders a variant in some haplotype, so degree-2 nodes are
  essentially absent. Coordinate tiles and `vg snarls` replaced it. Relevant if
  anyone proposes collapsing a base-level graph to make it drawable.
- **Extraction is not symmetric across reference paths, and that is biology.**
  adr-015: chrM (44 paths) gives one canonical fingerprint from every path;
  chr20 diverges from every path, because haplotype contigs are fragmented and
  segment density varies with which allele a path takes. So the **Reference
  path** picker genuinely changing the drawing is expected, not a bug.
- **`vg deconstruct -a -u` is the graph-native allele source.** adr-025/adr-030:
  it carries `AT` (allele-traversal node ids), `AP` (reference-relative
  positions) and `LV`/`PS` (snarl nesting) — none of which `minimap2 --cs` can
  reproduce — and ships as a standard JBrowse variant track with the feature
  widget and genotype matrix for free. The custom `bubbles.bed.gz` re-packaging
  of that same VCF was the fragile part and was dropped.

## Cross-reference: PangyPlot / BubbleGun

PangyPlot (Mastromatteo et al. 2025, bioRxiv) is vendored at
`~/src/vendor/pangyplot` and is the closest published prior art: a pangenome
graph browser over the same base-level graphs, and the one that solved the
problem this view still has. Its own notes are in that repo's `CLAUDE.md` and
`context/bubblegun-migration.md`. The comparison below was made in
`agent-docs/GRAPH_PLAN.md` before that file was removed in `3b98dbb985`, and is
kept here because it is still the map of what is missing.

|                | PangyPlot                                                       | GraphGenomeView                              |
| -------------- | --------------------------------------------------------------- | -------------------------------------------- |
| 2-D layout     | `odgi layout` SGD, precomputed offline, baked into a SQLite index | OGDF FMMM, recomputed live per subgraph load |
| Simplification | BubbleGun bubble/superbubble hierarchy; sub-threshold bubbles collapse to one node | none — every GFA segment is a node |
| Large regions  | abstract via the hierarchy; rendered node count stays bounded      | declined past the node budget                |

Of the two decisions adr-028 drew from this, only one landed:

- **Node-count limit instead of a bp cap: landed.** `DEFAULT_MAX_GRAPH_NODES`
  is the real cap; `MAX_GRAPH_REGION_BP` survives only as a pre-fetch guess and
  says so in its own comment.
- **Offline layout as an `LO:Z:` segment tag: not built.** Live FMMM is still
  non-deterministic between runs, which is why `pangenome/graph_force` carries a
  raised `diffThreshold`. The input exists for the demo graph:
  `~/ecoli_graph5/pggb/*.smooth.final.og.lay.tsv` (`idx X Y component`, 54 MB).
- **Bubble collapse: not built, and it is the one that matters.** Path anchoring
  gives a base-level graph an axis; it does not give it a node budget. A pggb
  graph runs ~17 bp/node, so the window stays small for the same reason it
  always did.

What the PangyPlot developer confirmed (meeting, after the `gfa-to-tabix` work
above): **BubbleGun superbubble enumeration is their coarsening strategy for
rendering**, not a side index. Preprocessing compacts the graph, runs BubbleGun
`find_bubbles` / `connect_bubbles` / `find_parents`, and stores a nested bubble
index; at query time `decompose_chain` expands chains only down to a size
threshold, so sub-threshold bubbles render as a single node and the user pops
one open interactively (`/pop`).

Two things to know before adopting it:

- **Superbubbles are the coarsening primitive that works here; chain contraction
  is not.** adr-014 measured `vg mod -u` at 0.95% reduction on HPRC chr20
  because at 90 haplotypes almost no node has bidirected degree 2. Superbubbles
  do not depend on degree-2 runs. `vg snarls` is the same object generalized,
  and adr-014's replacement already reached for it.
- **BubbleGun as published does not reach human chr1.** Measured by the
  PangyPlot team on HPRC: chrY 2 s / 1 GB, chrX 30 s / 11 GB, chr9 ~40 min /
  13 GB with swap thrash, chr1 hangs at 15+ GB. The algorithm is fine; the
  Python data model is pointer-heavy (a `Node` object per segment with adjacency
  sets of tuples). Their fix is a flat int64-CSR / numpy rewrite streaming
  straight into SQLite, targeting ~4 GB — `context/bubblegun-migration.md`,
  branch `phase3-flat-bubble-integration`, reverted from their `main` over a
  ~50× regression in a correlated-subquery children resolution (fix: build the
  parent→children map during emission and `executemany`, not in SQL).

## Evidence already gathered

Re-deriving any of this is slow, so it is recorded rather than repeated. See also
`key_pattern_pggb_demo_data_resolution_ceilings`.

- **The five-strain `.og` is on this box**, and local `odgi` reads it with no
  docker: `~/ecoli_graph5/pggb/all.fa.gz.*.smooth.final.og` (109 MB), with the
  `.gfa` and the `-V` VCF beside it. Do **not** use `~/depth_build/`, which is
  the pre-IAI39 four-strain run and reads ~4 where the hosted five-strain bigWigs
  read ~5. The plugin's `test_data/ecoli_pggb_subgraph.gfa` is now the same
  five-strain file the demo serves, so a unit test and the figure read the same
  bytes.
- **`odgi untangle` is a usable general-graph lane.**
  `odgi untangle -i graph.og -r K12#1#chr -e 5000 -m 1000 -t 8`, 2m14s, 5,433
  rows: about 1,100 reference-anchored segments per strain covering each strain's
  full length, with orientation and self-coverage columns. Inverted segments per
  strain: IAI39 350, NCTC86 5, CFT073 5, Sakai 4, K12 0. Self-coverage above 1
  (paralogy): Sakai 58, NCTC86 39, K12 30, IAI39 30, CFT073 22. Drops into
  `LinearMultiRowFeatureDisplay` with `partitionField` on the strain. Does not
  scale to human at that cost.
  - **`-e` is graph-dependent, and the two records disagree for a reason.**
    Here it is what makes untangle usable at all; without regular cut points it
    collapses to a handful of whole-chromosome blocks, which is what
    `pangenome_cactus.md` hit and dismissed it for. adr-024 says leave `-e` off,
    but that was HPRC chr20 at 90 haplotypes, where the graph already yields 24k
    blocks. Few haplotypes → needs `-e`; many → does not.
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

The split was blocked on Part 1 by choice: done first, it would have left the
pggb page thin exactly where it should be strongest. Now the pggb page gains the
sections the minigraph half monopolizes, and gains them in better form:

- the graph anchored on the reference path, so it shares an axis with the linear
  view above it rather than only a color ramp (done — that is the
  `pangenome/local_subgraph` figure)
- Sample rows with real carriage, checkable against the `odgi pav` track directly
  above it
- the graph browsable at any locus with no per-window `odgi extract` (Part 2)
- bubbles and alleles from the pggb side: the VCF's `LV`/`PS` snarl tree **is**
  the bubble hierarchy, and it comes with genotypes, so "which strain takes which
  path" and the allele inventory both beat their minigraph equivalents
- the `odgi untangle` lane above, which no current projection replaces

Split cost, when it happens: a gallery card and `guide:` entry in
`website/src/lib/gallery.ts`, a generated tutorial thumbnail (needs a figure on
the new page to crop from), and four inbound anchors across two tutorials.

## Traps in the surrounding pipeline

- **`pangenome/local_subgraph` cannot be regenerated until the plugin is
  published.** The fixture config loads the plugin from
  `https://jbrowse.org/demos/graphgenomeviewer/`, so the spec's new
  `referencePath` does nothing against the deployed bundle. `pnpm betabuild` in
  the plugin repo, then regenerate.
- The two graph figures use a local-path config, so their `<Figure>` tags carry
  `link=""`. `pangenome/graph_force` sets a raised `diffThreshold` for FMMM
  jitter; `pangenome/local_subgraph` no longer needs one, being deterministic.
  Read the website `CLAUDE.md` section on raised thresholds before concluding a
  figure "did not change".
- `website/docs/tutorials/CLAUDE.md` says to avoid specific numeric values in
  prose. Commit `05a3b3b5ba` added several (depth loci, VCF record counts,
  per-strain absence rates) before that rule landed; bringing them back to
  qualitative statements is an open cleanup. The `local_subgraph` caption is
  done.
