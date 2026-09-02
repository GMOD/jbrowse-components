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
- **coarse** — `T<target>` / `Q<query>` (uppercase). One row per PAF row, the
  columns and every non-alignment tag verbatim. The CIGAR is replaced by its
  fold, a `cr:Z:` **coarse CIGAR** (`packages/cigar-utils/src/coarseCigar.ts`,
  ADR-104): indels longer than half of `--coarse` (default 10 kb) kept as
  `I`/`D`/`N`, everything between them one run, written `<own>:<mate>M` when the two sides differ. A run also closes before its folded skew passes `--coarse / 2`, so a straight
  line across a run is within `--coarse` of the true path. A fold that is a
  single run carries no tag; the file's `#pif` header (`version`, `tiers`,
  `coarse` = the bound, `cigars` = all/some/none) is what lets a reader treat a
  tagless coarse row as one run within the bound (`coarseRowsAreBounded`,
  `PifFile.meta`), and `--coarse` must be positive so that reading always holds. The renderer walks `cr` where it would walk `cg` — `CIGAR_RUN`,
  a two-word packed op that `visitCigarRenderedSegments` and `clipSyntenyFeature`
  understand — so a kept gap draws as the same colored wedge in both tiers and
  nothing visible changes at the switch. The walks follow it too
  (`getAlignmentOps`): move-panel, the follow and the launch's clip-to-region
  all answer on the coarse tier, and the follow says "approximate" only when a
  pinned coarse tier is zoomed finer than its threshold. Emitted by default;
  suppress with
  `--no-coarse` (an error alongside an explicit `--coarse`). **Files built before
  2026-09-02 have no `cr`**: their coarse rows were split into pieces at large
  indels instead, and they still load and draw as plain ribbons.

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

## The file has the last word

The slot alone cannot say whether the file HAS a coarse tier or what bound it
was folded at; both are facts of the file, on the adapter side of the RPC. So
each of the three displays composes `LodTierInfoMixin` and, in `afterAttach`,
`installLodTierInfoFetch` makes one `CoreGetInfo` call against the track's
adapter (the `LinearHicDisplay` binsize pattern: a prerequisite read keyed on
the adapter config, gated on `trackHasLodTiers` so a PAFAdapter never asks).
Both indexed PIF adapters answer `getHeader` with `PifFile.info()` — the parsed
`#pif` header plus `hasCoarseTier`, which for a headerless file comes from the
`T`/`Q` seqids — and `readLodTierInfo` narrows it to `LodTierInfo` on the main
thread; the volatile `lodTierInfo` is what `resolveLodTier` reads beside the
slot. The same object is what the About dialog's file-info panel shows for a
PIF track.

The resolution rule, in `effectiveCoarseThreshold`:

- **info not yet landed** → the slot is trusted as-is. This is deliberate: the
  first fetch may already be keyed when the answer arrives, and for a file
  built with the defaults (`--coarse 10000` against the 10,000 slot) the two
  answers agree at every zoom, so the landing changes no key and refetches
  nothing. Only a file whose header disagrees with the slot moves the key, once,
  and only if its first fetch was issued before the info arrived (the info read
  has no debounce; the fetches have 500-1000 ms).
- **`hasCoarseTier: false`** → `'fine'` under every mode, pinned `coarse`
  included. That is the tier the adapter serves for it, and it is what closed
  the single-tier refetch: the key no longer flips at a threshold the file
  cannot honour, so identical bytes are no longer refetched at every crossing.
- **the header states a bound above the slot** → the threshold is raised to the
  bound. Below `--coarse` bp/px a run's lean is wider than a pixel, so serving
  the fold there is wrong output rather than slow output, which is why the
  clamp goes up and never down: a slot above the bound is a preference for
  detail and stands.
- **a headerless two-tier file** (built before 2026-09-02) states no bound and
  is resolved off the slot alone.

`coarseWalkIsApproximate` (the follow's and move-panel's "approximate" wording)
reads the served tier and compares the zoom against the header's bound where
there is one, the slot otherwise — so a slot raised above the bound does not
widen what counts as approximate, and a `--no-coarse` file never reports it.

A failed info read is not terminal: the display goes on resolving off the slot,
which is what it did before the header existed, and the primary fetch on the
same file raises the real error. It is logged with `console.warn` and nothing
else.

Not done, and the residual the design accepts: the primary fetch is not gated on
the info (HiC's `awaitingPrerequisite` shape). Gating would remove the one
possible refetch at landing for a disagreeing file at the cost of one round
trip before every first paint, on every file, including the agreeing majority.

## Identity continuity across the switch

**Nothing user-visible may key off which tier is loaded.** Identity is the case
with the most ways to get it wrong, and the rest of this section is those; but
the rule is general, and the other place it was broken was a menu. The CIGAR
entry gated itself on `hasCigarData`, so it appeared and disappeared as the user
zoomed — a control coming and going under a gesture that is supposed to be an
implementation detail.

A coarse row is its fine row with the CIGAR replaced by the fold and every
other column and tag verbatim, so `pafIdentity` (`@jbrowse/cigar-utils`) reads
the same bytes on both tiers and lands on the same rung. `make-pif` used to
restate the coarse row's `de:f:` from that chain instead, which is where the
two traps below lived, and a restatement rounded through `toFixed(6)` was a
third on the rows the chain resolves from `id:f:` or `num_matches/block_len`,
which the fine tier reads unrounded.

The two that shipped:

- A private copy of the chain in `make-pif` that went `de:f:` →
  `num_matches/block_len`, **skipping the `id:f:` rung** `pafIdentity` honors. An
  odgi-untangle PAF therefore colored off `id` when zoomed in and off
  `num_matches/block_len` when zoomed out.
- `blockLen === 0` wrote `de:f:0` (100% identity) while `pafIdentity` returns 0
  (0% identity).

Never recompute divergence from the CIGAR: a `cg` (M-style) CIGAR folds
mismatches into `M`, so a recompute reports ~0 divergence for a divergent
alignment.

A coarse row keeps the row's `num_matches`/`block_len` and coordinate columns
verbatim — it is the same row — so nothing is apportioned or reconstructed. The
old split tier had to apportion the counts across its pieces, and the detail
panel showed those invented numbers on a coarse click.

## What the coarse tier does and does NOT solve

The coarse tier cuts **per-alignment** cost (no CIGAR bytes/parse, no pass-2
indel instances, tight bboxes). It is the right tool for the "few huge
alignments with megabase CIGARs" regime (liftOver chains, distant-species
synteny).

It does **not** reduce alignment **count** — the coarse tier has exactly the
fine tier's rows. So for the "many short alignments" regime (dense all-vs-all
pangenomes, human-vs-mouse whole genome) it is only marginal. The bottleneck
there is N.

## Verified in a browser on hs1 vs mm39, 2026-09-02

The hosted PIF was inverted to PAF and rebuilt with the current writer, then
driven against the dev server with pixel diffs (throwaway puppeteer scripts of
the `scripts/verify-hs1-mm39-dotplot.mjs` kind; the captures were not kept).
Whole genome under `auto` and under pinned fine differ by 19 of 794,000 band
pixels. A 240 kb insertion in the chr1 block draws as the same 22 px wedge under
auto, pinned fine and pinned coarse at 10 kb/px, and is a white seam on the old
hosted file. At 1 kb/px under pinned coarse the wedge and the ribbon edges match
the fine tier to the pixel and only sub-5 kb stripes are absent. The move-panel
items appear on the coarse tier and land within the fold bound of the fine
walk. No console errors. Two things it surfaced: `auto` resolves off the min of
both rows, so a follow that zooms one row past the threshold flips the tier
([ideas/two-fine-tier-fetches-the-fold-could-avoid.md](../ideas/two-fine-tier-fetches-the-fold-could-avoid.md)),
and the follow tooltip's "approximate" now names both of its causes, a window
wider than one alignment being the usual one.

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

### Both of its middle rows moved in 2026-08-20, and the shares above did not

The percentages above are still the ones to reason about binning with — see the
caveat at the end of this section — but the two phases they measure are no longer
the code that was profiled. Both got faster, on real hs1-vs-mm39 rows rather than
the synthetic PIF above:

<!-- BEGIN GENERATED MEASUREMENT paf-line-read-path -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one row parsed and built   |  rows | tab offsets | offsets + no spread |    control |
| -------------------------- | ----: | ----------: | ------------------: | ---------: |
| minimap2 PAF, 10 tags      | 1,000 |  1.10-1.20x |          1.62-1.78x | 0.98-1.02x |
| fine PIF tier, ~1.8kB rows | 4,000 |  1.15-1.41x |      **1.60-2.19x** | 0.99-1.05x |
| coarse PIF tier, no CIGAR  | 4,000 |  1.11-1.58x |      **1.55-2.34x** | 0.99-1.05x |

<!-- END GENERATED MEASUREMENT paf-line-read-path -->

`parsePAFLine` — which every PIF row goes through, since `parsePifLine` only
renames its fields — walks tab offsets instead of `line.split('\t')`. On a fine
row the split was scanning and re-wrapping ~1.7kB of CIGAR to read twelve short
fields off the front of it. And both feature builders stopped spreading `...rest`
into the middle of their data-object literal, which denied V8 a static hidden
class and made every field after the spread a dynamic add, once per feature.

**The `new SyntenyFeature` row was the larger of the two, which contradicts the
17% the table gives it.** The two profiles disagree because they are different
files — the synthetic rows above carry one short indel CIGAR each, where a real
fine row carries 1.8kB of one — so neither share is wrong, and the ranking is
what a reader should carry away rather than either number.

**Binning's ceiling did not improve.** Deflating the two rows by what they
measured leaves the removable fraction at 27-34% against the 34% above, i.e. the
~1.5x cap in the next section stands, or tightens slightly. That is the direction
worth noticing: making the unavoidable half cheaper is what ADR-039 argued for,
and it does not make the removable half worth more.

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

_Generated by `pnpm autogen` — edit the source, not this block._

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

_Generated by `pnpm autogen` — edit the source, not this block._

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

What the fold costs on that same file, measured on 2026-09-02 by inverting the
hosted PIF back to PAF and rebuilding it with the current writer:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-fold-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| coarse tier of hs1 vs mm39, one perspective |   rows | uncompressed |        gzip | rows with cr | fold share of bytes |
| ------------------------------------------- | -----: | -----------: | ----------: | -----------: | ------------------: |
| split pieces, no CIGAR (before 2026-09-02)  | 75,738 |      7.24 MB |     2.01 MB |            0 |                  0% |
| coarse CIGAR (cr:Z:)                        | 75,076 |      9.79 MB | **3.41 MB** |        5,047 |                 26% |

<!-- END GENERATED MEASUREMENT pif-coarse-fold-bytes -->

Every fold closed on its columns; 6.7% of rows carry one; two thirds of the
fold's bytes are the 5-10 kb indels the half-gap rule keeps, which are
sub-pixel at the threshold and are the price of the interpolation bound. The
largest fold is a single 90 Mb chr4 chain at 9,038 ops and 72 kB. The record's
notes carry the census.

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
  `resolveLodTier`, which is main-thread. The channel now exists — the
  `CoreGetInfo` read behind `LodTierInfoMixin` (§"The file has the last word")
  carries whatever `PifFile.info()` returns — so this is now `make-pif` writing
  the ratio into the `#pif` header and the resolver reading one more field.

To reproduce: emit N PAF rows of a fixed block length with a CIGAR of
proportional op count, run `createPIF` with a 10000 bp coarse gap, and sum
line lengths partitioned on `T`/`Q` vs `t`/`q` in the first column.

Related: `agent-docs/reference/REGION_TOO_LARGE.md`, `agent-docs/ARCHITECTURE.md`
("Genome-size limits").
