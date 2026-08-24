---
name: gpu-sample-distance-matrix
description: "Cluster by genotype" on a population panel is almost entirely hclust's sample-by-sample distance build, because the window hands over one column per site and the merge loop is noise beside it. A deliberately naive WebGPU kernel does that build 12 to 19x faster than hclust 5.0.0 and 6 to 12x faster than 5.1.0 on real 1000 Genomes windows, and the same matrix would feed PC1 ordering and compare-to-selected shading for free. What the numbers are, what integrating it takes, the criterion that says which in-browser compute is worth doing at all, and the other candidates that pass it.
---

# A GPU sample distance matrix for clustering

Nothing here is committed work. It is the measured case for one compute-shader
feature, written down so the paper and the next session start from numbers
rather than from the intuition that in-browser analysis is a bad idea. That
intuition is right for almost everything, and the first section says why the
clustering workflow is the exception.

## The criterion

The clustering workflow (`reference/CLUSTERING_WORKFLOW.md`) and the LD matrix
(`plugins/variants/src/VariantRPC/getLDMatrixGPU.ts`) are the two analyses the
app runs itself, and they share a shape that nothing else in the "just load it
as a track" category has:

- **The input is a runtime choice with a combinatorial domain.** LD is a
  pairwise matrix over the sites in the window; clustering is an ordering over
  the samples by the sites in the window. No offline pipeline can enumerate
  every window, sample subset and filter setting, so there is no track to load.
- **The work is superlinear in what is on screen.** Per-site statistics (MAF,
  HWE, missingness) are linear in the window and the worker handles them; a
  pairwise product (sites x sites, samples x samples, bases x bases) is
  quadratic in a viewport-sized input, which is where a GPU dispatch beats a
  worker by an order of magnitude and where the wasm stops being interactive
  above a few thousand items.

A feature that fails the first test belongs in a pipeline. One that passes the
first but fails the second belongs in the worker, not in a shader. The sample
distance matrix passes both.

## Where "Cluster by genotype" spends its time

`executeClusterGenotypeMatrix.ts` hands `@gmod/hclust` one Float32 dosage row
per sample (one row per haplotype in phased mode) with one column per site
that passes the MAF and missingness filters, whose defaults are 0 and 1: every
site in the window. hclust's own optimization history
(`docs/optimizations.md` in that repo) benchmarked at V = 20 columns, where the
merge loop was the cost and got 446x faster; at JBrowse's widths the Euclidean
distance build is the run. On a 1000 Genomes window (2504 samples, 5008
haplotypes, chr22:20-21 Mb, 22,383 phased sites) the merge loop is about 40 ms
of a run that takes seconds to minutes.

Measured with the matrices JBrowse builds, on a 2019 MacBook Pro (i9-9980HK,
Radeon Pro 5300M), hclust warm in node, GPU in headed system Chrome including
upload and readback:

<!-- BEGIN GENERATED MEASUREMENT cluster-distance-gpu -->

| window                     |     N |      V | hclust 5.0.0 | hclust 5.1.0 | WebGPU | GPU vs 5.0.0 | GPU vs 5.1.0 |
| -------------------------- | ----: | -----: | -----------: | -----------: | -----: | -----------: | -----------: |
| 100 kb, MAF 0, samples     | 2,504 |  3,106 |         5.0s |         2.7s |  0.42s |          12x |           6x |
| 1 Mb, MAF 0.05, samples    | 2,504 |  2,357 |         4.5s |         2.1s |  0.31s |          15x |           7x |
| 1 Mb, MAF 0.05, haplotypes | 5,008 |  2,311 |        16.8s |         9.3s |   1.1s |          15x |           8x |
| 1 Mb, MAF 0, samples       | 2,504 | 22,514 |        38.3s |        23.0s |   2.3s |          17x |          10x |
| 1 Mb, MAF 0, haplotypes    | 5,008 | 22,383 |       156.9s |        98.0s |   8.2s |          19x |          12x |

<!-- END GENERATED MEASUREMENT cluster-distance-gpu -->

The GPU's margin grows with N x V. The 5.0.0 column's first call was 12.6 s on
the first row (see `reference/CLUSTERING_WORKFLOW.md` for why); 5.1.0's first
call is within 5% of warm.

The GPU column is a floor: one thread per pair looping over V from global
memory, no shared-memory tiling, chunked at 64 MB per upload. A tiled kernel is
typically another 3 to 5x on this shape, and a packed 2-bit popcount variant,
which is the shape the LD kernels already have, would be beyond that. The
result matched an f64 reference exactly on the 1000 Genomes matrices (integer
dosages) and to 1.2e-9 relative on dog10k, which has imputed fractional values.
hclust 5.1.0 got its 2.5x from the same measurement: the 5.0.0 kernel promoted
every element to double before the subtract, and now differences and squares
are f32x4 with the promotion to f64x2 every 16 elements, bit-identical merges
and heights on every real matrix checked. The distance build in that repo is
now `pnpm bench:real`, which is where the CPU columns come from;
`measurements/cluster-distance-gpu.json` is the record behind the table.

dog10k (167 dogs, 611 columns) clusters in 16 ms on the CPU and the GPU dispatch
takes 18 ms. A small cohort has nothing to gain; the population panel is the
case.

## What integrating it takes

- **hclust needs an entry that takes a precomputed distance matrix.**
  `ClusterOptions` accepts only `data`; the C already separates the distance
  phase from the merge loop, so this is an API addition, not a rewrite. The
  worker's dosage rows stay the fallback and the parity oracle.
- **Same gate and parity pattern as LD.** `getLDMatrixGPU.ts` has `MIN_WORK`
  and `ldStatsParity.test.ts`; the distance kernel gets the same, with the wasm
  as the reference. Below the gate (dog10k) the wasm runs.
- **Accumulation precision goes in the parity test, not in an assumption.** For
  0/1/2 dosages the f32 partial sums are exact, which is why the check came out
  at zero. With site-mean imputation the values are fractional; a long V wants
  the promote-every-16 pattern the wasm now uses, or compensated summation, in
  the kernel.
- **Three visuals from one dispatch.** With the matrix on the GPU, a few power
  iterations give PC1 and an ordering by it (local PCA, whose whole point is
  that the answer differs per window), and one row of the matrix gives
  compare-to-selected shading (click a sample, every other row shades by
  distance in the window; the sample analog of the LD index-SNP view). Neither
  needs another kernel.
- **WebGPU only, by construction.** Storage buffers have no GLSL ES 3.0 target
  (`reference/GPU_RENDERING.md`), so the worker path is not optional.

## The other candidates that pass the criterion

- **Base-level dotplot of the visible windows.** Each output pixel asks whether
  the k-mer at x matches the k-mer at y, over the sequence on screen, self or
  across the two sides of a synteny view. Viewport-defined (no PAF anticipates
  every 50 kb x 50 kb pair a user zooms to), quadratic in a small input, and the
  output is an image the GPU already holds. The best "new picture" candidate,
  because there is no offline equivalent for arbitrary windows.
- **Read x read grouping at a locus.** Passes both tests, and was dropped
  anyway: WhatsHap does it properly and writes HP tags, and "they did not want
  to run it" is not a value proposition.

Declined, with the test they fail: coverage and pileup on the GPU (linear, and
`REJECTED_IDEAS.md` records a coverage GPU pass that compiled clean and cost
correctness); per-site population statistics (linear; Fst between user-chosen
groups is a worker feature, the partition being a runtime choice); genome-wide
sequence search (`local-sequence-search.md` lands it as bandwidth-bound on
fetching the FASTA); Hi-C balancing (elementwise, files ship normalization
vectors); a local LLM (fails the first test outright, and a remote model is the
better experience).

## Reproducing

`products/jbrowse-web/browser-tests/probe-gpu-distance-matrix.ts [N] [V]`
runs the kernel and `clusterMatrix` on one synthetic dosage matrix and prints
both, with the GPU checked against an f64 reference. Synthetic dosages run at
the same per-pair-element rate as the real matrices, which is why the probe
does not carry a VCF; `pnpm bench:real` in the hclust repo is the real-data
run. Headed Chrome, because headless has no WebGPU.
