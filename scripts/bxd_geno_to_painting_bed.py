#!/usr/bin/env python3
"""Turn a GeneNetwork BXD `.geno` file into the multi-row chromosome-painting
BED shown in website/docs/tutorials/bxd_qtl.md ("Track 1: chromosome painting").

Each strain's markers are walked along every chromosome and run-length encoded:
one BED interval per run of consecutive same-genotype markers, colored by
genotype (B / D / H) via itemRgb, with the strain name in a `sample` column the
LinearMultiRowFeatureDisplay partitions on. Unknown (U) markers are left blank.

Usage: bxd_geno_to_painting_bed.py <BXD.geno> <out.bed>

Then: sort -k1,1 -k2,2n out.bed | bgzip > bxd_painting.bed.gz && tabix -p bed ...

Output columns (matching the BedTabixAdapter in bxd_qtl.md):
  chrom chromStart chromEnd name score strand thickStart thickEnd itemRgb sample genotype
"""
import sys

geno_file, out_bed = sys.argv[1:3]

# blue = B parent (C57BL/6J), red = D parent (DBA/2J), grey = heterozygous.
# U (unknown) emits no block, leaving a blank gap.
color_of = {"B": "65,105,225", "D": "220,60,50", "H": "128,128,128"}


def parse_geno(path):
    """Return (strains, markers) where markers is [(chrom, mb, [call,...])]."""
    strains = None
    markers = []
    for line in open(path):
        line = line.rstrip("\n")
        if not line or line[0] in "@#":
            continue
        f = line.split("\t") if "\t" in line else line.split()
        if strains is None:
            if f[0] == "Chr":  # header: Chr Locus cM Mb <strain> <strain> ...
                strains = f[4:]
            continue
        markers.append((f[0], float(f[3]), f[4:]))
    if strains is None:
        raise SystemExit("no 'Chr ... Mb' header row found; is this a .geno file?")
    return strains, markers


strains, markers = parse_geno(geno_file)

# group markers by chromosome, preserving file order (already position-sorted)
by_chrom = {}
for chrom, mb, calls in markers:
    by_chrom.setdefault(chrom, []).append((mb, calls))

out = []
for si, strain in enumerate(strains):
    for chrom, rows in by_chrom.items():
        # collapse consecutive same-genotype markers into runs; each block abuts
        # the next run's first marker so the painting is gapless (except U)
        runs = []  # (geno, start_mb, end_mb)
        run_geno = None
        run_start_mb = None
        for mb, calls in rows:
            g = calls[si]
            if g != run_geno:
                if run_geno is not None:
                    runs.append((run_geno, run_start_mb, mb))
                run_geno, run_start_mb = g, mb
        if run_geno is not None:
            runs.append((run_geno, run_start_mb, rows[-1][0]))
        for g, s_mb, e_mb in runs:
            if g not in color_of:  # U or unexpected -> blank
                continue
            s = int(round(s_mb * 1e6))
            e = max(int(round(e_mb * 1e6)), s + 1)
            out.append(
                [
                    "chr" + chrom,
                    str(s),
                    str(e),
                    f"{strain}_{g}",
                    "0",
                    ".",
                    str(s),
                    str(e),
                    color_of[g],
                    strain,
                    g,
                ]
            )

header = (
    "#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\t"
    "thickStart\tthickEnd\titemRgb\tsample\tgenotype\n"
)
with open(out_bed, "w") as fh:
    fh.write(header)
    for r in out:
        fh.write("\t".join(r) + "\n")

print(f"wrote {len(out)} blocks for {len(strains)} strains to {out_bed}")
