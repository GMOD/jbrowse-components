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

With --groups the same tally runs once per clinical group and each group gets
its own pair of columns, which a BedGraphTabixAdapter exposes as one signal per
column and a MultiQuantitativeTrack draws as one row per signal:

    #chrom  start     end        HR+/HER2- gain  HR+/HER2- loss  HER2+ gain  ...
    chr1    3300000   3400000    21.34           -10.91          27.72       ...

Usage: cnv_recurrence.py IN.bed[.gz] OUT.bedGraph [--bin N] [--gain X]
                         [--loss X] [--min-coverage F]
                         [--groups SAMPLES.tsv:COLUMN] [--min-group N]
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
    p.add_argument("--groups", metavar="SAMPLES.tsv:COLUMN",
                   help="tally each group of a samples TSV separately, into its own"
                        " pair of columns; the TSV's first column is the sample name")
    p.add_argument("--min-group", type=int, default=20,
                   help="with --groups, skip groups with fewer than this many samples"
                        " in the BED, whose per-bin percentages would be noise")
    return p.parse_args(argv)


def read_group_map(spec):
    """{sample: group label} from a `PATH:COLUMN` samples TSV spec.

    The same TSV a multi-sample variant track loads as `samplesTsvLocation`, so
    a cohort's rows group the same way in both tracks without a second table.
    """
    path, _, column = spec.rpartition(":")
    if not path:
        sys.exit(f"--groups {spec}: expected PATH:COLUMN")
    with open_maybe_gz(path) as fh:
        header = fh.readline().rstrip("\n").split("\t")
        if column not in header:
            sys.exit(f"{path}: no column {column!r} (has {', '.join(header)})")
        col = header.index(column)
        return {f[0]: f[col] for f in (l.rstrip("\n").split("\t") for l in fh) if len(f) > col}


def read_segments(path):
    """(chrom, start, end, sample index, value) tuples, the sample names those
    index, and the per-chrom extent.

    Column positions come from the `#` header when it names `sample`/`segmean`,
    so a BED with extra columns still works.
    """
    col_sample, col_value = 4, 5
    segs = []
    sample_index = {}
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
            sample = f[col_sample]
            if sample not in sample_index:
                sample_index[sample] = len(sample_index)
            extent[chrom] = max(extent[chrom], end)
            segs.append((chrom, start, end, sample_index[sample], float(f[col_value])))
    return segs, list(sample_index), extent


def resolve_groups(samples, group_map, min_group):
    """([(label, size)], group index per sample), largest group first.

    Ungrouped (no --groups) is the one-group case with an empty label, which is
    what keeps the default output a plain `gain`/`loss` pair.

    A sample the TSV does not name, and a sample in a group too small to carry a
    percentage, are dropped from every group but still count toward a bin's
    coverage: the coverage mask says whether the array had probes there, which
    is a property of the platform rather than of the grouping, and holding it
    fixed keeps the grouped file's gaps identical to the ungrouped one's.
    """
    if group_map is None:
        return [("", len(samples))], [0] * len(samples)

    sizes = defaultdict(int)
    for s in samples:
        if s in group_map:
            sizes[group_map[s]] += 1
    kept = sorted(((n, g) for g, n in sizes.items() if n >= min_group), key=lambda x: (-x[0], x[1]))
    groups = [(g, n) for n, g in kept]
    index_of = {g: i for i, (g, _) in enumerate(groups)}
    dropped = sorted(((n, g) for g, n in sizes.items() if n < min_group), reverse=True)
    unnamed = sum(1 for s in samples if s not in group_map)
    if dropped:
        print("   skipped small groups: "
              + ", ".join(f"{g} ({n})" for n, g in dropped))
    if unnamed:
        print(f"   {unnamed} samples absent from the samples TSV, left out of every group")
    return groups, [index_of.get(group_map.get(s), -1) for s in samples]


def bin_range(start, end, size):
    """Inclusive first/last bin whose midpoint falls in [start, end).

    Midpoint assignment rather than any-overlap: a segment boundary inside a bin
    then moves the bin to whichever side owns most of it, instead of counting the
    sample on both sides and pushing gain+loss over 100%.
    """
    lo = max(0, -(-(2 * start - size) // (2 * size)))
    hi = (2 * end - size) // (2 * size)
    return lo, hi


def tally(segs, extent, size, gain_cut, loss_cut, group_of_sample, n_groups):
    """Per chrom, the running counts per bin: coverage, then gained and lost per
    group.

    Each segment touches a contiguous run of bins, so it is accumulated as +1 at
    the run's first bin and -1 one past its last, and a single prefix sum at the
    end turns those into per-bin counts. That keeps the pass linear in segments
    rather than in segment length: a 9 Mb SNP-6 segment is two writes, not 90.
    """
    n_arrays = 1 + 2 * n_groups
    diffs = {c: [[0] * (extent[c] // size + 2) for _ in range(n_arrays)] for c in extent}
    for chrom, start, end, sample, value in segs:
        lo, hi = bin_range(start, end, size)
        if hi >= lo:
            arrays = diffs[chrom]
            arrays[0][lo] += 1
            arrays[0][hi + 1] -= 1
            g = group_of_sample[sample]
            if g >= 0:
                # gained and lost are mutually exclusive under the two cutoffs,
                # so at most one of the group's two arrays takes this segment
                slot = 1 + 2 * g if value >= gain_cut else 2 + 2 * g if value <= loss_cut else None
                if slot is not None:
                    arrays[slot][lo] += 1
                    arrays[slot][hi + 1] -= 1

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
    group_map = read_group_map(args.groups) if args.groups else None
    segs, samples, extent = read_segments(args.infile)
    if not samples:
        sys.exit(f"{args.infile}: no samples found")
    groups, group_of_sample = resolve_groups(samples, group_map, args.min_group)
    if not groups:
        sys.exit(f"{args.infile}: no group reaches --min-group {args.min_group}")
    counts = tally(segs, extent, args.bin, args.gain, args.loss,
                   group_of_sample, len(groups))
    floor = args.min_coverage * len(samples)

    # Direction-major, so every group's gain row is adjacent to every other
    # group's and the comparison the grouping exists for is between neighbours
    # rather than across an intervening loss row. Ungrouped, the labels are
    # empty and this is the same `gain`/`loss` pair as before.
    #
    # Gain and loss stay separate columns rather than collapsing to one signed
    # net per group. They are not redundant: at chr17:40.5Mb, HER2+ is 28.8%
    # gained and 27.7% lost, the amplicon boundary cutting both ways across the
    # group, and a net would draw that as roughly nothing right beside ERBB2.
    columns = [f"{g} {d}".strip()
               for d in ("gain", "loss") for g, _ in groups]
    emitted = 0
    dropped = 0
    with open(args.outfile, "w") as fh:
        fh.write("#chrom\tstart\tend\t" + "\t".join(columns) + "\n")
        # lexicographic chrom order (chr1, chr10, ... chr2), which is how the
        # input BED is sorted and what its tabix index expects
        for chrom in sorted(counts):
            arrays = counts[chrom]
            cov = arrays[0]
            n_bins = extent[chrom] // args.bin + 1
            runs = []  # (first bin, last bin exclusive, values), equal values merged
            for i in range(n_bins):
                if cov[i] >= floor:
                    values = tuple(
                        round(sign * 100 * arrays[1 + 2 * gi + off][i] / size, 2)
                        for off, sign in ((0, 1), (1, -1))
                        for gi, (_, size) in enumerate(groups)
                    )
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
                    fh.write(f"{chrom}\t{first * args.bin}\t{end}\t"
                             + "\t".join(f"{v:g}" for v in values) + "\n")
                    emitted += 1

    scope = (f" in {len(groups)} groups ("
             + ", ".join(f"{g} {n}" for g, n in groups) + ")") if args.groups else ""
    print(f"   {emitted} intervals from {len(segs)} segments across {len(samples)} samples"
          f"{scope} ({dropped} uncovered {args.bin // 1000}kb bins skipped)")


if __name__ == "__main__":
    main(sys.argv[1:])
