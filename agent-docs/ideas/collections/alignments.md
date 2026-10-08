---
name: alignments
description: Pileup and coverage-band ideas — a read-count floor for the low-frequency threshold, strand-split allele bars, variant-to-variant navigation, a bedGraph export, read downsampling for a force-loaded region, whether per-record allocation is the CRAM lever, why lifting MAX_GROUPS needs a binned depth sweep, interning readTagValues, and the RNA-seq splice follow-ups (splice-chain group-by, differential transcript usage, sashimi labels as a fraction).
---

# Alignments

**A count floor, not a depth ramp, for `featureFrequencyThreshold`.** The ramp's
SHAPE is the problem, not its scale. A 50% allele
first clears the ramp at **22x** (0.8 under 10x, linear to 0.3 at 30x), so below
that a heterozygote's pileup marks are zeroed and fade to `pxPerBp` when zoomed
out. What separates a sequencing error from a het at low depth is the read
COUNT, not the fraction — one read at 6x is 17% and three reads is 50%, and only
the count tells them apart.

`≥ 2 supporting reads AND ≥ 25% of depth` suppresses every error case the ramp
does (a singleton at 500x is 0.2%, a singleton at 6x fails the count) while
keeping hets at every depth. It is also the shape the indicator triangles
already use — a depth floor plus a flat fraction — so the pileup ramp is the
outlier of the three rules in DEEP_COVERAGE.md rather than the convention.

The fade then double-counts what is left: the number of rows painting a mark AT
a position IS the supporting-read count, so allele fraction is already in the
picture linearly, and `frequencyAlpha` multiplies alpha by that same fraction
again. Total ink goes as count²/depth — at 40x a hom column measures 40.0 and a
het 10.1, a 4x gap from a 2x difference in support. Making the alpha a step on
the already-thresholded byte rather than a lerp on it is the other half.

Undecided: whether this is a default change or a setting. It moves what every
alignments track shows at zoom-out, so it wants a measurement against the
real-read fixtures and a golden refresh, and the escape hatch
(`fadeLowFreqMismatches`) already exists to keep the old behaviour reachable.

**Auto-detect when to use first-of-pair strand.** The precedents are both in
hand: sashimi already picks its own settings, and `geneGlyphMode`'s `auto` is the
shape of the affordance — a token in the bottom-right of the display saying which
way it resolved, so the automatic choice is visible and overridable rather than
silent. What is undecided is the detection itself: what in the data says a
library is stranded first-of-pair, and how wrong the guess can be before it is
worse than the current explicit setting.

**Strand-split allele bars in the coverage band.** `mismatchStrands` already
ships and `countSnpsAtPosition` already reads it — the tooltip's Strands column
is built from it — so splitting each colored segment fwd/rev, or flagging an
allele whose strand ratio is extreme, is a compute-side change with no new
payload. Strand bias is one of the two things a reviewer checks a candidate SNV
for, and the band is where they are looking when they check it. What is
undecided is the encoding: two half-width segments per allele doubles the
instance count and gets sub-pixel fast, whereas a bias FLAG (a mark on the
position, the allele still drawn whole) costs one bit and says the same thing at
every zoom. Decide that before writing either. Note the segments are already
stacked bottom-to-top by lane, so a split has to pick a second axis.

**Jump to the next significant variant.** `findSignificantInBin` (alignments-core)
already answers "is there a real SNP in this bp range" against the local depth —
it exists for the hover tooltip at wide bpPerPx — so wiring it to a menu item and
a keyboard shortcut gives variant-to-variant navigation off data already on the
main thread. Its threshold is the caller's, so this should read the same
`coverageSnpMinFrequency` the band's colors now do rather than inventing a
second notion of significant. Bounded by the fetched region, which is the honest
limit and worth saying in the UI: "next in view", not "next in the genome".

**Export the coverage band's data.** `coverageDepths` is per-bp on the main
thread at every zoom, and the packed SNP buffer beside it decodes through
`readSnpSegments`. A bedGraph/wig (depth) or VCF-ish (allele counts) download
from the Coverage submenu is a small addition and a frequent ask. The precedent
for the plumbing is `SaveTrackData.tsx` and the highlight list's
`downloadHighlightFile`. The open question is scope: the visible region is what
the user is looking at and what the display actually holds, but "export this
track" reads as the whole file — say which one the menu item means in its label.

**Typed-array refactor.** Worker return is flat parallel arrays — could regroup into
sub-objects (mods, sashimi, coverage). Flat is simple but long; just an idea.

**Per-record allocation may be the CRAM lever.** The slice workers are starved
and the RPC worker spends 12% (724 ms) in GC on a 1000x short-read render
([CRAM_STACK_INTEGRATION.md](../../reference/CRAM_STACK_INTEGRATION.md)
§"Slice-decode parallelism is not the lever"). The hypothesis it is consistent with — *not* a measured finding, and it
needs an allocation profile before anyone acts on it — is that we allocate one
`CramSlightlyLazyFeature` per record (153,677 of them for that fixture) and then
serialize the lot out of the worker. That is the same problem `@gmod/cram`
already solved *inside* itself with the read-feature arena and the tag/quality
columns, stopping one layer short of us. If it holds, the fix is columnar all
the way to the renderer rather than a wrapper per read, which is the same
direction as the typed-array item above.

**Read downsampling for a force-loaded dense region.** The wide-zoom half of
large-region viewing landed as the density tier (`bf66d4cbdf`,
[reference/REGION_TOO_LARGE.md](../../reference/REGION_TOO_LARGE.md)): a
coverage sidecar draws where the byte gate refuses. What is left is a user who
force-loads anyway. The pileup uploads one GPU instance per read, per mismatch
and per gap, and `executeRenderAlignmentData` has no per-column cap — a 30×
whole-chromosome BAM is ~29 M reads, over 1 GiB in the read pass alone, with the
GPU-OOM overlay as the backstop. Capping reads per column (reservoir-sampled per
bin) is what would make force-load survivable.

A BAM with no sidecar has two more paths open. A coverage-only mode above a zoom
threshold would skip the pileup and mismatch passes; `showPileup` hides the
pileup on the main thread and never reaches the RPC, so the reads are fetched
either way. And the byte gate would have to let that coverage-only fetch through,
since it refuses on the reads' bytes.

**Lifting `MAX_GROUPS` needs the depth sweep binned, not merely coalesced.** The
cap and everything hanging off it — `capGroups`, `OVERFLOW_GROUP_KEY`,
`groupKeyRank`'s three-way rank, GroupByDialog's cardinality refusal, and the
"keep every dimension a closed set" rule — exist for one stated reason: each group
runs the whole worker spine, and its coverage pipeline allocates per-bp depth
arrays sized to the REGION. So the tempting move is "one lane×bp buffer instead of
40 separate ones, and the cap can rise or vanish".

Measured against the code, the coalescing alone buys nothing that matters.
`sweepDepths` (alignments-core `coverageCompute.ts`) allocates `numBins = end -
start` — a Float32Array per lane, times three when `trackStrands` is on (the
default with the band). One lane×bp buffer of 40 lanes is the same byte total:
40 × 3 × 4 × regionWidth, or 48 MB over a 100 kb window. Fewer allocations and
one upload, not less memory.

The GPU half of the reason is already solved and worth not re-solving: the packed
coverage buffer is downsampled to a fixed bin cap, so `coverageGpuBinCount` tracks
screen pixels rather than region width (that is why chromosome-scale grouping
doesn't overflow the device limit today).

So the real prerequisite for a higher cap is a per-lane depth representation that
is not region-width — the same downsampling the GPU buffer already uses, applied
to the sweep the hit test and the stats read. Do that first and the cap becomes a
policy number instead of a memory ceiling; coalesce the buffers after, if the
allocation count still shows up. Roughly 150 lines of ceiling machinery come out
only at the end of that, and `MAX_GROUPS = 40` is still worth keeping as a
cardinality sanity check on `tag`, which is the one dimension the data decides.

**Intern `readTagValues` the way `readNextRefs` was interned.** Both CPU-baked
color schemes (`tag`, `mateRefName`) ship `readTagValues: string[]` — one string
per read across the RPC boundary — and it is the shape this plugin has already
measured and deleted once, one field over. `shared/readNextRefs.ts` records the
number for the identical array: **153,677 strings holding one distinct value,
16.5 ms to build and 8.0 ms to structured-clone, against 8.8 ms for a
slots-plus-table**, i.e. 2.8x, with a bench at `benches/readNextRefs.bench.ts`.
The tag case has the same distribution — HP carries two or three values over a
whole pileup, RG a handful, a mate reference usually one.

The shape is `readNextRefs`': a transferable `Int32Array` of slots plus a table
of distinct values, read through an accessor. `presentTagValues` (the legend's
whole swatch list for these schemes) then comes off the table rather than off an
O(reads) scan.

**What does NOT work, checked**: reusing `readNextRefIds` / `nextRefNames` for
`mateRefName` rather than adding a second dictionary. `buildReadNextRefs` reads
only `next_ref`, while `getMateRefName` also reads a synteny block's
`mate.refName` — so LGVSyntenyDisplay's "Query name" would resolve `''` for
every block. Teaching the nextRefs table to read `mate.refName` fixes that and
breaks something quieter: `buildReadInterchrom` compares those names against the
region's refName, and a PAF block's mate is a query contig on the *other*
assembly, so every synteny block would come back interchromosomal and lose its
chevron (`dirMoot`).

That also kills the tempting corollary — that `mateRefName` could drop
`workerExtracts` and become a tier-2 recolor instead of a refetch. It cannot: the
worker still has to extract the value. The win here is payload and clone time
only.

## RNA-seq splice follow-ups

The splice thread shipped the spliced-reads filter, spliced-first layout,
splice-motif classification and the junction-BED tutorial section, and deferred
these as one-liners with no reasoning; the first move under each is
reconstructed, not decided.

**Splice-chain group-by** — group reads by the ordered set of junctions they
cross, so one row means one isoform's evidence. Closest to buildable of the
five: the layout half already exists (spliced-first ordering puts those reads
adjacent), and the key is the read's `N`-op list, which
`features/gap/extract.ts` already walks once per read. What is missing is a
user. A group-by nobody has asked for costs a settings row forever, so this
waits on a feature request rather than on any code.

**Differential transcript usage** — two ways in, and they are different
products. A table join reads per-transcript counts from a spreadsheet and
colors a transcript track from a column, which is the SV inspector's shape
applied to gene models. A numeric ramp skips the table and colors from a score
already on the feature. The join answers the real question and needs a whole
UI; the ramp is cheap and answers a narrower one. Picking between them is the
first move, and neither is started.

**Sashimi labels as a fraction, with a depth-proof floor** — a junction arc
carries its supporting read count today. A fraction of local depth is more
honest (40 reads across a junction means different things at 50x and 5000x) but
a ratio over a small denominator is noise, so it needs a floor below which the
count is shown instead. Choosing the floor is the work, and it is a visual call
as much as a numeric one.

Two RNA-seq notes on items above. **Read downsampling** on a deep lane keeps
the junction picture at a fraction of the rows, but a sampled pileup's apparent
depth is wrong and nothing in the chrome says so — a chrome question before a
fetch one. **First-of-pair auto-detect** already reads the aligner's
`XS`/`TS`/`ts` through `getEffectiveStrand`; what is open is a read with none of
them, which wants a comparison against annotated gene strand that a display
cannot assume is loaded.
