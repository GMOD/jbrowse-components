---
name: synteny-lod
description: The two PIF tiers (fine/coarse), the profiled cost model, and why read-time binning is capped at ~1.5x. Read before touching make-pif, the indexed PIF adapters, or the synteny fetch RPC.
kind: spec
---

# Synteny level-of-detail (PIF tiers)

How the linear-comparative-view and dotplot LOD system picks a tier, and where
its scaling limit is.

## The two PIF tiers

`jbrowse make-pif` writes two tiers into one tabix-indexed PIF, told apart by a
one-letter prefix on the seqid:

- **fine** — `t<target>` / `q<query>`. Per-row CIGAR and every optional tag, one
  line per perspective per PAF row. Never split, because the fine tier draws a
  large indel as a coloured `KIND_CIGAR_D`/`_I` wedge. To split alignments, run
  `rb break-paf` upstream of `make-pif`, which keeps the tiers 1:1.
- **coarse** — `T<target>` / `Q<query>`. The same row with every non-CIGAR
  column and tag verbatim and the CIGAR replaced by its fold, a `cr:Z:` coarse
  CIGAR (`packages/cigar-utils/src/coarseCigar.ts`, ADR-104). Indels longer than
  half of `--coarse` (default 10 kb) survive as `I`/`D`/`N`; everything between
  folds into one run, written `<own>:<mate>M` when the sides differ. A run also
  closes before its folded skew passes `--coarse / 2`, so a straight line across
  a run stays within `--coarse` of the true path.

The `#pif` header (`version`, `writer`, `tiers`, `coarse`, `cigars`) lets a
reader treat a tagless coarse row as one run within the bound
(`coarseRowsAreBounded`, `PifFile.meta`), so `--coarse` must be positive. The
renderer walks `cr` where it would walk `cg` (`CIGAR_RUN`, understood by
`visitCigarRenderedSegments` and `clipSyntenyFeature`), so a kept gap draws as
the same wedge in both tiers. The alignment walks (`getAlignmentOps`) follow it
too: move-panel, follow and launch clip-to-region answer on the coarse tier, and
the follow says "approximate" only when a pinned coarse tier is zoomed finer than
its threshold. `--no-coarse` suppresses the tier. Files built before the `cr`
change split coarse rows at large indels instead and still load as plain
ribbons.

## One alignment string per row

A PIF row carries `cg:Z:` and never `cs:Z:`. `make-pif` folds a `cs` into the
CIGAR, preferring it over a co-present `cg` because `csToCigar` writes `=`/`X`
where minimap2's `cg` writes `M`.

This is an invariant: `SyntenyFeature.forEachMismatch` prefers `cs` over the
CIGAR, so a `cs` that rode through unflipped beside a flipped `cg` won and drew
every indel on the q perspective with reversed sense. Don't add a second
alignment string without a reorienter that reverses op order and
reverse-complements the spelled-out bases on the minus strand.

## Where `auto` resolves: main thread, once

`resolveLodTier` (`packages/synteny-core/src/lodTier.ts`) is the only place
`auto` becomes a tier. It must run in a display getter that feeds the fetch
cache key, and `BaseOptions.lodMode` is typed `'fine' | 'coarse'` so it cannot
drift back. A decision made adapter-side from `bpPerPx` is invisible to the key:
`bpPerPxBucketKey` is `floor(log2(bpPerPx))`, and the default 10000 threshold
sits inside bucket 13, so zooming across it changed no key and left the coarse
ribbons on screen while `dataCurrent` reported fresh.

The consumers are `LinearSyntenyDisplay.lodTier` (into `currentFetchKey`),
`DotplotDisplay.lodTier` (`dotplotFetchKey`), `LGVSyntenyDisplay.lodTier`
(`rpcProps`) and `MultiWaySyntenyDisplay`. All read the threshold with
`getCoarseBpPerPxThreshold`, which goes through the slot path, because
`adapterConfig` is a snapshot of explicitly-set keys and reads `undefined` for
tracks at the default. The slot's presence also gates the "Level of detail" menu
(`trackHasLodTiers`); `hasCoarseTier` withdraws the submenu once the file header
says there is no coarse tier (`lodMenuItems`).

The synteny and dotplot surfaces feed the min of both axes, because CIGAR detail
is worth drawing when the band is wide on either axis, so coarse is safe only
once both axes pass the threshold. The adapter side
(`plugins/comparative-adapters/src/util.ts`) is just `resolveCoarseTier`:
coarse on a file without the tier degrades to fine.

## The file has the last word

The slot cannot say whether the file has a coarse tier or the bound it was
folded at; both are facts of the file on the adapter side of the RPC. Each of
the four displays composes `LodTierInfoMixin`, and `installLodTierInfoFetch`
makes one `CoreGetInfo` call against the track's adapter, gated on
`trackHasLodTiers`. Both indexed PIF adapters answer `getHeader` with
`PifFile.info()` (the parsed `#pif` header plus `hasCoarseTier`, derived from the
`T`/`Q` seqids for a headerless file); `readLodTierInfo` narrows it into the
volatile `lodTierInfo`, which `resolveLodTier` reads beside the slot. The About
dialog shows the same object.

`effectiveCoarseThreshold` resolves as follows:

- **Info not yet landed:** trust the slot. A file built with defaults agrees
  with the slot at every zoom, so landing refetches nothing. Only a file whose
  header disagrees moves the key, once, and only if its first fetch issued
  before the info arrived.
- **`hasCoarseTier: false`:** `'fine'` under every mode, pinned `coarse`
  included. The key then never flips at a threshold the file cannot honour.
- **Header bound above the slot:** raise the threshold to the bound. Below
  `--coarse` bp/px a run's lean exceeds a pixel, so serving the fold there is
  wrong output. The clamp goes only up; a slot above the bound is a preference
  for detail.
- **Headerless two-tier file:** resolve off the slot alone.

`coarseWalkIsApproximate` compares zoom against the header's bound where there
is one and the slot otherwise, and a `--no-coarse` file never reports it.

`MultiPairwiseSyntenyAdapter` folds its children's headers: `hasCoarseTier` only
when every child has one, `coarseGap` the largest bound, plus
`anchorAssemblyName` and `assemblyNames`. One tierless child pins the whole star
to fine, since forwarding `coarse` to it would serve fine anyway and only move
the key. `MultiGenomeIndexedPAFAdapter` declares the slot too.

A failed info read is not terminal: the display resolves off the slot, and the
primary fetch raises the real error. The primary fetch is deliberately not gated
on the info, since gating costs one round trip before every first paint to avoid
one refetch for a disagreeing file.

## Identity continuity across the switch

**Nothing user-visible may key off which tier is loaded.** A menu entry gated on
`hasCigarData` appeared and vanished during zoom, which is the same failure.

A coarse row is its fine row with the CIGAR replaced, so `pafIdentity`
(`@jbrowse/cigar-utils`) reads the same bytes on both tiers and lands on the same
rung. `make-pif` must not restate the coarse row's `de:f:`; two restatements
shipped broken:

- A private copy of the chain that skipped the `id:f:` rung `pafIdentity`
  honours, so an odgi-untangle PAF coloured differently zoomed in and out.
- `blockLen === 0` wrote `de:f:0` (100% identity) where `pafIdentity` returns 0.

Never recompute divergence from the CIGAR: an M-style `cg` folds mismatches into
`M`, so a recompute reports ~0 divergence. Coordinates and `num_matches`/
`block_len` stay verbatim; nothing is apportioned.

## What the coarse tier solves

The coarse tier cuts per-alignment cost (no CIGAR bytes or parse, no indel
instances, tight bboxes), which suits few huge alignments such as liftOver
chains. It does not reduce alignment count, so for many short alignments (dense
all-vs-all pangenomes, human-vs-mouse) the bottleneck stays N.

Read-time binning is declined: reading and parsing N lines is ~66% of the fetch (construction and everything after is ~34%)
and is upstream of anything an adapter could bin, so binning is capped near 1.5x.
ADR-039 holds the profile and the decision. Don't reintroduce runtime collinear
chaining (a `maxGap` heuristic, removed as unreliable and zoom-dependent); a
precomputed merge would need LIS / target-monotonicity. A precomputed binned tier
in `make-pif` is the only option that cuts the dominant read cost, and it needs a
format change.

The `parsePAFLine` offset walk and the no-spread feature builders carry the
measured speedups below.

<!-- BEGIN GENERATED MEASUREMENT paf-line-read-path -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one row parsed and built   |  rows | tab offsets | offsets + no spread |    control |
| -------------------------- | ----: | ----------: | ------------------: | ---------: |
| minimap2 PAF, 10 tags      | 1,000 |  1.10-1.20x |          1.62-1.78x | 0.98-1.02x |
| fine PIF tier, ~1.8kB rows | 4,000 |  1.15-1.41x |      **1.60-2.19x** | 0.99-1.05x |
| coarse PIF tier, no CIGAR  | 4,000 |  1.11-1.58x |      **1.55-2.34x** | 0.99-1.05x |

<!-- END GENERATED MEASUREMENT paf-line-read-path -->

## Coarse-by-default and what it costs

Coarse-by-default roughly doubles PIF record count. A coarse row keeps every
optional tag and drops only the CIGAR, so the tier's value is
`coarse_bytes / fine_bytes`, a function of CIGAR weight per row. The crossover is
around 30-50 kb blocks, where CIGAR bytes start to exceed the rest of the row.
At small blocks `auto` gives up the indel wedges to read ~11% fewer bytes, a bad
trade in fidelity.

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

That table is about disk. What the tier saves a reader, on one hosted file at
whole-genome zoom, is the wire-bytes table. The coarse tier returns rows that are
far smaller, not far fewer; the difference is the CIGAR.

<!-- BEGIN GENERATED MEASUREMENT pif-tier-wire-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one whole-genome pass, hs1 vs mm39 | bytes over the wire | rows returned | range requests | bytes/row |
| ---------------------------------- | ------------------: | ------------: | -------------: | --------: |
| coarse (no CIGAR)                  |         **1.31 MB** |        43,839 |              6 |        30 |
| fine (per-row CIGAR)               |            64.23 MB |        75,076 |             22 |       856 |

<!-- END GENERATED MEASUREMENT pif-tier-wire-bytes -->

hs1 vs mm39 is a liftOver chain converted with `chain2paf` and `make-pif`. The
chain is a source format, not the adapter: the resulting PIF loads through
`PairwiseIndexedPAFAdapter`, which declares `coarseBpPerPxThreshold`.

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-fold-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| coarse tier of hs1 vs mm39, one perspective |   rows | uncompressed |        gzip | rows with cr | fold share of bytes |
| ------------------------------------------- | -----: | -----------: | ----------: | -----------: | ------------------: |
| split pieces, no CIGAR (before 2026-09-02)  | 75,738 |      7.24 MB |     2.01 MB |            0 |                  0% |
| coarse CIGAR (cr:Z:)                        | 75,076 |      9.79 MB | **3.41 MB** |        5,047 |                 26% |

<!-- END GENERATED MEASUREMENT pif-coarse-fold-bytes -->

Two thirds of the fold's bytes are the 5-10 kb indels the half-gap rule keeps,
which are sub-pixel at the threshold and the price of the interpolation bound.

Two levers, neither built:

- **Slim the coarse row.** Most of a small-block coarse row is minimap2 chaining
  internals (`ms AS nn cm s1 s2 rl zd`) that no zoomed-out ribbon reads. The
  passthrough in `pif-generator.ts` is deliberate: it keeps coarse feature detail
  matching the fine tier.
- **Decline the switch when it doesn't pay.** `make-pif` would write the ratio
  into the `#pif` header and `resolveLodTier` would read one more field, through
  the existing `CoreGetInfo` channel.

Related: [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md), `agent-docs/ARCHITECTURE.md`
("Genome-size limits"). The open follow zoom-flip is in
[one-zoomed-row-forces-a-genome-wide-fine-fetch](../ideas/waiting-on-a-number/one-zoomed-row-forces-a-genome-wide-fine-fetch.md).
