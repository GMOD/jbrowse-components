#!/usr/bin/env python3
"""Collapse a per-sample copy-number BED into one cohort recurrence bedGraph:
per bin, what fraction of the cohort is gained and what fraction is lost.

Input is the cohort BED built by build_tcga_cohort_cnv.sh (or any BED with a
`#`-header naming a sample column and a numeric log2-ratio column):

    #chrom  start     end        name    sample             segmean
    chr1    3301764   30796057   +0.15   TCGA-3C-AAAU-01A   0.1480

Output is a two-value bedGraph, gain positive and loss negative, so a wiggle
track with the default bicolor pivot at 0 draws the classic mirrored frequency
plot — gains up in one color, losses down in the other:

    #chrom  start     end        gain    loss
    chr1    3300000   3400000    22.83   -11.14

Values are percent of the cohort, not of the bin's covered samples: the
denominator is every sample in the file. Bins where fewer than --min-coverage of
the cohort has any call at all (centromeres, acrocentric p-arms, telomeres) are
left out entirely rather than emitted as a dip toward zero, so a gap in the
track is missing data rather than an absence of events.

Usage: cnv_recurrence.py IN.bed[.gz] OUT.bedGraph [--bin N] [--gain X]
                         [--loss X] [--min-coverage F]
"""
import argparse
import gzip
import sys
from collections import defaultdict


def open_maybe_gz(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("infile")
    p.add_argument("outfile")
    p.add_argument("--bin", type=int, default=100_000, help="bin size in bp")
    p.add_argument("--gain", type=float, default=0.3, help="log2 ratio at or above which a segment counts as gained")
    p.add_argument("--loss", type=float, default=-0.3, help="log2 ratio at or below which a segment counts as lost")
    p.add_argument("--min-coverage", type=float, default=0.5,
                   help="drop bins where less than this fraction of the cohort has any call")
    return p.parse_args(argv)


def read_segments(path):
    """(chrom, start, end, sample, value) tuples plus the per-chrom extent.

    Column positions come from the `#` header when it names `sample`/`segmean`,
    so a BED with extra columns still works.
    """
    col_sample, col_value = 4, 5
    segs = []
    samples = set()
    extent = defaultdict(int)
    with open_maybe_gz(path) as fh:
        for line in fh:
            if line.startswith("#"):
                names = line[1:].rstrip("\n").split("\t")
                if "sample" in names:
                    col_sample = names.index("sample")
                if "segmean" in names:
                    col_value = names.index("segmean")
                continue
            f = line.rstrip("\n").split("\t")
            chrom, start, end = f[0], int(f[1]), int(f[2])
            samples.add(f[col_sample])
            extent[chrom] = max(extent[chrom], end)
            segs.append((chrom, start, end, float(f[col_value])))
    return segs, len(samples), extent


def bin_range(start, end, size):
    """Inclusive first/last bin whose midpoint falls in [start, end).

    Midpoint assignment rather than any-overlap: a segment boundary inside a bin
    then moves the bin to whichever side owns most of it, instead of counting the
    sample on both sides and pushing gain+loss over 100%.
    """
    lo = max(0, -(-(2 * start - size) // (2 * size)))
    hi = (2 * end - size) // (2 * size)
    return lo, hi


def tally(segs, extent, size, gain_cut, loss_cut):
    """Per chrom, the running (coverage, gained, lost) counts per bin.

    Each segment touches a contiguous run of bins, so it is accumulated as +1 at
    the run's first bin and -1 one past its last, and a single prefix sum at the
    end turns those into per-bin counts. That keeps the pass linear in segments
    rather than in segment length: a 9 Mb SNP-6 segment is two writes, not 90.
    """
    diffs = {c: [[0] * (extent[c] // size + 2) for _ in range(3)] for c in extent}
    for chrom, start, end, value in segs:
        lo, hi = bin_range(start, end, size)
        if hi >= lo:
            cov, gain, loss = diffs[chrom]
            for arr in (cov,
                        gain if value >= gain_cut else None,
                        loss if value <= loss_cut else None):
                if arr is not None:
                    arr[lo] += 1
                    arr[hi + 1] -= 1

    out = {}
    for chrom, arrays in diffs.items():
        sums = []
        for arr in arrays:
            total = 0
            run = []
            for v in arr:
                total += v
                run.append(total)
            sums.append(run)
        out[chrom] = sums
    return out


def main(argv):
    args = parse_args(argv)
    segs, n_samples, extent = read_segments(args.infile)
    if not n_samples:
        sys.exit(f"{args.infile}: no samples found")
    counts = tally(segs, extent, args.bin, args.gain, args.loss)
    floor = args.min_coverage * n_samples

    emitted = 0
    dropped = 0
    with open(args.outfile, "w") as fh:
        fh.write("#chrom\tstart\tend\tgain\tloss\n")
        # lexicographic chrom order (chr1, chr10, ... chr2), which is how the
        # input BED is sorted and what its tabix index expects
        for chrom in sorted(counts):
            cov, gain, loss = counts[chrom]
            n_bins = extent[chrom] // args.bin + 1
            runs = []  # (first bin, last bin exclusive, values), equal values merged
            for i in range(n_bins):
                if cov[i] >= floor:
                    values = (round(100 * gain[i] / n_samples, 2),
                              round(-100 * loss[i] / n_samples, 2))
                else:
                    values = None
                    dropped += 1
                if runs and runs[-1][2] == values:
                    runs[-1][1] = i + 1
                else:
                    runs.append([i, i + 1, values])
            for first, last, values in runs:
                if values is not None:
                    end = min(last * args.bin, extent[chrom])
                    fh.write(f"{chrom}\t{first * args.bin}\t{end}"
                             f"\t{values[0]:g}\t{values[1]:g}\n")
                    emitted += 1

    print(f"   {emitted} intervals from {len(segs)} segments across {n_samples} samples"
          f" ({dropped} uncovered {args.bin // 1000}kb bins skipped)")


if __name__ == "__main__":
    main(sys.argv[1:])
