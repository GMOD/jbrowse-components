---
name: coverage-summarization-by-read-attribute
description: The coverage band already decomposes depth by base, modification and interbase event; the same compute-pack-draw step could partition it by MAPQ-0, discordancy or HP tag, or add a continuous lane (mean base quality, insert size, fraction clipped). A lane is affordable because it accumulates rather than emits; do not bound one with subPixelBinBp.
---

# Coverage summarization by read attribute

Split out of the alignments collection on 2026-09-27.

The coverage track is already a decomposition
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

**What makes a signal lane affordable is that it accumulates rather than emits.**
`perBaseQuality` as a COLOR mode emits one entry per aligned base of every read
— `region span x depth`, measured at 30,565,003 entries and 2.0 GB on a 1 Mb
pacbio pileup (`measurements/per-base-wall-bin.json`). The same input summed into
a per-reference-position accumulator is two arrays over the region span, a
running sum and a count: `O(span)`, independent of depth, and the shape
`sweepDepths` and `downsampleStatsBins` already use for the depth axis. A mean
never needs its samples kept, only added.

That also says which quality a lane should carry. **MAPQ is free** — one value
per read, already extracted, so a MAPQ lane needs no per-base walk at all. Mean
BASE quality needs the CIGAR walk, and the walk is the cost, not the storage.
The two answer different questions: MAPQ is whether the reads are in the right
place, base quality is whether the letters are right.

**Do not reach for `subPixelBinBp` to bound a lane.** Its own doc says so and
this is the case it warns about: sampling one base per sub-pixel window suits a
mark that already lost the sub-pixel race, and is wrong for anything painting a
MEAN, which needs its whole sample. At 333 bp/px the rule picks a 128 bp window,
which would average about 2.6 bases per pixel instead of 333 and turn a smooth
quality ramp into noise.

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

The SV survey of 2026-09-26 ranks the MAPQ-0 and discordant partitions as the
cheapest copy-number evidence the tree can add without a caller. A depth step
that is really a segmental duplication reads grey in the MAPQ-0 partition, and
the repeat-mediated junctions of a Carvalho-type inverted triplication are
exactly the ones a plain depth bar cannot tell from a copy step. Nothing here
infers a copy number; the bar shows which reads the depth is made of.
