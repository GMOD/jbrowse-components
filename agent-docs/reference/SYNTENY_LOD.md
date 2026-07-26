---
name: synteny-lod
description: The two PIF tiers (fine/coarse), the profiled cost model, and why read-time binning is capped at ~1.5x. Read before touching make-pif, the indexed PIF adapters, or the synteny fetch RPC.
---

# Synteny level-of-detail (PIF tiers) and the density problem

Reference for the linear-comparative-view / dotplot LOD system and where its
remaining scaling limit is. Read before touching `make-pif`, the indexed PIF
adapters, or the synteny fetch RPC.

## TL;DR

- Two tiers in one tabix-indexed PIF, keyed by seqid case: fine `t`/`q` (per-row
  CIGAR), coarse `T`/`Q` (no CIGAR, split at indels `>= --coarse`).
- Coarse cuts **per-alignment** cost, not alignment **count**. It's the tool for
  few-huge-CIGARs, marginal for many-short-alignments.
- **`auto` resolves on the main thread only** (`resolveLodTier`), never in the
  adapter: the tier is a fetch input and must reach the refetch cache key.
- Coarse identity is written from `pafIdentity`, the same function the fine tier
  is read with — never recomputed from CIGAR (`M` folds in mismatches, giving
  spurious 100% identity across the LOD switch) and never a private copy of the
  fallback chain (a copy is what skipped the `id:f:` rung).
- Profiled, not guessed: ~66% of cost is fetch + parse (unavoidable at read
  time), ~34% construct + downstream. So read-time binning caps at ~1.5×.
- The only lever on the dominant cost is a **precomputed binned tier in
  `make-pif`** (fewer lines read), at the price of regenerating files.
- The visual hairball is already solved by `fillCoverage` + auto fade-thin.
  Binning would be a compute optimization, not a rendering fix.
- Don't reintroduce runtime collinear chaining; it was tried and removed.

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
`LinearSyntenyRPC/executeSyntenyFeaturesAndPositions`:

A first profile lumped fetch + parse + construct into one bucket (~78-87% at
100k-300k). A follow-up broke that bucket apart with real tabix reads (300k
rows, whole-genome one perspective), because whether read-time binning is worth
building hinges on the split — binning removes construction and everything
downstream, but it must still **read and parse every line to bin it**:

| phase                                   | 300k ms | share |
| --------------------------------------- | ------- | ----- |
| tabix fetch + decompress + line split   | 355     | 28%   |
| `parsePifLine`                          | 480     | 38%   |
| `new SyntenyFeature`                    | 217     | 17%   |
| downstream dedupe + decorate + sort     | 210     | 17%   |
| **unavoidable at read-time (fetch+parse)** | **835** | **66%** |
| **removable by binning (construct+downstream)** | **427** | **34%** |

So the earlier "the cost is building all N features" framing is wrong: only ~1/3
is feature construction + downstream. The dominant ~2/3 is **reading and parsing
N lines**, which read-time binning cannot touch. N is genuinely unbounded at
whole-genome zoom: `syntenyFetchRegions` buffers by `panBufferPx·bpPerPx`, which
at `bpPerPx≈10000` exceeds the region, collapsing the fetch window to the whole
genome. Fetch scoping does not rescue coarse zoom.

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

Note the visual hairball is already handled without binning: the
`fillCoverage` shader floor (sub-pixel ribbons fade to true proportional
coverage) and the `auto` fade-thin mode (coverage-fraction density signal). So
binning is a **compute/instance-count** optimization, not a rendering fix — weigh
it against that ~1.5× read-time ceiling before adding config + accumulation
complexity.

Recommended binning scheme (applies to whichever layer does it): fixed
**absolute-genomic** grid (query-bin × target-bin),
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
