#!/usr/bin/env python3
"""Merge a directory of GDC per-tumor MAF files into one multi-sample VCF, so a
cohort's somatic mutations load as a variant matrix (one column per site, one
row per tumor) instead of as N separate tracks.

A MAF lists only the mutated sites of one tumor, so the merge is a pivot: every
site any tumor carries becomes a VCF record, and every tumor gets a genotype
there. Tumors with no call at a site are written 0/0, which reads as "this MAF
does not report a mutation here" rather than as proven reference: a masked MAF
carries no reference or coverage evidence, only variants.

VEP annotation already in the MAF is carried through as an INFO/CSQ field in
default VEP field order, which is what JBrowse's "color by consequence impact"
reads.

Coordinates: MAF is 1-based, with indels written as the changed bases only
(`-` on the other side). VCF needs the anchoring base before the event, which
the MAF's own CONTEXT column supplies (an 11-mer of reference, 5 bases of left
flank then the reference allele), so no FASTA is needed.

Usage: maf_to_vcf.py MAF_DIR OUT.vcf  (OUT of `-` writes to stdout, for bgzip)
"""
import argparse
import glob
import gzip
import os
import sys

CHROMS = [f"chr{c}" for c in list(range(1, 23)) + ["X", "Y", "M"]]

# The MAF columns copied into INFO/CSQ, in VEP's default CSQ order. Field 1 is
# the consequence and the IMPACT token is scanned for, which is what
# plugins/variants reads to color cells by impact.
CSQ_COLUMNS = [
    ("Allele", "Allele"),
    ("Consequence", "Consequence"),
    ("IMPACT", "IMPACT"),
    ("SYMBOL", "SYMBOL"),
    ("Gene", "Gene"),
    ("Feature", "Feature"),
    ("BIOTYPE", "BIOTYPE"),
    ("HGVSc", "HGVSc"),
    ("HGVSp", "HGVSp_Short"),
    ("Protein_position", "Protein_position"),
    ("Amino_acids", "Amino_acids"),
    ("SIFT", "SIFT"),
    ("PolyPhen", "PolyPhen"),
]

# INFO/CSQ is comma-separated and semicolon-terminated, so those two characters
# (plus whitespace) cannot appear inside a value.
INFO_UNSAFE = str.maketrans({",": "&", ";": "|", " ": "_", "\t": "_", "=": "-"})


def clean(value):
    return value.translate(INFO_UNSAFE) if value and value != "." else ""


def read_maf(path):
    """Header-keyed rows of one MAF, `#`-comment lines skipped."""
    with gzip.open(path, "rt") if path.endswith(".gz") else open(path) as fh:
        names = None
        for line in fh:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if names is None:
                names = fields
                continue
            yield dict(zip(names, fields))


def to_vcf_allele(row):
    """(pos, ref, alt) in VCF form, or None when the row can't be anchored.

    CONTEXT is the reference 11-mer whose 6th base (index 5) is the first base
    of a substitution, or the base immediately before an indel. That base is the
    anchor VCF requires, so an insertion or deletion needs no reference lookup.
    """
    pos = int(row["Start_Position"])
    ref = row["Reference_Allele"]
    alt = row["Tumor_Seq_Allele2"]
    context = row["CONTEXT"].upper()
    if ref != "-" and alt != "-":
        return (pos, ref, alt) if context[5 : 5 + len(ref)] == ref else None
    if len(context) < 6:
        return None
    anchor = context[5]
    if alt == "-":
        # deletion: anchor + deleted bases -> anchor
        return (pos - 1, anchor + ref, anchor) if context[6 : 6 + len(ref)] == ref else None
    # insertion: MAF Start_Position is the base before the inserted sequence
    return pos, anchor, anchor + alt


def collect(maf_dir):
    """sites -> {(chrom,pos,ref,alt): {'csq':…, 'gt':{sample: field}}}.

    One file per tumor barcode: a few cases carry two MAFs for the same tumor,
    and letting both through would make one sample two columns of the matrix.
    Sorting the paths first makes which one wins deterministic.
    """
    sites = {}
    samples = {}
    skipped = 0
    for path in sorted(glob.glob(os.path.join(maf_dir, "**", "*.maf*"), recursive=True)):
        rows = list(read_maf(path))
        if not rows:
            continue
        # TCGA-3C-AAAU-01A-11D-A41F-09 -> TCGA-3C-AAAU-01A, the sample-level
        # barcode the cohort CNV BED also keys on, so the two tracks line up
        barcode = "-".join(rows[0]["Tumor_Sample_Barcode"].split("-")[:4])
        if barcode in samples:
            continue
        samples[barcode] = path
        for row in rows:
            allele = to_vcf_allele(row)
            if allele is None:
                skipped += 1
                continue
            pos, ref, alt = allele
            key = (row["Chromosome"], pos, ref, alt)
            site = sites.get(key)
            if site is None:
                site = sites[key] = {"row": row, "gt": {}}
            depth = row["t_depth"] or "."
            counts = f'{row["t_ref_count"] or "."},{row["t_alt_count"] or "."}'
            site["gt"][barcode] = f"0/1:{counts}:{depth}"
    return sites, sorted(samples), skipped


def info_field(key, sites, n_samples):
    row = sites[key]["row"]
    n_carriers = len(sites[key]["gt"])
    csq = "|".join(clean(row.get(maf_col, "")) for _, maf_col in CSQ_COLUMNS)
    parts = [
        f"AC={n_carriers}",
        f"AN={2 * n_samples}",
        f"AF={n_carriers / n_samples:.5f}",
        f"NTUMOR={n_carriers}",
        f"CLASS={clean(row['Variant_Classification'])}",
        f"CSQ={csq}",
    ]
    gene = clean(row["Hugo_Symbol"])
    if gene:
        parts.insert(4, f"GENE={gene}")
    hgvsp = clean(row["HGVSp_Short"])
    if hgvsp:
        parts.insert(5, f"HGVSP={hgvsp}")
    return ";".join(parts)


HEADER = """##fileformat=VCFv4.2
##source=maf_to_vcf.py (GDC Masked Somatic Mutation MAF)
##reference=GRCh38
##INFO=<ID=AC,Number=A,Type=Integer,Description="Tumors carrying the alt allele">
##INFO=<ID=AN,Number=1,Type=Integer,Description="Total alleles in the cohort">
##INFO=<ID=AF,Number=A,Type=Float,Description="Fraction of tumors carrying the alt allele">
##INFO=<ID=NTUMOR,Number=1,Type=Integer,Description="Number of tumors with this mutation">
##INFO=<ID=GENE,Number=1,Type=String,Description="MAF Hugo_Symbol">
##INFO=<ID=HGVSP,Number=1,Type=String,Description="MAF HGVSp_Short">
##INFO=<ID=CLASS,Number=1,Type=String,Description="MAF Variant_Classification">
##INFO=<ID=CSQ,Number=.,Type=String,Description="Consequence annotations from the MAF's VEP columns. Format: {csq_format}">
##FILTER=<ID=PASS,Description="Passed the GDC somatic mutation filters">
##FORMAT=<ID=GT,Number=1,Type=String,Description="0/1 where the tumor's MAF reports this mutation, else 0/0 (absence of a call, not proven reference)">
##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Tumor ref and alt read counts (MAF t_ref_count, t_alt_count)">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Tumor read depth (MAF t_depth)">
"""


def write_vcf(out, sites, samples, chrom_order):
    n = len(samples)
    csq_format = "|".join(name for name, _ in CSQ_COLUMNS)
    out.write(HEADER.format(csq_format=csq_format))
    for chrom in chrom_order:
        out.write(f"##contig=<ID={chrom}>\n")
    out.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t")
    out.write("\t".join(samples) + "\n")

    index = {s: i for i, s in enumerate(samples)}
    genotypes = ["0/0"] * n
    ordered = sorted(sites, key=lambda k: (chrom_order.index(k[0]), k[1], k[2], k[3]))
    for key in ordered:
        chrom, pos, ref, alt = key
        row = sites[key]["row"]
        rsid = row["dbSNP_RS"] if row["dbSNP_RS"].startswith("rs") else "."
        carriers = sites[key]["gt"]
        for sample, value in carriers.items():
            genotypes[index[sample]] = value
        out.write(
            f"{chrom}\t{pos}\t{rsid}\t{ref}\t{alt}\t.\tPASS\t"
            f"{info_field(key, sites, n)}\tGT:AD:DP\t" + "\t".join(genotypes) + "\n"
        )
        for sample in carriers:
            genotypes[index[sample]] = "0/0"


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("maf_dir")
    parser.add_argument("outfile", help="output VCF, or - for stdout")
    args = parser.parse_args(argv)

    sites, samples, skipped = collect(args.maf_dir)
    if not sites:
        sys.exit(f"{args.maf_dir}: no MAF records found")
    chrom_order = [c for c in CHROMS if any(k[0] == c for k in sites)]
    unknown = {k[0] for k in sites} - set(chrom_order)
    if unknown:
        sys.exit(f"unexpected contigs in MAF: {sorted(unknown)}")

    out = sys.stdout if args.outfile == "-" else open(args.outfile, "w")
    try:
        write_vcf(out, sites, samples, chrom_order)
    finally:
        if out is not sys.stdout:
            out.close()
    print(
        f"   {len(sites)} sites across {len(samples)} tumors"
        + (f" ({skipped} rows without usable CONTEXT skipped)" if skipped else ""),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main(sys.argv[1:])
