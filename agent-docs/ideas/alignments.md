---
name: alignments
description: Read-pair curved links, coverage decomposition by MAPQ / discordancy / HP, three coverage-band additions off data already shipped (strand-split allele bars, variant-to-variant navigation, a bedGraph export), large-region viewing for dense BAM, SBX duplex `yc` coloring, and why CRAM decode parallelism is not the lever the profile points at.
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
