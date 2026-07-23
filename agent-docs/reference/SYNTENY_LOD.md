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
- Coarse identity must reuse the fine `de:f:` tag, never recompute from CIGAR —
  `M` folds in mismatches, giving spurious 100% identity across the LOD switch.
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
