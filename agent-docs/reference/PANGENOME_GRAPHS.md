---
name: pangenome-graphs
description: How a graph reaches JBrowse — what rGFA and plain GFA can and cannot say about coordinates and carriage, the one-node-per-bubble level of detail, ceilings measured on the hosted HPRC index, and the decisions that look like bugs and are not. Read before touching a graph adapter, a pangenome figure, or a linearized-variation lane.
---

# Pangenome graphs

How a graph reaches JBrowse, what each format can and cannot say, and the
findings that are expensive to re-derive. Replaces `GENERAL_GFA_HANDOFF.md` and
`PANGENOME_PATHS_HANDOFF.md`, both of whose work shipped.

The view itself is a third-party plugin,
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` — build and deploy traps are
in the `key_pattern_graphgenomeview_plugin_deploy_and_autofit` memory. User docs
are `website/docs/user_guides/graph_genome_view.md`.

## Coordinates are the only real difference between formats

- **rGFA** (minigraph, and the minigraph stage of Minigraph-Cactus) states
  `SN`/`SO`/`SR` per segment.
- **A plain GFA** (pggb, odgi, vg, base-level Minigraph-Cactus) states the same
  thing in path order: walking a path assigns every segment it visits an
  interval on that path's own sequence. **P and W lines are both read** (W since
  2026-08-02. It used to `sys.exit`, while three docs already claimed support).
  A W line is the easier of the two, because it names sample and haplotype in
  their own fields and gives the walk's start offset outright, where a P line
  hides an `odgi extract` offset in a `:start-end` name suffix. A graph mixing them
  (Minigraph-Cactus writes the reference as P and haplotypes as W) anchors on
  the P line with no `--reference` argument, because file order picks it.

Same information, different encoding. Both are consumed the same way, and there
are two routes in:

| Route                       | Built by                                                                     | What it gives                                                             |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| indexed track (rGFA)        | `scripts/build_rgfa_tabix.sh` (`gfatools gfa2bed -m` + an awk pass over L)   | browse by locus, launch menus, hover sync, segments as a linear track      |
| indexed track (plain GFA)   | `scripts/build_pggb_tabix.sh` → `scripts/pggb_gfa_to_bed.py` (the path walk) | the same, plus `SM:Z:` carriage rGFA cannot express                        |
| coarse tier (any graph)     | `scripts/build_bubble_tier.sh` → `scripts/bubbles_to_tier_bed.py`            | the same, one node per bubble, so a whole chromosome is drawable           |
| a GFA file                  | `odgi extract` / `vg chunk`, then **Add → Graph genome view**                | one window, no index; the view walks a chosen path in-app (`pathAnchoring.ts`) |

Every builder emits the same pair, and `RgfaTabixAdapter` reconstructs a
synthetic rGFA from them (`formatSubgraph` in `rgfaBed.ts`), which is why
nothing downstream had to learn a second format:

- `<prefix>.segs.bed.gz`: `stableName start end segmentId rank [tags]`
- `<prefix>.links.bed.gz`: one row per L-line **per endpoint**, both endpoints
  stated in full, because a neighbour usually sits on another stable sequence
  where tabix cannot look it up by id, then `[srcTags tgtTags]`

## The tag column is the extension point

Column 6 of `segs.bed` is a space-separated list of **GFA tags**, written
verbatim onto the S-line `formatSegment` synthesizes. The GFA parser already
reads arbitrary tags into `GraphNode.tags`, typed, so a producer can state
something new without touching the adapter, the parser or the renderer. rGFA
files have no sixth column and are unaffected.

This replaced a bespoke `samples` column, which had a positional slot per
concept and would have needed five more for the tier alone. In use now:

| tag                                  | written by                | means                                    |
| ------------------------------------ | ------------------------- | ---------------------------------------- |
| `SM:Z:`                              | `pggb_gfa_to_bed.py`      | carriage, comma separated                |
| `ct:Z:`                              | `bubbles_to_tier_bed.py`  | node type, `bubble` or `backbone`         |
| `cn:i: cw:i: cs:i: cl:i: cv:i:`      | `bubbles_to_tier_bed.py`  | segments, traversals, shortest, longest, inversion |

adr-028's precomputed `LO:Z:` layout position lands here too, with no format
change.

**The tag grammar is checked, not trusted** (`GFA_TAG` in `rgfaBed.ts`). Files
built before this column existed put a bare comma list there, and passing that
through would put a non-tag field on an S-line, which is a malformed GFA rather
than a missing annotation. Non-conforming fields are dropped, so an old file
degrades to pre-tag behaviour.

**The hosted E. coli pggb pair was one of those files. Rebuilt and rehosted
2026-08-06** with the current `build_pggb_tabix.sh` (605,979 segments / 814,027
links, 14.7 s, 4.9 MB + 21 MB), so `demos/ecoli_pangenome/ecoli_pggb.segs.bed.gz`
now carries `SM:Z:K12.1,Sakai.1,NCTC86.1,IAI39.1` per haplotype where it used to
carry a bare `CFT073,NCTC86` that the grammar check dropped.

**The display side is done too, 2026-08-06** (plugin `418bf7c`, published as
`bfe47428e7ae`). `gfaConverter.makeNode` reads `SM:Z:` into `GraphNode.samples`,
which `model.ts` already rendered as `carriedBy`. Precedence is walk-first:
`pathAnchoring.anchorNode` rebuilds `samples` from path visits whenever there are
any, so a file-loaded graph keeps the authoritative set and the tag is only what
an indexed cut falls back to.

Measured in the app rather than inferred, on `pangenome/pggb_locus_graph` against
the hosted index: **0 of 53 nodes** carried samples on the previously published
bundle, **53 of 53** after, spelled per haplotype (`CFT073.1, IAI39.1`). If this
ever regresses, that A/B is the check — the unit tests cover the segs row → the
synthesized S-line → the parser → `node.samples`, and the end-to-end one is
`rgfaBed.test.ts`'s "SM:Z: on a segs row reaches GraphNode.samples".

**The linear side landed 2026-08-06 too** (plugin `f2108cc`, published as
`0093d998d280`, which is what `test_data/graphgenomeview/*.json` now pins).
`getFeatures` parsed the tag column
and then dropped it, so the whole tag route ended at the graph view and a
LinearGenomeView lane colored by carriage was not expressible. `segmentSamples`
in `rgfaBed.ts` now puts `samples` (the haplotype list) and `carriers` (its
length) on every feature, so a `color` jexl reads `feature.carriers` directly
rather than counting a list through a member access. Absent, not 0, on an rGFA.
`demos/ecoli_pangenome/config.json` carries the lane as `ecoli_pggb_carriage`,
and its fixture is `pggb_ecoli.segs.bed.gz` in the plugin's `RgfaTabixAdapter`
test_data: 24 real segments around the IS5 element at K12 chr:1,299,499-1,300,693
spanning every carrier count from 1 to 5.

Why a lane and not just the popup: `odgi depth` answers the same core/accessory
question as a mean over fixed windows, so an accessory stretch shorter than one
window is averaged into its neighbours. The lane is one box per segment, which is
the unit the graph actually states carriage in.

**Bundle lineage, because a commit message got it wrong on 2026-08-06.** The
three bundles published that day are a straight line, each a superset of the one
before:

| bundle | built from | adds |
| ------ | ---------- | ---- |
| `bfe47428e7ae` | `418bf7c` | `SM:Z:` → `GraphNode.samples` (the popup's `carriedBy`) |
| `aee5e17f4b2c` | `60a4049` | `maxRegionBp` |
| `0093d998d280` | `f2108cc` | `samples`/`carriers` on the linear feature |

`418bf7c` is an ancestor of `60a4049` (`git merge-base --is-ancestor`), and
`grep carriedBy` finds it in **all three** served bundles. So the claim that
`aee5e17f4b2c` "predates carriage entirely" is false, and a figure pinned to it
showing `carriedBy` is not evidence of a bad pin. Check a bundle by grepping the
served file rather than reasoning from publication order — the hashes are
content-addressed and say nothing about lineage.

**Carriage is per haplotype**, written `HG002.1`. Keying it on the PanSN sample
alone merged a diploid sample's two haplotypes, so a segment carried only on the
maternal copy read as "HG002 carries it". On haploid input the `.1` is accurate
rather than noise.

## Level of detail: one node per bubble

The fine tier draws one node per GFA segment, so node count grows with sequence
and the drawable window tops out near 100 kb. The coarse tier draws one node per
bubble, with the invariant reference between bubbles as backbone nodes, and it
needed **no adapter, glyph or renderer work** because a collapsed bubble already
fits the contract above: a reference span, an id, a rank.

Measured over HPRC release 2's hosted `bubbles.bed.gz` (130,510 bubbles), nodes
returned for a whole 249 Mb chr1, against ~751k segments in the graph:

| `--min-content` | chr1 nodes | index size        |
| --------------- | ---------- | ----------------- |
| 0               | 18,888     | 2.9 MB + 5.5 MB   |
| 1000            | 3,342      | 582 kB + 1.1 MB   |
| 10000           | 474        | 99 kB + 172 kB    |

So a chromosome is drawable at 10 kb, a 10 Mb window at 1 kb (151 nodes), and a
1 Mb window at full bubble resolution (111). Below that the fine tier takes
over. That is the same shape as [SYNTENY_LOD.md](SYNTENY_LOD.md)'s two PIF
tiers, so the view change is picking a prefix by `bpPerPx` rather than a new
rendering mode.

**It draws, and the figure is published** (2026-08-06,
`pangenome/hprc_whole_chromosome`): all 249 Mb of chr1 as 474 nodes / 473 edges,
layout 18 ms. The chr1 tier is **237 backbone nodes alternating strictly with
237 bubbles** and covers 0–248.6 Mb with no gap over 1 Mb — the stretch that
looks empty is one **18.7 Mb backbone node at 125.2–143.8 Mb**, the centromere
and 1q12 heterochromatin, not a coverage hole.

**The bp ceiling was the only blocker, and it is a session prop now.**
`MAX_GRAPH_REGION_BP` is a proxy for node count and a fair one only at segment
granularity (5 Mb of the fine index is 3,034 segments; the same span is 35 tier
nodes). `maxRegionBp` defaults to the same 5 Mb and a session pointed at a tier
raises it; `maxGraphNodes` counts what came back and remains the real backstop.
The launch menus keep the constant deliberately.

**The bubble file also plots as a curve with no adapter change.**
`MinigraphBubbleAdapter` sets `score` to the segment count and extends
`BaseFeatureDataAdapter`, which supplies `getRegionQuantitativeStats` off
`scoresToStats` — only the track *type* changes, since a `FeatureTrack` offers
no wiggle display. chr1 is 9,444 bubbles, scores into the hundreds.

**`gfatools bubble` returns 0 bubbles on a pggb GFA** — it needs rGFA
`SN`/`SO`/`SR` to place a bubble on a reference. That used to mean the graph most
needing coarsening could not be coarsened; **it can now, and from a file the
graph already ships** (2026-08-09). `pggb -V` writes a `vg deconstruct` snarl VCF
whose `LV=0` records are the top-level bubbles, each with a reference span, an
`AT` traversal per allele and the allele sequences, so
`scripts/snarls_to_bubble_bed.py` emits the bubble BED `bubbles_to_tier_bed.py`
reads and nothing downstream changes. No BubbleGun run, no re-running pggb.

Measured on the hosted E. coli `ecoli_pggb_snarls.vcf.gz`: 174,528 records,
**143,964 top level, 0 of them overlapping**, so the tier's one-sorted-walk
assumption holds on snarls as it does on gfatools bubbles. Hosted as
`ecoli_pggb.tier50`:

| `--min-content` | bubbles in 20 kb | whole graph |
| --------------- | ---------------- | ----------- |
| 0               | 462              | 143,964     |
| 50              | 2                | 544         |

At 0 every single-base alternative is a node and the tier is worse than the fine
index; at 50 those go into the backbone and every indel survives, which makes the
whole 4.64 Mb graph **1,088 nodes in 51 kB** against 606k fine segments. 100 kb
draws as 27 nodes (`pangenome/pggb_bubble_tier`).

**The node id needs qualifying on a pggb graph, and gfatools' does not.** pggb
folds repeats, so the reference path can walk one snarl more than once and `vg
deconstruct` reports it once per visit: `>544433>544462` appears at chr:3,943,364
and again 225 kb later. 67 of 143,897 sources are used twice, 134 rows in all, in
one repeat cluster. So the converter emits `<source>@<refStart>`, and
`bubbles_to_tier_bed.py`'s uniqueness assert is what found this rather than a
silently merged pair of loci. The cost is that the id no longer joins straight
back to the fine tier the way an rGFA tier's does, which for a repeat-folded
graph was never single-valued anyway.

**Still not built: popping a bubble open in the app.** pangyplot's `/pop` swaps
one collapsed node for its internal subgraph, which here would be a second
`GetSubgraph` over the popped bubble's span against the FINE prefix, spliced into
the tier GFA by dropping the collapsed node's S-line (the fine cut supplies a real
one for the same id) and letting the tier's links attach to it. That plus a node
menu item and a `popped` set on the model. Until then the ladder is two figures,
coarse to find and fine to open.
And the tier is **a dud on a bacterial rGFA**, which is the minigraph half of
the same graph rather than the pggb half above: the five-strain E. coli minigraph
graph gives 601 bubbles → 358 nodes at `--min-content 2000`, but its fine index
is already only 1,508 segments for the whole 4.64 Mb chromosome, so the tier
buys ~4× where HPRC gets ~1,600×.

Facts behind it, each measured rather than assumed:

- **Bubbles do not overlap.** 0 overlapping adjacent pairs across all 24 GRCh38
  chromosomes, so one sorted walk per chromosome is a complete alternating
  chain. `gfatools bubble` reporting top-level bubbles only is what buys this.
- **Threshold on content, never on reference span.** 53,293 of the 130,510
  bubbles are zero-length on GRCh38, because a pure insertion is an alternative
  to nothing. `end - start` drops every one, including the 100 kb+ insertions
  that are the pangenome's whole claim. Content is
  `max(reference span, longest allele)`.
- **A zero-span bubble draws 1 bp wide** and states its real size in `cl:i:`,
  the same convention the allele inventory and the bubble CIGARs already use.
- **The node id is the bubble's own source segment**, so a tier node joins back
  to the fine tier and expanding one is a fine-index query over the same span.
  Adjacent bubbles share a boundary segment (one bubble's sink is the next
  one's source), so sources are distinct while sinks are not.
- Covered by `bubbleTier.test.ts` in the plugin, over a committed whole-chrY
  tier fixture (57 bubbles, 5.5 kB).

## Decisions that look like bugs and are not

- **First visit wins** when a path reaches a segment twice. A node draws as one
  tube at one x, so the alternative claims reference the segment does not
  occupy. The repeat stays visible as depth (a multiple of the path count).
  Test case: the rRNA operons, where `odgi depth` reaches 10 over the
  five-strain E. coli graph at `chr:4,167,000-4,170,500` and
  `chr:3,942,000-3,946,500`.
- **An off-reference segment sits on its own carrier's coordinates**, the same
  asymmetry rGFA has. This is what makes `contributingAssemblies` and the whole
  launch-out menu work on a graph with no `SN` tags.
- **Rank is 0 or 1 for a path-derived graph.** rGFA's higher ranks are
  minigraph's build order; a path GFA has no equivalent and more would be
  invented structure.
- **The reference path is a choice, not a fact.** Explicit `referencePath` wins
  (PanSN sample first, then full name), else `loadedRegion.assemblyName`, else
  the first path in the file, which is where pggb and odgi leave it. An
  unmatched name falls back rather than dropping to force-directed.
- **The `:start-end` suffix comes off the path name** and into the offsets.
  `odgi extract` writes `K12#1#chr:1004500-1004961`, which is the only statement
  of where the cut sits; leaving it on gives PanSN a contig no linear view can
  open, and dropping it silently puts every extracted subgraph at the origin.
- **The offline walk matches the in-app one on purpose**, so an indexed cut and
  a file cut of the same window agree. Verified: at the `local_subgraph` window
  all 36 intervals from `build_pggb_tabix.sh` match those `gfa_nodes_to_bed.py`
  derives from the `odgi extract` subgraph.

## Ceilings, measured

- **Index size grows with total sequence, not variation.** A pggb graph runs
  ~17 bp/segment: five-strain E. coli is 606k segments and 814k links, ~11 s to
  build, 4.8 MB + 21 MB. A human base-level graph is orders of magnitude past
  that; there, index a chromosome at a time or browse the SV-resolution
  minigraph rGFA instead.
- **The builder's name says nothing about resolution.** The same five strains
  through Minigraph-Cactus land in the same place as pggb: 628k segments, 842k
  links, 13.5 s, 5.0 MB + 20.8 MB (measured 2026-08-13), because
  `mc/ecoli.gfa.gz` is the base-level graph. The SV-resolution one is
  `mc/ecoli.sv.gfa.gz` sitting beside it, from the minigraph stage, and a fifth
  the size as a file. So "index the Cactus graph" is two different jobs
  depending on which of the two, and a glob over `mc/*.gfa.gz` picks by sort
  order rather than by intent.
- **The drawable window is node-density-bound, not index-bound.** 1 kb of that
  pggb graph is ~150 nodes and legible; 3 kb is 519 and draws as a braid.
- **Force layout does not get better with more nodes.** Measured over real
  subgraphs, fitted to a 1000 px pane: 60 kb / 108 nodes / mean node 62-77 px /
  ~2% of the canvas inked; 1 Mb / 449 nodes / 15 px / ~2%; 3.5 Mb / 1041 nodes /
  5 px / ~2%. `bandageAutoScale` targets a mean drawn length whatever the count,
  so FMMM lays a near-path pangenome out as one thread whose length grows and
  whose 2-D coverage does not.
- **The force layout is deterministic** as of 2026-07-27. It was not: OGDF's
  `RandomTime` initial placement reseeds from `time(nullptr)` and ignores
  `randSeed`, so the same window drew differently every run and the two
  force-directed figures carried `diffThreshold: 0.1`. The engine's C++ is now
  in the plugin (`src/bandage/native`), seeded, with `pnpm test:wasm` asserting
  it. A `seed` option overrides per call.
- **A row is a row height, and the y axis is not scaled** — fixed 2026-08-06,
  plugin `6684edb`. It used to be 5% of the *drawn width*, in bp, with one scale
  drawing both axes, so a two-row graph got a ~46 px pitch for a 10 px tube and
  a taller-than-wide drawing bound zoom-to-fit on its height and took the
  backbone out from under the linear view's axis. `scaleX` now carries the zoom
  and `scaleY` is pinned at 1; the pane is the row count times the pitch, and
  rows past its ceiling are panned to.

  **The cost is not in the layouts, it is in everything that mixes the axes.**
  A chord length, a tangent projection, a deletion's bow, a mitre normal, an
  arrowhead's angle and a hover distance are each one `hypot` over x and y, and
  every one of them converts before it measures. They take **one `AxisScale`**
  (`{scaleX, scaleY}`, the model's own numbers) rather than a scale plus an
  optional ratio: passing them separately let a caller supply x and default y,
  which compiles and draws a wrong picture silently, and three of these have to
  agree or a label lands where its arc is not. `scaleY === scaleX` is the
  isotropic path and is asserted to be the *identity*, which is what keeps every
  committed FMMM figure where it is.

  **A drawing whose y is horizontal notices none of this**, which is worth
  knowing before trusting a test: a row layout's node polylines are horizontal,
  so their normals are (0,±1) under any axis and their positions come from the
  transform. A deletion's BOW is the one shape whose geometry depends on the
  ratio — get it wrong and it balloons by roughly `scaleY/scaleX`, ~100x at a
  typical window. Any test meant to catch an axis mistake needs an arc with
  backbone to bow around, or it passes either way.

  The one place not converted is `graph.slang`, whose generated WGSL divides the
  vertex normal by `scale.x` alone; it is dead until a GPU backend exists, and
  `GraphRenderer.ts` says what to change.
- **`odgi degree` is a dud**: over 500 bp windows, mean 3.82, max 4.79, no
  dynamic range. It does not make a graph-complexity track. The tutorial shipped
  one anyway for a while; it was removed 2026-08-05 with the measurement that
  settles it, over the 9,284 windows `build_ecoli_pangenome_graph.sh` writes:
  p5 2.85 / p50 3.93 / p95 4.05, so 90% of the chromosome sits in a 1.2-unit
  band, and **degree correlates with depth at r = 0.78**, i.e. it is mostly the
  curve above it drawn again. The claim it was carried for was "a window can be
  fully covered and still branched" — of the 5,719 windows at full depth, 11.8%
  land in the global top decile of degree, which is what chance gives. Don't
  rebuild it; if graph tangledness needs a lane, it needs a different statistic.
- **`odgi untangle` is usable** as a general-graph lane, and it shipped
  2026-08-06: the hosted E. coli projection is rebuilt with
  `-R target -Q queries -m 1000 -j 0.5 -e 5000 -p`, 2m13s, **3,923 records**
  (CFT073 919 / IAI39 956 / Sakai 981 / NCTC86 1,067). `scripts/untangle_to_bed.py`
  drops it into `LinearMultiRowFeatureDisplay` with `partitionField` on the
  strain. Does not scale to human at that cost.

  **`-e` is the decision to re-read before reusing this, because it contradicts
  adr-024** (in the removed gfa-to-tabix tree;
  `git show 3b98dbb985^:agent-docs/architecture-decision-records/adr-024-untangle-replaces-synteny-build.md`).
  That ADR says leave `-e` off: the cut is irreversible and the rule was bake
  permissive, filter up at runtime. Both premises differ here — these files feed
  static figures with no runtime merge to filter up with, and the regime is a
  five-strain near-colinear bacterial graph rather than HPRC chr20 at 90
  haplotypes. Without `-e` this graph returns **174 records for all four pairs**,
  which is not a coarser figure but no figure; it is what the `bad` verdict on
  `pangenome/pggb_untangle` was about. Keep the ADR's advice for a human-scale
  graph and for anything a display is expected to filter.

  What the finer file then says, measured: 310 of IAI39's 956 segments are
  reverse-strand, merging into five runs on K12 (213,443-262,948;
  302,899-501,436; 914,963-1,239,923; 1,635,838-2,229,302; 3,941,447-4,171,723),
  while Sakai and NCTC86 have **zero** and CFT073 has one — the control is in the
  same file. That agrees independently with the minigraph `--call` route below
  (IAI39-only, run at 1,671,139-1,870,074, inside the fourth). And two K12 spans
  (`3,941,447-3,944,255`, `4,169,192-4,171,723`) are each reached from two
  distant query loci by those same three strains, which is the rRNA collapse.

## Carriage: the one thing rGFA cannot say

`SR` is build order, so on an rGFA a segment names the assembly that
*contributed* it first, never who else carries it. Both pangenome tutorials warn
about this, and the two workarounds are:

- **`minigraph -cxasm --call`** per assembly, projected to a per-bubble-per-
  sample BED by `scripts/build_minigraph_paths.sh`. Header line is the contract
  (`chrom start end name score strand thickStart thickEnd itemRgb strain class
  delta pathLen refLen alleles nonRef path`); columns 1-14 are stable.
- **a path GFA**, where every path visiting a segment is stated. The walk
  records it as an `SM:Z:` tag, per haplotype, and it reaches
  `GraphNode.tags.SM` in the graph view and `feature.carriers` /
  `feature.samples` on the linear track. See "The tag column is the extension
  point" above.

`--call` traps, each a wrong first attempt:

- a bare `.` in the last field is **missing data**; read as colon-separated it
  yields pathLen 0 and scores as a whole-span deletion.
- `*` is an **empty path**, a deletion only where the bubble has reference span.
  72 of the 601 E. coli bubbles have none, and there `*` is the reference
  allele. Classifying on `delta` handles both; `.` needs its own check.
- **the reference row is the pipeline's own check**: K12 comes out `ref` at all
  601 bubbles. An indel there means suspect the join, not the biology.

### No linearized deletion track. Decided 2026-07-31, do not rebuild it

The anchored layout draws the backbone at reference coordinates, which invites
the next step: project the link index into a `LinearPairedArcDisplay` track (or a
custom track type in the plugin) so a deletion is an arc in an ordinary LGV with
no graph view at all. The pieces are all there — `links.bed.gz` states both
endpoints with ranks, `deletionEdges.ts` already classifies them, `BedpeAdapter`
and the arc display ship in core. It was **not built**, for three reasons in this
file:

- **The arcs are anonymous.** A backbone-to-backbone skip has GRCh38 at both
  ends, so it names no donor (Carriage, above). A row in a linear track is read
  as carriage, which is the misreading that retired `hprc_allele_inventory`'s
  sample rows and that "Structure, not sequence" in `pangenome_hprc.md` exists to
  head off.
- **`wave.vcf.gz` already does it, better.** It is not symbolic, it is
  tabix-indexed, it carries explicit ALTs to 65 kb and a genotype per haplotype,
  and it needs no plugin. The CFHR deletion is one of its records with 139 of 464
  haplotypes carrying it. A projected arc would be the same event with the
  genotypes thrown away.
- **What the projection would uniquely add is what an axis cannot hold.**
  Segment-level correspondence with the graph panel, and the chaining and nesting
  of an alternate path. Nesting is the part with no linear encoding, so the
  content worth linearizing is already in the VCF and the content not in the VCF
  is not linearizable.

Same shape as the reroot-MAF reverts: a linear projection of a graph looks like a
missing feature and is usually a claim the graph cannot support.

## Verified facts, so nobody re-derives them

- `gfatools bubble` reports **top-level bubbles only**, and on the E. coli graph
  they never overlap (0 of 601), which is what makes one flat lane per strain
  complete rather than lossy. Nested variation is the cost, and lives in the
  VCF's `LV`/`PS` snarl fields instead.
- Allele spectrum: 436 biallelic bubbles, 105 with three alleles, 37 with four,
  23 where all five strains differ.
- `strand` is **orthogonal to the length classes**: IAI39's 169 reverse-aligned
  calls split 60 ref / 57 del / 52 ins, in long contiguous runs
  (1,671,139-1,870,074 and nine others). No other strain has any.
- The rGFA-only allele inventory (`build_rgfa_alleles.sh`) agrees with `--call`
  on 747 of 842 alleles; the 95 that differ are compound routes at 69 nested
  bubbles.
- **The five-strain `.og` is on this box**: `~/ecoli_graph5/pggb/*.smooth.final.og`
  with the `.gfa` and `-V` VCF beside it, plus the PanSN fastas in
  `~/ecoli_graph5/`. Do **not** use `~/depth_build/`, the pre-IAI39 four-strain
  run.
- **So is the Minigraph-Cactus run**, in `~/ecoli_cactus5/`, and it is the one
  the live demo was built from: its `ecoli_cactus_depth.bw` matches the hosted
  object byte for byte, where `~/ecoli_cactus_build/`'s does not. That is the
  cheap way to tell two old build directories apart before rebuilding either.
- **The MC graph is indexed and hosted** as of 2026-08-13:
  `demos/ecoli_pangenome/ecoli_cactus.{segs,links}.bed.gz{,.tbi}`, read by the
  demo's `ecoli_cactus_segments` track and written from then on by
  `build_ecoli_pangenome_cactus.sh`. Remote `tabix` over the hosted pair answers
  `K12#0#chr` range queries, which is the adapter's own access pattern and the
  whole check that an upload of one of these worked.

  That check is about the bytes, and it is worth knowing what it leaves out: the
  reader's path is the demo config plus its own **unpinned** plugin url, where
  every committed graph figure pins the bundle and declares its tracks in a
  session spec instead. So a track that resolves by `tabix` can still be a track
  the app never draws. Rendering it the reader's way is the other half, and
  `specs/pangenome_cactus.ts` says how above `GRAPH_CONFIG`.

## Measured on the hosted HPRC link index

`tabix` on `hprc-v2.0-mc-grch38.links.bed.gz`, two windows from the tutorial's
own loci: C4 (`GRCh38#0#chr6:31,980,000-32,050,000`, 70 kb) and MHC class II
(`32,450,000-32,650,000`, 200 kb).

- **Haplotype identity is already in the file.** `SN` on a rank>0 segment is the
  PanSN contig of the haplotype that introduced it (`HG01433.2#2#CM086511.1`),
  and rank maps 1:1 to donor (MHC: 16 ranks, 16 donors, none shared), so
  labelling an off-reference allele needs no W-line projection. But minigraph
  collapses, so the label is the **first** haplotype to contribute the allele,
  never everyone carrying it: 464 haplotypes in the graph, 15 donors in the MHC
  window, about one allele each. Discovery attribution, not a pileup, and it
  must not be drawn as one.
- **Clean deletions are anonymous.** A backbone-to-backbone skip has GRCh38 at
  both ends, so no `SN` and no donor. One gets a donor only when it carries
  novel sequence (`s462766`, 1 bp, HG01952.1, bridging 31,984,683 to 31,991,051
  — a 6.3 kb deletion). MHC: 8 anonymous deletions against 78 attributed
  alleles, which is why a per-haplotype row layout can place insertions but not
  deletions.
- **Chain walking is mostly unnecessary.** An alternate path's interior links are
  indexed under the donor contig, so a reference query never returns them — but
  72 of 78 MHC alt segments appear in both an off-backbone and an on-backbone
  link, so one segment id gives the whole allele (`refStart` = entry's srcEnd,
  `refEnd` = exit's tgtStart, `altLen` = the segment's own length). The rest
  resolve without the interior too, because entry and exit share `SN` and donor
  coordinates run contiguous across the allele (`s526659` 31,891,267-31,923,687
  then `s526660` 31,923,687-31,924,005, so altLen 32,738). Pair by `SN` **then**
  donor offset; `SN` alone is ambiguous, HG01433.2 contributes 41 entries in
  that one window.
- **Volume is trivial.** MHC 200 kb: 320 unique links, 155 backbone-adjacent, 8
  deletions (mean 605 bp), 78 off the backbone, 79 back onto it, 0 alt-to-alt.
  C4 70 kb: 36 links, 1 deletion, 10 out, 11 back. Tens of records per window,
  so no density gate. That 0 is a property of the reference-keyed index, not of
  the graph.
- **The VCF is not symbolic**, so allele length is not what the graph adds.
  `wave.vcf.gz` at `chr6:32,010,000-32,020,000`: 126 records, **zero** symbolic
  ALTs, explicit ALT strings up to 65,481 bp, genotypes per haplotype. What a
  linearized graph adds over it is segment-level correspondence with the graph
  panel (same ids, same rank colors), the chaining and nesting of an alternate
  path, and working on a bare minigraph rGFA with no `deconstruct` step.

## The hosted index is 95% dead weight (measured 2026-07-30)

Every graph launch downloads both tabix indexes before it can cut anything, and
that fixed cost is what the perf readout reports as `fetch 12371ms` in the
published HPRC graph figures. It is index download, not query:

| file                | data     | `.tbi`   | indexed sequences |
| ------------------- | -------- | -------- | ----------------- |
| `segs.bed.gz`       | 6.7 MB   | 4.42 MB  | 13,717            |
| `links.bed.gz`      | 34.2 MB  | 4.76 MB  | 13,581            |
| reference rows only | 2.5/12.5 | 0.21/0.26 | 195              |

195 of those 13,717 sequences are `GRCh38#*`; the rest are donor contigs.
Rebuilding the pair from `$1 ~ /^GRCh38/` returns byte-identical rows for
**19× less index** (9.18 MB → 0.48 MB), verified across seven windows including
a whole chromosome. `build_rgfa_tabix.sh` emits it from a third argument, and
the pair is hosted at `demos/hprc/hprc-v2.0-mc-grch38.ref.*`.

**Correction, 2026-08-05: "`getSubgraph` at the default `context: 0`" was wrong,
and it inverts the conclusion.** `subgraphContext` is `types.optional(types.number, 1)`
— the default is **1 hop**, not 0. A hop follows an allele's interior segments,
which are indexed under the donor contig, so on the small pair the expansion
finds nothing and the cut silently degrades to context 0: the two stubs ending
in mid-air that `graph_context.png` exists to explain. Measured on C4:

| context | full | reference-only |
| ------- | ---- | -------------- |
| 0       | 30 nodes / 36 edges | 30 / 36 — same |
| 1 (default) | 34 / 43 | 30 / 36 — **differs** |
| 2       | 34 / 45 | 30 / 36 — **differs** |

So the small pair is for a **segments track drawn on the reference** (which only
ever queries the reference refName) and for a session that sets
`subgraphContext: 0` deliberately. The graph cut keeps the full pair, as does a
segments track opened on a contributing assembly (E. coli, and HPRC's hs1/CHM13
lane). The 12 s `fetch` in the graph figures is therefore **not** free to
reclaim this way; reclaiming it needs the hop to reach donor rows some other
way, which is a different piece of work.

## The bubble file is a locus finder (scanned 2026-07-30)

`hprc-v2.0-mc-grch38.bubbles.bed.gz` is 130,510 bubbles, and it carries enough
per row to rank loci without opening the graph: segment count, path count,
shortest and longest allele, and an **inversion flag that is set on only 246 of
them**. That 246 is small enough to treat as a complete list.

Scoring on `longest - shortest` alone returns pericentromeric and satellite
regions with thousands of segments — a real answer to "where does the graph hold
the most sequence", and undrawable. Filtering to what the view can draw
(delta ≥ 20 kb, ≤ 200 segments, span ≤ 300 kb) leaves 30 candidates, and the
gene names come off the hosted `ncbiRefSeq.gff.gz` (note `gene` rows carry
`gene_id=`, not `gene_name=`). The ones worth knowing:

| locus                          | segs | inv | shortest → longest | genes                    |
| ------------------------------ | ---- | --- | ------------------ | ------------------------ |
| `chr5:70,996,742-71,121,626`   | 27   |     | 0 → 375,610        | GTF2H2, NAIP, OCLNP1     |
| `chr5:69,967,884-70,150,288`   | 50   | yes | 140,991 → 433,090  | SMN2, SERF1B             |
| `chr22:22,674,713-22,919,615`  | 137  |     | 32,072 → 303,712   | IGLL5 (the IGL locus)    |
| `chr14:105,558,722-106,679,859` | 3784 | yes | 106,366 → 2,455,720 | ADAM6, ELK2AP (IGH)     |
| `chr22:18,185,648-19,023,244`  | 2194 | yes | 74,902 → 1,180,034 | DGCR6, FAM230A (LCR22)   |
| `chr1:103,611,080-103,732,636` | 95   | yes | 26,889 → 316,616   | AMY1A, AMY1B, AMY2A      |
| `chr19:42,738,980-42,854,205`  | 146  |     | 0 → 490,126        | PSG3, PSG8               |
| `chr1:248,122,398-248,180,452` | 18   |     | 0 → 247,631        | OR2M2, OR2M5             |
| `chr10:87,233,092-87,429,953`  | 10   | yes | 64,643 → 329,055   | NUTM2A, NUTM2D           |
| `chr16:74,406,294-74,406,329`  | 40   |     | 35 → 239,774       | CLEC18B                  |
| `chr15:28,452,488-28,603,853`  | 98   | yes | 27,815 → 332,579   | GOLGA8G, HERC2P11        |
| `chr1:12,780,118-13,315,943`   | 658  | yes | 61,683 → 1,101,014 | PRAMEF*, HNRNPCL*        |

5q13 is three overlapping mega-bubbles plus an inversion at 27-72 segments
apiece, which is the rare combination of drawable and famous: RefSeq's own
`NAIP` description calls the region "a 500 kb inverted duplication… prone to
rearrangements… difficulty in determining the organization of this genomic
region", and SMN1 copy number is what sets spinal muscular atrophy severity.

## Only two donors can be loaded as assemblies

Of the 464 donor haplotypes in the segment index, exactly **HG002.1, HG002.2 and
CHM13** spell their contigs `chr1`-style; the other 460 use GenBank accessions
(`CM086511.1`). So those are the only contributors a session can open a linear
view on, and the whole outbound launch menu (`nodeLaunchTargets`,
`launchableAssemblies`, the synteny launch) is dead on HPRC purely because the
config loads one assembly.

CHM13 costs nothing to add: UCSC hosts it as `hs1`
(`test_data/hs1/config.json` already has the assembly stanza, a TwoBit off
`hgdownload`), genes are `gbdb/hs1/ncbiRefSeq/ncbiRefSeq.bb`, and
`goldenPath/hg38/liftOver/hg38ToHs1.over.chain.gz` is 2.7 MB and reads through
`ChainAdapter`, which is what a synteny launch out of the graph needs. Pair it
with `assemblyNameToPanSN: { "hs1": "CHM13" }`.

HG002's parents are **not** in the graph (`pgbi.vcf.gz` has HG002 and HG005 but
no HG003/HG004), so there is no trio to show inside the pangenome.

## Release 2 files nothing here reads yet (probed 2026-07-30)

All three are public on `s3://human-pangenomics` and all three answer a question
the sections above record as unanswerable.

- **`submissions/671F0A25-…--hprc_v2.0_mc_grch38_index/hprc-v2.0-mc-grch38.pgbi.vcf.gz`**
  (3.5 GB, `.tbi` published beside it) is the **carriage file this page says does
  not exist**. Snarl-level rather than decomposed: `AT` per allele is its
  traversal through the graph, `LV`/`PS` place it in the snarl tree, and 231
  phased samples give 462 haplotypes of `GT`. Remote `tabix` over the C4 window
  (70 kb) is 1,107 records, 3.2 MB of text, 1.7 s — browsable, unlike its size
  suggests. Records with no `LV` field are the long alleles (`REF` up to 39 kb);
  451 of the 1,107 are `LV=0`. **The join to our graph is positional, not by
  id**: `ID`/`AT` name base-level integer nodes (`>161001867>161004536`), not the
  `sNNNNN` of `sv.gfa`.
- **`submissions/afb0c613-…--WashU_HPRCv2_MEI/all.final.INDEL.unique.gt.combined.hg38.bed`**
  (10 MB, hg38, one file) names what an insertion *is*:
  `chrom start end class score strand INS|DEL carriers intactness`, where class
  is `AluY`/`SVA`/`L1…` and `carriers` is `SAMPLE:1|0,…` phased per haplotype.
  bgzip + tabix and it is a `FeatureTrack`.
- **`pangenomes/freeze/release2/impg/pafs/all-vs-1/*.merged.paf.gz`**, one per
  haplotype against GRCh38 (0.5-0.7 GB gzipped each). The input for a
  per-haplotype linearized synteny stack (`jbrowse make-pif`). Not range
  indexed, so a locus demo means streaming one file per haplotype and filtering
  on the target side.

## Indel glyphs (shipped)

Two length-aware passes, both an `OverlayCanvas` over whichever backend painted
the blocks plus a second call on the SVG export, neither touching a shader:
`LinearMultiRowFeatureDisplay`'s `lengthField` slot
(`rendering/drawMultiRowIndelGlyphs.ts`) and `LinearMultiSampleVariantDisplay`'s
`showInsertionGlyphs` (`components/drawVariantInsertionGlyphs.ts`). Both borrow
`drawInsertionMarker` from `@jbrowse/alignments-core`, which is the seam for
glyph geometry — add a consumer there rather than a display type (`884a126861`
is the counter-example: `MultiLGVSyntenyDisplay`, ~4,000 lines and three bespoke
shaders, deleted).

Rules they encode, each a reverted first attempt:

- **draw the bar only where it is wider than the block** — a same-colored bar
  inside a wide block is invisible overdraw, and the label carries magnitude.
- **keep the cell's own genotype color** in the variant pass; color says which
  allele, the marker only supplies length.
- **only cells whose genotype carries the allele widen** (`cellCarriesAlt`), or
  the marker claims reference haplotypes have the sequence.
- `featureDeltas.length === featureStarts.length` is the multi-row "slot is set"
  gate, because a zero delta is a legitimate reference-length allele.

## Prior art

**The abandoned `gfa-to-tabix` / `GfaTabixAdapter` effort** (removed in
`fa737e4255`, `c72b88d177`, `3b98dbb985`) solved the same problem at HPRC scale:

- `getSubgraph` was never the failure — it matched `vg find` byte-for-byte in
  under 300 ms at ≤100 kb. `synteny_build` sank it, and adr-024 benchmarks the
  replacement (`odgi untangle` on HPRC chr20, ~1 h → 1 m 39 s).
- **its chunked `pos.bed.gz` could not carry a path walk, and silently didn't**:
  rows listed the *set* of segment ordinals per chunk, so haplotype walks came
  out wrong wherever they diverged from the reference. Do not re-introduce a
  chunked ordinal index.
- **whole-contig reverse-complement ("grooming") is real**, with a deterministic
  test: flip a walk when >99% of the bp it shares with the reference are
  opposite-orientation (bp-weighted, so SNP nodes cannot outvote a reversed
  contig), then emit its steps in reverse. Our path walk does none of this; the
  E. coli demo does not need it, a real assembly set will.
- **chain contraction does not coarsen a dense graph**: adr-014 measured
  `vg mod -u` on HPRC chr20 at 0.95% reduction, because at 90 haplotypes almost
  no node has bidirected degree 2. Superbubbles (`vg snarls`, BubbleGun) are the
  primitive that works.
- extraction is **not symmetric across reference paths, and that is biology**
  (adr-015), so the Reference path picker genuinely changing the drawing is
  expected.
- **what actually made it heavy was indexing every path.** A subgraph index only
  needs the *reference* path's coordinates — rGFA states them outright in the
  `SR:0` tags, and a pggb graph gets them by walking one designated path — and
  everything else can hang off segment ids. Indexing all paths is what produced
  the 1.49 GB all-paths `segments.bin`. Any revival of reference-anchored
  subgraph browsing should start here rather than from `getSubgraph`, which was
  already fast enough.

**PangyPlot** (Mastromatteo et al. 2025, vendored at `~/src/vendor/pangyplot`)
is the closest published prior art and solved the problem this view still has:
precomputed `odgi layout` SGD baked into SQLite, plus a BubbleGun bubble
hierarchy so sub-threshold bubbles render as one node and the user pops one open
(`/pop`). Their team measured BubbleGun as published at chrY 2 s / 1 GB, chrX
30 s / 11 GB, chr9 ~40 min / 13 GB, chr1 hanging at 15+ GB; the fix is a flat
int64-CSR rewrite. `gfabase` (`src/schema/GFA1.sql`) validates the indexing
shape: a genomic range index over `(refseq_name, refseq_begin, refseq_end)` is
what `segs.bed.gz` does with tabix.

## Operating the graph plugin: two traps that cost a session each

- **`test_data/graphgenomeview/_localdist` is a stale hand-copy and nothing
  refreshes it.** `GRAPH_PLUGIN_LOCAL=1` serves that directory, so every "I
  rebuilt the plugin and it still fails" result is read off whatever build was
  copied there last. A dependency bump, two upstream patches and two rounds of
  instrumentation were all judged against a bundle containing none of them.
  **`cp -r <plugin>/dist test_data/graphgenomeview/_localdist` before any
  `GRAPH_PLUGIN_LOCAL` run**, or make the generator do it.
- **emscripten's `UTF8ArrayToString` cannot decode a long string out of wasm
  memory.** It decodes a view over `HEAPU8` — over `WebAssembly.Memory`, whose
  buffer is a resizable `ArrayBuffer`, which browsers refuse to `TextDecoder`.
  `UTF16ToString` has the same shape. Both take that path **only for strings
  longer than 16 units**, and shorter ones fall through to a manual char loop —
  which is why it read as a data bug for a whole session: the fine index names
  nodes `s10274` (6 bytes, fine) and the tier names them
  `bb_GRCh38#0#chr1_0` (18 bytes, throws), so it was 100% failure on one index
  and 0% on the other with everything else identical. Patched in
  `jbrowse-plugin-graphgenomeview/scripts/build-wasm.sh` — that plugin's repo,
  not this one — because that script overwrites the generated file wholesale.

  The general lesson is the cheaper one: **bisecting on inputs cannot find a bug
  whose error names a type.** Nine rounds eliminated window size, file size,
  route, compressor, index flavour, tag column, plugin version and two dependency
  versions, and none of them was it. One instrumented run — wrap
  `TextDecoder.prototype.decode` and **throw** the stack rather than logging it,
  since a worker's console does not reach the page — named the frame
  immediately. Reach for that on the second round, not the tenth.

## Open

The queue, with what each one is blocked on, is
[TODO.md](../TODO.md#pangenome-graph-view-the-open-queue).

- ~~**The `samples` column is emitted but not read.**~~ Done 2026-08-02, as the
  general tag column above: `SM:Z:` reaches `GraphNode.tags.SM`. What is still
  open is *displaying* it, and drawing a node once per carrier (next bullet).
- **A node carried by several assemblies draws on one row.** Needs the layout to
  emit synthetic per-carrier ids and hit detection to resolve them back.
- **Orientation is recorded but not drawn.** `StableCoordinate.strand` shows in
  the node popup; arrowheads are an edge property in `GeometryBuilder`.
- **A precomputed global `odgi layout`, carried as an `LO:Z:` tag** (adr-028) is
  not built. It is no longer about determinism — FMMM is seeded now, see below —
  but about windows of one graph being laid out consistently with each other.
  The input exists: `~/ecoli_graph5/pggb/*.smooth.final.og.lay.tsv`.
- ~~**Bubble collapse is the one that matters** for scale.~~ Producer done
  2026-08-02, see "Level of detail" above: a chromosome is 474 nodes. What is
  open is the view picking a tier by `bpPerPx`, and expand-on-click.
- **HPRC needs no per-haplotype path track after all.** `--call` would need the
  464 assemblies re-mapped, but `pgbi.vcf.gz` (above) already states carriage at
  bubble granularity and is tabix-indexed.
