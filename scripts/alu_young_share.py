#!/usr/bin/env python3
"""Count one repeat family's copies per megabase and test whether its youngest
lineage's share follows the family's density, for alu_age.md.

Usage: alu_young_share.py <family.bed.gz> <out.bed> [young name prefix]

The input is a RepeatMasker-shaped BED with a `#` header (name in column 4,
strand in column 5). The young prefix defaults to AluY; for Alu only the AluJ,
AluS and AluY lineages count, which leaves out the FLAM and FRAM monomers.

Output, one row per 1 Mb bin of chr1-22 and chrX holding at least 50 copies:
  chrom start end name copies young plus youngShare youngLog2 strandLog2
youngLog2 is the bin's young share against the genome-wide share; strandLog2
is its plus-strand share against a half, a split with no reason to follow the
density.

It prints the Spearman rank correlation of each share with copies per bin. A
single megabase can swing by chance, so the test is the trend across every bin
of the genome, with the strand split as the control that should show none.
"""
import gzip
import math
import sys
from collections import Counter

BIN = 1_000_000
MIN_COPIES = 50

family_bed, out_bed = sys.argv[1:3]
young_prefix = sys.argv[3] if len(sys.argv) > 3 else "AluY"
lineages = ("AluJ", "AluS", "AluY") if young_prefix.startswith("Alu") else ("",)
primary = {f"chr{c}" for c in [*range(1, 23), "X"]}
primary |= {c.removeprefix("chr") for c in primary}

copies, young, plus = Counter(), Counter(), Counter()
with gzip.open(family_bed, "rt") as fh:
    for line in fh:
        if line.startswith("#"):
            continue
        chrom, start, _, name, strand = line.split("\t", 5)[:5]
        if chrom not in primary or not name.startswith(lineages):
            continue
        key = (chrom, int(start) // BIN)
        copies[key] += 1
        young[key] += name.startswith(young_prefix)
        plus[key] += strand == "+"


def chrom_order(key):
    name = key[0].removeprefix("chr")
    return (int(name) if name.isdigit() else 99, key[1])


def ranks(values):
    order = sorted(range(len(values)), key=values.__getitem__)
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for idx in order[i : j + 1]:
            out[idx] = (i + j) / 2
        i = j + 1
    return out


def spearman(a, b):
    ra, rb = ranks(a), ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    spread = sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)
    rho = cov / math.sqrt(spread)
    # at thousands of bins the t statistic's distribution is the normal one
    t = rho * math.sqrt((len(a) - 2) / max(1e-300, 1 - rho * rho))
    return rho, math.erfc(abs(t) / math.sqrt(2))


bins = sorted((k for k in copies if copies[k] >= MIN_COPIES), key=chrom_order)
genome_share = sum(young[k] for k in bins) / sum(copies[k] for k in bins)
density = [copies[k] for k in bins]
print(f"genome-wide {young_prefix} share {genome_share:.4f}")
for label, counts in ((f"{young_prefix} share", young), ("plus-strand share", plus)):
    rho, p = spearman(density, [counts[k] / copies[k] for k in bins])
    shown = f"{p:.2g}" if p > 0 else "< 1e-300"
    print(f"{label} against copies per bin, {len(bins)} bins: Spearman rho {rho:.3f}, p {shown}")

with open(out_bed, "w") as out:
    out.write("#chrom\tstart\tend\tname\tcopies\tyoung\tplus\tyoungShare\tyoungLog2\tstrandLog2\n")
    for k in bins:
        n = copies[k]
        share = young[k] / n
        young_log2 = math.log2(max(share, 1e-3) / genome_share)
        strand_log2 = math.log2(plus[k] / n / 0.5) if plus[k] else -10
        out.write(
            f"{k[0]}\t{k[1] * BIN}\t{(k[1] + 1) * BIN}\t{k[0]}:{k[1]}Mb\t{n}\t"
            f"{young[k]}\t{plus[k]}\t{share:.4f}\t{young_log2:.3f}\t{strand_log2:.3f}\n"
        )
