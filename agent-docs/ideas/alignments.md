---
name: alignments
description: Read-pair curved links, coverage decomposition by MAPQ / discordancy / HP, three coverage-band additions off data already shipped (strand-split allele bars, variant-to-variant navigation, a bedGraph export), large-region viewing for dense BAM, SBX duplex `yc` coloring, why CRAM decode parallelism is not the lever the profile points at, and why coalescing the per-lane depth buffers does not by itself lift `MAX_GROUPS`, and why the pileup's low-frequency threshold wants a read-count floor rather than a depth ramp.
---

# Alignments

**Curved read links.** Reuse breakpoint logic for a "link with curved lines" mode
(better orientation encoding than straight connectors).

**Long-range inter-region arcs.** UI toggle to draw arcs between distant regions.
Missing in the 1kg demo — may be a bug or unimplemented; needs reproduction.

**Auto-scale noise.** Per-track noise estimate (mean insertion rate) to auto-scale
`featureFrequencyThreshold` (noisy → strict, clean → lenient).

**Quality-aware feature fade.** Toggle to disable sub-pixel fade for high-quality
reads (Illumina/HiFi) where most mismatches are real variants, not errors.

**A count floor, not a depth ramp, for `featureFrequencyThreshold`.** The two
entries above both rescale a curve whose SHAPE is the problem. A 50% allele
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
(`showLowFreqMismatches`) already exists to keep the old behaviour reachable.

**Auto-detect when to use first-of-pair strand.** The precedents are both in
hand: sashimi already picks its own settings, and `geneGlyphMode`'s `auto` is the
shape of the affordance — a token in the bottom-right of the display saying which
way it resolved, so the automatic choice is visible and overridable rather than
silent. What is undecided is the detection itself: what in the data says a
library is stranded first-of-pair, and how wrong the guess can be before it is
worse than the current explicit setting.

**Legend.** Visual guide: strand colors, paired/unpaired styles, SNP colors.

**Strand-split allele bars in the coverage band.** `mismatchStrands` already
ships and `countSnpsAtPosition` already reads it — the tooltip's Strands column
is built from it — so splitting each coloured segment fwd/rev, or flagging an
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
`coverageSnpMinFrequency` the band's colours now do rather than inventing a
second notion of significant. Bounded by the fetched region, which is the honest
limit and worth saying in the UI: "next in view", not "next in the genome".

**Export the coverage band's data.** `coverageDepths` is per-bp on the main
thread at every zoom, and the packed SNP buffer beside it decodes through
`readSnpSegments`. A bedGraph/wig (depth) or VCF-ish (allele counts) download
from the Coverage submenu is a small addition and a frequent ask. The precedent
for the plumbing is `SaveTrackData.tsx` and the bookmark widget's
`downloadBookmarkFile`. The open question is scope: the visible region is what
the user is looking at and what the display actually holds, but "export this
track" reads as the whole file — say which one the menu item means in its label.

**Typed-array refactor.** Worker return is flat parallel arrays — could regroup into
sub-objects (mods, sashimi, coverage). Flat is simple but long; just an idea.

**CRAM decode parallelism is not the lever; allocation might be.** `@gmod/cram`
13.2.0 decodes slices on a worker pool, and nested inside our RPC worker that is
worth 2.1–3.6x **on the decode alone** (its `docs/WORKERS.md`). End to end in a
pan it measured ~1.1x on the deepest fixture and ~1.0 on typical ones, and the
CPU profile says why. Profiling a 1000x-shortread CRAM render across every
thread:

| thread             | idle       |
| ------------------ | ---------- |
| main               | 68.9%      |
| RPC worker         | 29.5% (+12% GC) |
| slice worker (× 4) | 72.2% each |

**The slice workers are starved, not saturated.** Nothing is CPU-bound, so
adding decode throughput pushes on the end that is already waiting. The one
large productive-but-wasteful cost is the RPC worker's **12% GC (724 ms)**.

The hypothesis that number is consistent with — *not* a measured finding, and it
needs an allocation profile before anyone acts on it — is that we allocate one
`CramSlightlyLazyFeature` per record (153,677 of them for that fixture) and then
serialize the lot out of the worker. That is the same problem `@gmod/cram`
already solved *inside* itself with the read-feature arena and the tag/quality
columns, stopping one layer short of us. If it holds, the fix is columnar all
the way to the renderer rather than a wrapper per read, which is the same
direction as the typed-array item above.

**There is also a structural ceiling worth knowing before optimizing here.** The
pool's win scales with how much one query decodes — 1.64x at 19 kb, 2.69x at
100 kb, falling back to 1.87x at 250 kb as the host-side deserialize (serial)
takes over. But a pileup is gated on estimated fetch bytes (5 MB for CRAM) and
screen density, and 100 kb of that fixture is ~11.9 MB, so we refuse it with a
force-load banner. The crossover is near 40 kb, which pins an interactive pileup
to the shallow end of that curve permanently. The library's headline numbers are
therefore not collectable by our pileup by construction — they are collectable by
an export, a whole-region scan, or a force-load.

**Color-by → coverage summarization.** The coverage track is already a decomposition
engine, not a flat depth bar: `snpCoverage` partitions a column's depth by base,
`modCoverage` by modification proportion, `interbaseCoverage` flags insertions/clips.
`runCoveragePipeline.ts` is a list of "compute layer → pack → draw" steps and
`modCoverage` (compute + packGpu + drawCanvas + `.slang`) is a complete template — so
new decomposition modes are new modes on an existing scaffold, not a new subsystem.
The input data (MAPQ, pair orientation/discordancy, tags, per-base quality) is mostly
already extracted in the worker for the existing color-by features.

Two distinct idioms — keep them separate:
- **Stacked partition** (like snp/modCoverage): partition the bar. Fits HP-tag, MAPQ
  bucket, strand, concordant/discordant.
- **Continuous signal lane**: mean base quality, mean insert size, fraction-clipped.
  These aren't partitions of depth — they belong in a thin signal lane (mean ± band),
  not a stacked bar (which would mislead).

Highest scientific value (ranked): MAPQ/MAPQ0-fraction decomposition (instantly flags
repetitive/CNV/segdup regions — bigly's spirit); discordancy (improper pairs — surfaces
SV breakpoints far better than per-read coloring, where signal is diluted); HP-tag
proportion (allelic balance, LOH, allele-specific patterns at a glance). Make
coverage-summary-mode a setting that *defaults to following* color-by where a mapping
exists, rather than welding them. Caveats: each mode is a compute+pack+draw+shader
quadruple (maintenance); coverage meaning different things per mode needs a clear
axis/legend that changes with it; per ADR-016 it belongs in the worker (mode changes
infrequently, per-base pass is cheap → rpcProps). Start with MAPQ/discordancy as the
proof point. Cross-ref [bigly](https://github.com/brentp/bigly).

**Large-region viewing for dense BAM/CRAM.** Today alignments can't show a whole
chromosome for a dense BAM/CRAM. The limits stack in three tiers, and lifting one
just exposes the next — so this is a program of work, not a single fix:

- **Width-driven (the easy one, being addressed separately).** The coverage band
  packs one 8-byte GPU record per bp (`packCoverageBinsForGpu`), so the vertex
  buffer hits the ~1 GiB device limit at ~135 Mbp *regardless of read count*, and
  `computeVisibleCoverageStats` re-scans the full per-bp depth array (~1 s at
  145 Mbp, measured) on every pan/zoom settle. Fix: downsample to a fixed cap
  (~8k bins) in the worker for both the GPU buffer and the shipped array, keeping
  per-bp only as a worker-internal transient for the SNP/indel/frequency
  denominators. This is the coverage-OOM work; it unblocks *sparse* tracks and
  synteny at wide zoom but does **not** help dense BAM.
- **Data-driven (the real ceiling for dense BAM).** One GPU instance per read, per
  mismatch, per gap. A 30× whole-chromosome BAM is ~29 M reads → the read pass
  buffer alone can exceed 1 GiB, with tens of millions more mismatch instances. No
  `maxDepth`/density cap exists in `executeRenderAlignmentData` — it uploads
  everything and leans on the GPU-OOM overlay as a backstop. Needs real read
  downsampling (cap reads/column, reservoir-sample per bin) and/or a
  **coverage-only mode** that skips the pileup + mismatch passes entirely above a
  zoom threshold (show only the binned coverage band). The coverage-summary
  decomposition idea above pairs naturally with this — at whole-chromosome you want
  MAPQ/discordancy summary, not individual reads.
- **Fetch/bandwidth (unavoidable for BAM).** Coverage is *computed* from reads —
  there's no BigWig-style pre-binned summary source (contrast wiggle, which gets
  screen-resolution data free from bbi zoom levels and reports no byte estimate at
  all, so nothing gates it). So whole-chromosome coverage means downloading every read
  in the region; the byte-estimate gate (`byteGateBlocksFetch`, default
  `fetchSizeLimit` 1 MB) blocks it first and forces "Force load to see features".
  A genuine large-region mode would need either a reworked/removed byte gate for
  the coverage-only path, or a precomputed-coverage sidecar (emit a companion
  BigWig at index time) so the wide-zoom band reads a summary instead of the BAM.

Order of value: coverage-only mode + read downsampling (makes force-load survivable
and useful) → byte-gate rework for that path → optional precomputed-coverage
sidecar. Cross-ref the coverage-OOM binning work (`packCoverageBinsForGpu`,
`downsampleDenseMax` and `downsampleStatsBins` in `packages/alignments-core`)
and `runCoveragePipeline.ts`.

**SBX duplex reads — `yc`-tag / duplex-confidence coloring.** Roche's
sequencing-by-expansion (SBX, AXELIOS platform; XOOS analysis tools) emits
**duplex consensus reads** (SBX-D) that merge both strands (R1+R2) of one
molecule. The `yc` aux tag encodes, per base, one of three confidence classes:
**duplex-concordant** (both strands agree — high confidence), **duplex-discordant**
(strands disagree, a mismatch/indel between R1 and R2 — low confidence), and
**simplex tail** (only one strand covers — medium). Format is
`{left_tail}{±}{duplex}{±}{right_tail}`: `+`/`-` mark the contributing strand,
numbers are runs of concordant bases, letters are individual discordant positions
(a lookup table maps each letter to the R1→R2 base pair). Example `4+13-3` = 4 R1
tail bases, 13 concordant duplex bases, 3 R2 tail bases.

Key architectural fact: the XOOS demux tool **also bakes the three classes into
the QUAL string** as three fixed Phred values (concordant=Q39, discordant=Q5,
simplex-tail=Q22). So our existing **Color by → Per-base quality** overlay
(`features/perBaseQuality`, reads `NUMERIC_QUAL`) *already* renders the duplex
structure on SBX-D data today — discordant bases show as low-quality streaks — just
unlabeled and on a generic gradient. Incremental work is legibility, not plumbing.

Proposed, ranked:
- **A dedicated "SBX duplex" per-base color scheme.** `features/perBaseQuality`
  and `features/perBaseLetter` are the exact template: an `extract.ts` that reads a
  tag (`getTagAlt(feature, 'yc')`, same idiom as MM/ML) and walks
  `forEachAlignedBaseInRegion(cigar, start, region, …)` to emit per-ref-base
  entries, plus a GPU/canvas overlay over the `normal` body. Register in
  `COLOR_SCHEMES` (`shared/colorSchemes.ts`) + the `ColorSchemeType` union
  (`shared/types.ts`) — a compile error until classified with a shader path + menu
  placement — and it appears in the Color-by menu with a legend (green concordant /
  red discordant / grey simplex). **Open question first:** confirm whether aligned
  SBX-D BAMs carry `yc` into the output or only the Q39/Q5/Q22 QUAL encoding; if the
  latter, drive the scheme off QUAL bins instead of parsing `yc` (even simpler, no
  new extract).
- **Decode `yc` in the feature detail panel** (`AlignmentsFeatureDetail/tagInfo.ts`).
  Today `yc` shows as a raw string; a small decoder renders "N concordant / M
  discordant / tails R1=x R2=y" plus the discordant-position breakdown. Cheap,
  self-contained.
- **(Optional) Discordant positions as mismatch-style marks** — the low-confidence
  calls a variant reviewer cares about, surfaced without switching schemes. Overlaps
  the color scheme; only if per-base coloring proves too subtle at genome scale.

Explicitly **not** in scope: R1/R2 reconstruction from `yc` — that's a
data-processing concern for the caller/collapser (XOOS), not the browser; JBrowse's
job is surfacing the confidence classes. Pairs naturally with the
"Color-by → coverage summarization" concordant/discordant partition idea above.
Example data: Roche's GIAB SBX-D BAMs (HG001/HG002) at `sequencing.roche.com/SBXdata`
/ the XOOS `web.sbxdata.kamino.platform.navify.com` platform; the XOOS repo
(`github.com/Roche-AXELIOS/XOOS`) ships the demux source but no small BAM fixtures,
so a region-sliced GIAB BAM is the path to a test fixture. Docs:
`roche-axelios.gitbook.io/xoos` (SBX-D read-interpretation + yc-tag guide).

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
colour schemes (`tag`, `mateRefName`) ship `readTagValues: string[]` — one string
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
