# Synteny level-of-detail (PIF tiers) and the density problem

Reference for the linear-comparative-view / dotplot LOD system and where its
remaining scaling limit is. Read before touching `make-pif`, the indexed PIF
adapters, or the synteny fetch RPC.

## The two PIF tiers

`jbrowse make-pif` writes two tiers into one tabix-indexed PIF, distinguished by
a one-letter prefix on the seqid (tabix column 1):

- **fine** — `t<target>` / `q<query>` (lowercase). Per-row CIGAR. One `t` line
  and one `q` line per PAF row (the two indexed perspectives).
- **coarse** — `T<target>` / `Q<query>` (uppercase). No CIGAR. Each row is split
  wherever a CIGAR indel is `>= --coarse` (default 10 kb) so each coarse piece's
  bounding box stays tight and its straight ribbon is accurate. Emitted by
  default; suppress with `--no-coarse`.

Reader side (`plugins/comparative-adapters/src/util.ts`):
`resolveCoarseTier({ bpPerPx, threshold, hasCoarseTier, lodMode })` picks the
tier — coarse when `lodMode === 'coarse'`, or `auto` + `bpPerPx >= threshold`
(default `coarseBpPerPxThreshold` 10000). `pickPifPrefix` upper-cases the
perspective letter for coarse.

Identity continuity: a coarse row reuses the fine row's `de:f:` tag, or — absent
one — derives divergence from the PAF `num_matches`/`block_len` columns (the
same source `pafIdentity` uses for fine). It must **never** recompute divergence
from the CIGAR: a `cg` (M-style) CIGAR folds mismatches into `M`, so a recompute
reports ~0 divergence (spurious 100% identity) and colors discontinuously across
the LOD switch. Split rows lacking `de:f:` deliberately flatten to the row-level
identity to preserve fine/coarse continuity.

The `auto` tier decision uses `min(v1.bpPerPx, v2.bpPerPx)` (both synteny axes),
because CIGAR detail is worth drawing when the band is wide on either axis
(`MIN_CIGAR_PX_WIDTH` uses `max(widthPx0, widthPx1)`).

## What the coarse tier does and does NOT solve

The coarse tier cuts **per-alignment** cost (no CIGAR bytes/parse, no pass-2
indel instances, tight bboxes). It is the right tool for the "few huge
alignments with megabase CIGARs" regime (liftOver chains, distant-species
synteny).

It does **not** reduce alignment **count** — splitting on gaps only adds rows
(coarse rows `>= 2` per PAF row, vs fine's `2`). So for the "many short
alignments" regime (dense all-vs-all pangenomes, human-vs-mouse whole genome) it
is only marginal. The bottleneck there is N.

## Measured cost model (do not guess — this was profiled)

Synthetic human-vs-mouse-scale PIF (short blocks over 20 chromosome-scale
contigs), whole-genome fetch of one perspective, phases mirroring
`LinearSyntenyRPC/executeSyntenyFeaturesAndPositions`:

| phase                                   | 100k    | 300k    |
| --------------------------------------- | ------- | ------- |
| adapter fetch + parse + `new SyntenyFeature` | **86.8%** | **78.2%** |
| dedupe (Map over N string ids)          | 6.5%    | 14.2%   |
| decorate (`Feature.get` ×6)             | 2.9%    | 4.3%    |
| sort (length/pos/mate/id comparator)    | 1.7%    | 1.1%    |
| projection (`bpToCumBp` + typed arrays) | 2.1%    | 2.2%    |

The dominant cost is **per-row fetch + `parsePifLine` + `new SyntenyFeature`**;
dedupe is the growing #2; the `O(n log n)` sort is negligible (it runs on cached
primitives, so compares are cheap). N is genuinely unbounded at whole-genome
zoom: `syntenyFetchRegions` buffers by `panBufferPx·bpPerPx`, which at
`bpPerPx≈10000` exceeds the region, collapsing the fetch window to the whole
genome. Fetch scoping does not rescue coarse zoom.

To reproduce: build a PIF of N short alignments (fine tier `t`/`q` lines, one
indel CIGAR each), `sort -t$'\t' -k1,1 -k3,3n | bgzip` + `tabix -s1 -b3 -e4 -0`,
construct `PairwiseIndexedPAFAdapter`, `getFeatures` per contig over the whole
genome, and time the fetch vs the dedupe/decorate/sort/projection phases.

## Density: the layer that matters

Because the cost is incurred **building all N features**, reduction must happen
**before feature construction**:

- **Worker, post-adapter** (bin the `Feature[]` the RPC gets back) — too late; N
  is already built.
- **Adapter read-time** (bin inside the `getLines` lineCallback, before
  `makeIndexedSyntenyFeature`) — builds only M features; everything downstream
  scales with M. **Works on existing PIF files, no regeneration.** This is the
  recommended first step.
- **`make-pif` precomputed binned tier** — same rendered result and additionally
  cuts bytes-over-the-wire (download M not N), but a format change requiring
  users to re-run `make-pif`. Second step, only if wire-bytes on large hosted
  files prove to be the pain.

Recommended binning: fixed **absolute-genomic** grid (query-bin × target-bin),
gated on zoomed-out LOD + a per-window count cap; emit one aggregate quad per
occupied cell with mean identity. Absolute bins are window-stable and preserve
the diagonal synteny signal. This **composes with** the coarse tier (read coarse
cheaply, then bin) — coarse kills per-alignment cost, binning kills count.

Do NOT reintroduce runtime collinear chaining: a `maxGap`-heuristic
`chainCollinearAlignments` was tried and removed (unreliable, zoom-dependent).
A precomputed merge would need LIS / target-monotonicity, not a live heuristic.

A `cap + warn` floor (reuse the `RegionTooLarge` machinery) is orthogonal and
worth adding regardless — binning summarizes, the cap protects the pathological
case.

## Coarse-by-default size tradeoff

Coarse-by-default roughly doubles PIF record count. Big-CIGAR files earn it back
in CIGAR bytes saved; dense close-species files (small CIGARs) pay ~2× file size
for the tier that helps them least. Consider gating coarse emission on observed
max-CIGAR length, or documenting the tradeoff.

Related: `agent-docs/reference/REGION_TOO_LARGE.md`, `agent-docs/ARCHITECTURE.md`
("Genome-size limits").
