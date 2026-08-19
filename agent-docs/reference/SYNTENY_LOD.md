---
name: synteny-lod
description: The two PIF tiers (fine/coarse), the profiled cost model, and why read-time binning is capped at ~1.5x. Read before touching make-pif, the indexed PIF adapters, or the synteny fetch RPC.
---

# Synteny level-of-detail (PIF tiers) and the density problem

The linear-comparative-view / dotplot LOD system, and where its remaining scaling
limit is.

## The two PIF tiers

`jbrowse make-pif` writes two tiers into one tabix-indexed PIF, distinguished by
a one-letter prefix on the seqid (tabix column 1):

- **fine** — `t<target>` / `q<query>` (lowercase). Per-row CIGAR, and every
  optional tag the PAF carried. One `t` line and one `q` line per PAF row (the
  two indexed perspectives). Never split: the fine tier draws a large indel as a
  colored `KIND_CIGAR_D`/`_I` wedge, which is the whole reason it exists. To
  split the alignments themselves, `rb break-paf` upstream of `make-pif` — that
  splits both tiers, keeping them 1:1.
- **coarse** — `T<target>` / `Q<query>` (uppercase). No CIGAR/`cs`, every other
  tag passed through. Each row is split wherever a CIGAR indel is `>= --coarse`
  (default 10 kb) so each coarse piece's bounding box stays tight and its
  straight ribbon is accurate. Emitted by default; suppress with `--no-coarse`
  (which is now an error alongside an explicit `--coarse`).

## One alignment string per row

A PIF row carries `cg:Z:` and never `cs:Z:`. `make-pif` folds a `cs` into the
CIGAR (and prefers it over a co-present `cg`, since `csToCigar` writes `=`/`X`
where minimap2's own `cg` writes `M`).

This is an invariant, not a simplification: `SyntenyFeature.forEachMismatch`
**prefers `cs` over the CIGAR**, so a `cs` that rode through unflipped beside a
flipped `cg` did not merely go stale — it won, and the q perspective drew every
indel with reversed sense. That shipped for rows from `minimap2 -c --cs`, which
emits both tags. Don't reintroduce a second alignment string without a
reorienter for it (which means reversing op order *and* reverse-complementing
the spelled-out bases on the minus strand).

## Where `auto` resolves — main thread, once

`resolveLodTier` (`packages/synteny-core/src/lodTier.ts`) is the only place
`auto` becomes a tier. It **must** run in a display getter that feeds the fetch
cache key, and the adapter option (`BaseOptions.lodMode`) is typed
`'fine' | 'coarse'` so it cannot drift back.

This was a real bug: `LinearSyntenyDisplay` keys refetches on
`bpPerPxBucketKey` = `floor(log2(bpPerPx))`, and the default 10000 threshold sits
*inside* bucket 13 (`[8192, 16384)`). With the decision made adapter-side from
`bpPerPx`, zooming across the threshold within one bucket changed nothing the key
could see — the view kept the coarse tier's gap-free ribbons below the threshold
and `dataCurrent` reported fresh. `fetchRegionsKey` doesn't rescue it either: at
that zoom `syntenyFetchRegions` clamps to the whole displayed region, so it is
identical across the band.

Consumers: `LinearSyntenyDisplay.lodTier` → `currentFetchKey`,
`DotplotDisplay.lodTier` → `dotplotFetchKey`, `LGVSyntenyDisplay.lodTier` →
`rpcProps`. All three read the threshold with `getCoarseBpPerPxThreshold`, which
goes through the **slot path** — `adapterConfig` is a snapshot carrying only
explicitly-set keys, so it reads `undefined` for the ~all tracks at the default
and the tier was never resolved. The presence of that slot is also the single
gate for the "Level of detail" menu (`trackHasLodTiers`); the old `'lod'`
`adapterCapabilities` string was a second signal that could disagree with it and
is gone.

The two synteny/dotplot surfaces feed `min` of both axes, because CIGAR detail is
worth drawing when the band is wide on either axis (`MIN_CIGAR_PX_WIDTH` uses
`max(widthPx0, widthPx1)`), so dropping to coarse is only safe once both axes are
past the threshold.

Adapter side (`plugins/comparative-adapters/src/util.ts`) is now just
`resolveCoarseTier({ hasCoarseTier, lodMode })` = `hasCoarseTier && lodMode ===
'coarse'`. A request for coarse on a file without the tier degrades to fine
rather than querying `T`/`Q` prefixes that match nothing.

## Identity continuity across the switch

**Nothing user-visible may key off which tier is loaded.** Identity is the case
with the most ways to get it wrong, and the rest of this section is those; but
the rule is general, and the other place it was broken was a menu. The CIGAR
entry gated itself on `hasCigarData`, so it appeared and disappeared as the user
zoomed — a control coming and going under a gesture that is supposed to be an
implementation detail.

A coarse row's `de:f:` is written as `1 - pafIdentity(row)` using
**`pafIdentity` itself** (`@jbrowse/cigar-utils`), the same function the adapters
read the fine tier with, so the two tiers cannot disagree. When the row's own
`de:f:` is what that chain lands on, the string is copied byte-for-byte rather
than reformatted, so a 7-decimal tag isn't truncated by `toFixed(6)`.

Two traps this replaced, both of which shipped:

- A private copy of the chain in `make-pif` that went `de:f:` →
  `num_matches/block_len`, **skipping the `id:f:` rung** `pafIdentity` honors. An
  odgi-untangle PAF therefore colored off `id` when zoomed in and off
  `num_matches/block_len` when zoomed out.
- `blockLen === 0` wrote `de:f:0` (100% identity) while `pafIdentity` returns 0
  (0% identity).

Never recompute divergence from the CIGAR: a `cg` (M-style) CIGAR folds
mismatches into `M`, so a recompute reports ~0 divergence for a divergent
alignment.

Split pieces get the row's `num_matches`/`block_len` **apportioned by aligned
length**, so each piece implies exactly the row's identity (agreeing with the
`de:f:` beside it) and the pieces sum back to the row. `splitCigarOnLargeGaps`
therefore does not count residue matches at all — counting `M` as a match was
inflating them. A row that doesn't split keeps its PAF coordinate/count columns
verbatim rather than the walk's reconstruction of them.

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
`LinearSyntenyRPC/executeSyntenyFeaturesAndPositions`. Whether read-time binning
is worth building hinges on where the split falls — binning removes construction
and everything downstream, but must still **read and parse every line to bin
it**:

| phase                                   | 300k ms | share |
| --------------------------------------- | ------- | ----- |
| tabix fetch + decompress + line split   | 355     | 28%   |
| `parsePifLine`                          | 480     | 38%   |
| `new SyntenyFeature`                    | 217     | 17%   |
| downstream dedupe + decorate + sort     | 210     | 17%   |
| **unavoidable at read-time (fetch+parse)** | **835** | **66%** |
| **removable by binning (construct+downstream)** | **427** | **34%** |

So "the cost is building all N features" is wrong: only ~1/3 is construction plus
downstream. The dominant ~2/3 is **reading and parsing N lines**, which read-time
binning cannot touch. N is genuinely unbounded at whole-genome zoom:
`syntenyFetchRegions` buffers by `panBufferPx·bpPerPx`, which at `bpPerPx≈10000`
exceeds the region and collapses the fetch window to the whole genome. Fetch
scoping does not rescue coarse zoom.

To reproduce: build a PIF of N short alignments (fine tier `t`/`q` lines, one
indel CIGAR each), `sort -k1,1 -k3,3n | bgzip` + `tabix -s1 -b3 -e4 -0`, open a
`TabixIndexedFile`, and `getLines` per contig over the whole genome three times
with a noop / `parsePifLine` / `parsePifLine`+`makeIndexedSyntenyFeature`
callback, then time dedupe + decorate + sort on the result.

## Density: the layer that matters

Two things reduce cost, at different ceilings:

- **Adapter read-time binning** (bin inside the `getLines` lineCallback, before
  `makeIndexedSyntenyFeature`) — builds only M features; everything from
  construction onward (including projection + `buildSyntenyGeometry` + GPU
  instances, not just the phases timed above) scales with M. **Works on existing
  PIF files, no regeneration.** But it still reads + parses all N lines, so the
  measured compute ceiling is ~1.5× (the removable 34%). Its real payoff is the
  GPU-instance collapse at whole-genome zoom, and even that is now largely
  covered by the shipped visual-density mechanisms (see below).
- **`make-pif` precomputed binned tier** — reads M lines instead of N, so it is
  the **only** option that cuts the dominant fetch + parse cost, and it also cuts
  bytes-over-the-wire. This is the higher-leverage change for the dense
  "many short alignments" whole-genome regime. Cost: a format change requiring
  users to re-run `make-pif`.
- **Worker, post-adapter** (bin the `Feature[]` the RPC gets back) — too late; N
  is already read, parsed, and built. Not worth it.

The visual hairball is already handled without binning: the `fillCoverage` shader
floor and the `auto` fade-thin mode. So binning is a **compute/instance-count**
optimization, not a rendering fix — weigh it against that ~1.5× read-time ceiling
before adding config and accumulation complexity.

Recommended scheme, for whichever layer does it: a fixed **absolute-genomic**
grid (query-bin × target-bin), gated on zoomed-out LOD plus a per-window count
cap, emitting one aggregate quad per occupied cell with mean identity. Absolute
bins are window-stable and preserve the diagonal synteny signal. It **composes
with** the coarse tier — coarse kills per-alignment cost, binning kills count.

Do NOT reintroduce runtime collinear chaining: a `maxGap`-heuristic
`chainCollinearAlignments` was tried and removed (unreliable, zoom-dependent).
A precomputed merge would need LIS / target-monotonicity, not a live heuristic.

A `cap + warn` floor (reuse the `RegionTooLarge` machinery) is orthogonal and
worth adding regardless — binning summarizes, the cap protects the pathological
case.

## Coarse-by-default: measured, and it does not always pay

Coarse-by-default doubles PIF record count. Whether that buys anything is
entirely a function of **CIGAR weight per row**, because a coarse row passes
through every optional tag and drops only the CIGAR. So the tier's value is
`coarse_bytes / fine_bytes` at the zoom it is served:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-tier-bytes -->

| block len | CIGAR bytes/row | coarse/fine bytes | file vs `--no-coarse` |
| --------- | --------------- | ----------------- | --------------------- |
| 1.5 kb    | 12              | **0.89**          | 1.89x                 |
| 10 kb     | 72              | 0.66              | 1.66x                 |
| 50 kb     | 360             | 0.30              | 1.30x                 |
| 200 kb    | 1.4 K           | 0.10              | 1.10x                 |
| 5 Mb      | 36 K            | **0.005**         | 1.00x                 |

<!-- END GENERATED MEASUREMENT pif-coarse-tier-bytes -->

That table is about **disk**: what the tier costs the file, per block length.
What it saves a *reader* is a different number, taken on one hosted file at
whole-genome zoom rather than across synthetic block lengths:

<!-- BEGIN GENERATED MEASUREMENT pif-tier-wire-bytes -->

| one whole-genome pass, hs1 vs mm39 | bytes over the wire | rows returned | range requests | bytes/row |
| ---------------------------------- | ------------------: | ------------: | -------------: | --------: |
| coarse (no CIGAR)                  |         **1.31 MB** |        43,839 |              6 |        30 |
| fine (per-row CIGAR)               |            64.23 MB |        75,076 |             22 |       856 |

<!-- END GENERATED MEASUREMENT pif-tier-wire-bytes -->

Both arms fetch every row of their own tier, so this is the whole file, and the
two tiers are the same file's — nothing here is a `--no-coarse` build. The
`bytes/row` column is the point: the coarse tier does not return far fewer rows,
it returns rows that are far smaller, and the difference between the two is the
CIGAR.

hs1 vs mm39 is a liftOver chain converted with `chain2paf` and then `make-pif`,
which is worth saying because it has been written off as impossible: **the chain
is a source format, not the adapter**. Once it is a PIF it loads through
`PairwiseIndexedPAFAdapter`, which declares `coarseBpPerPxThreshold` — that
`ChainAdapter` has no tiering slot says nothing about a chain-derived PIF, and
HOSTING.md has recorded this file as two-tier since 2026-08-02.

Back to the disk table: at the top of it `auto` gives up the indel wedges to read
11% fewer bytes — a bad trade in *fidelity*, independent of whether the file size is
affordable. At the bottom the tier is free and cuts the read by 200×. The
crossover is around 30–50 kb blocks, i.e. where CIGAR bytes start to exceed the
rest of the row (~150 bytes of tags + columns).

Two levers, neither built:

- **Slim the coarse row.** Most of a small-block coarse row is minimap2 chaining
  internals (`ms AS nn cm s1 s2 rl zd`) that no zoomed-out ribbon reads. Keeping
  only coords/strand/matches/blocklen/mapq/identity takes the 1.5 kb row to
  ~0.35. Costs: a coarse ribbon's feature detail no longer matches the fine
  tier's, which was a deliberate choice (see the passthrough comment in
  `pif-generator.ts`).
- **Decline the switch when it doesn't pay.** Needs the ratio to reach
  `resolveLodTier`, which is main-thread — so it needs the file to state it, or
  the adapter to report it the way `LinearHicDisplay` reports its binsize list
  (one-shot RPC in `afterAttach` → model state → render decisions).

To reproduce: emit N PAF rows of a fixed block length with a CIGAR of
proportional op count, run `createPIF` with `coarseSplitGap: 10000`, and sum
line lengths partitioned on `T`/`Q` vs `t`/`q` in the first column.

Related: `agent-docs/reference/REGION_TOO_LARGE.md`, `agent-docs/ARCHITECTURE.md`
("Genome-size limits").
