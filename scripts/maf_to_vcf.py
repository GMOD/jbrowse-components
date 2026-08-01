#!/usr/bin/env python3
"""Merge per-tumor GDC Masked Somatic Mutation MAFs into one multi-sample VCF.

Input is a directory holding one MAF per tumor, as
build_tcga_cohort_mutations.sh unpacks them (any depth, `.maf` or `.maf.gz`).
Output is a VCF with one column per tumor:

    #CHROM POS      ID  REF ALT ... FORMAT    TCGA-A2-A0T2-01A  TCGA-A8-A07C-01A
    chr3   179218303 .  G   A   ... GT:AD:DP  0/1:81,29:110     0/0

`0/1` is "this tumor's MAF reports this mutation" and `0/0` is "it does not",
which is an absence of a call rather than a proven reference base: the GDC MAF
carries no coverage record for sites it did not call. Every somatic call is
written het, since a MAF gives no ploidy and a subclonal call at 90% VAF is not
a homozygote.

Sample names are truncated to the TCGA **sample** barcode (`TCGA-A2-A0T2-01A`),
which is what build_tcga_cohort_cnv.sh partitions its rows by, so the same tumor
is one row name in both cohorts.

The cohort is picked here rather than by the GDC query that downloaded the MAFs,
because a file query cannot say which sample a MAF is *of*: the manifest field
`cases.samples.submitter_id` returns whichever sample of the case comes first,
which for most TCGA cases is the matched blood normal. So `--sample-types` filters
on the barcode's own sample-type code (`01` = primary solid tumor, `06` =
metastatic, `11` = solid normal), read off the MAF's `Tumor_Sample_Barcode`, and
two files carrying the same barcode resolve to the first by filename instead of
having their calls merged.

Indels are the one non-mechanical part. MAF writes a deletion as its deleted
bases against a `-` alt, where VCF needs both alleles to share a flanking anchor
base, and that base is not in any coordinate column. It is in `CONTEXT`, the
reference sequence the caller recorded around the call, laid out as five bases,
the VCF-style reference allele, then five more. So the anchor is `CONTEXT[5]`,
with no reference FASTA to fetch and nothing to keep in sync with one.

Usage: maf_to_vcf.py MAF_DIR OUT.vcf [--sample-types 01,06]
"""
import argparse
import csv
import gzip
import os
import sys
from collections import defaultdict

# Contigs to keep, in the order they are written. chrM is dropped: the MAFs
# carry a handful of calls on it, the GDC's own #contigs header lists it last,
# and a tabix-indexed VCF has to be coordinate sorted under one fixed order.
CONTIGS = [f"chr{c}" for c in list(range(1, 23)) + ["X", "Y"]]

# The MAF columns each output field comes from. The VEP-derived ones (Consequence
# through PolyPhen) are what the CSQ INFO field is assembled from, in this order.
CSQ_FIELDS = [
    "Consequence",
    "IMPACT",
    "Hugo_Symbol",
    "Gene",
    "Transcript_ID",
    "BIOTYPE",
    "HGVSc",
    "HGVSp_Short",
    "Protein_position",
    "Amino_acids",
    "SIFT",
    "PolyPhen",
]

CSQ_FORMAT = (
    "Allele|Consequence|IMPACT|SYMBOL|Gene|Feature|BIOTYPE|HGVSc|HGVSp"
    "|Protein_position|Amino_acids|SIFT|PolyPhen"
)


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("mafdir")
    p.add_argument("outfile")
    p.add_argument(
        "--sample-types",
        default="01",
        help="TCGA sample-type codes to keep, comma separated (01 = primary tumor)",
    )
    return p.parse_args(argv)


def maf_paths(mafdir):
    for root, _dirs, files in os.walk(mafdir):
        for f in sorted(files):
            if f.endswith((".maf", ".maf.gz")):
                yield os.path.join(root, f)


def read_maf(path):
    op = gzip.open(path, "rt") if path.endswith(".gz") else open(path)
    with op as fh:
        # the GDC MAF's `#version`/`#contigs`/aliquot preamble sits above the
        # header row, and csv.DictReader would otherwise take it as one
        yield from csv.DictReader(
            (l for l in fh if not l.startswith("#")), delimiter="\t"
        )


def alleles(row):
    """(pos, ref, alt) in VCF form for one MAF row, or None if CONTEXT can't say.

    Three shapes, keyed off which allele the MAF wrote as `-` rather than off
    `Variant_Type`, because a MAF `DEL` whose alt is a real sequence is a
    substitution that happens to shorten the allele and already needs no anchor:

    - insertion (`Reference_Allele` is `-`): Start is the base before the
      inserted sequence, so REF is the anchor and ALT is the anchor plus it
    - deletion (`Tumor_Seq_Allele2` is `-`): Start..End are the deleted bases, so
      the record moves one base left and REF picks up the anchor
    - everything else: the MAF's own coordinates and alleles are already VCF's

    The anchor comes from `CONTEXT[5]` in all three, and CONTEXT is checked
    against the reference allele the row also states, so a row whose context is
    absent or the wrong length is reported rather than silently misplaced.
    """
    start = int(row["Start_Position"])
    ref, alt = row["Reference_Allele"], row["Tumor_Seq_Allele2"]
    ctx = row.get("CONTEXT", "").upper()
    if len(ctx) < 11:
        return None
    anchor = ctx[5]
    if ref == "-":
        return start, anchor, anchor + alt
    if alt == "-":
        return (start - 1, anchor + ref, anchor) if ctx[6:6 + len(ref)] == ref else None
    return (start, ref, alt) if ctx[5:5 + len(ref)] == ref else None


def csq(row):
    """The SnpEff/VEP-style consequence annotation JBrowse colors cells by.

    The MAF already carries VEP's pick for the variant, one transcript per row,
    so this is a re-encoding rather than a re-annotation. `impactColor(feature)`
    scans the annotation for the impact tier and takes the consequence term from
    field 1, which is where VEP's default CSQ order puts them.

    The leading Allele field stays the MAF's own alt, so an indel's allele reads
    `-` as VEP writes it rather than the anchored VCF form.
    """
    return "|".join(
        [row["Tumor_Seq_Allele2"]] + [row.get(f, "") for f in CSQ_FIELDS]
    )


def sample_barcode(row):
    """Aliquot barcode down to the sample barcode.

    TCGA-BH-A18H-01A-11D-A12B-09 -> TCGA-BH-A18H-01A
    """
    return "-".join(row["Tumor_Sample_Barcode"].split("-")[:4])


def collect(mafdir, sample_types):
    """({(chrom, pos, ref, alt): variant}, sorted sample names).

    Keyed by the VCF-form coordinates, so the same mutation called in many tumors
    becomes one record carrying many genotypes.
    """
    variants = {}
    owner = {}  # sample barcode -> the file whose calls it takes
    counts = defaultdict(int)
    for path in sorted(maf_paths(mafdir)):
        counts["files"] += 1
        for row in read_maf(path):
            sample = sample_barcode(row)
            if sample[13:15] not in sample_types:
                counts["wrong sample type"] += 1
                continue
            if owner.setdefault(sample, path) != path:
                counts["replicate aliquot"] += 1
                continue
            if row["Chromosome"] not in CONTIGS:
                counts["other contigs"] += 1
                continue
            resolved = alleles(row)
            if resolved is None:
                counts["unusable CONTEXT"] += 1
                continue
            pos, ref, alt = resolved
            key = (row["Chromosome"], pos, ref, alt)
            v = variants.get(key)
            if v is None:
                v = variants[key] = {"row": row, "calls": {}}
            depth, alt_count = row.get("t_depth", ""), row.get("t_alt_count", "")
            ref_count = row.get("t_ref_count", "")
            v["calls"][sample] = (
                f"0/1:{ref_count},{alt_count}:{depth}"
                if depth and alt_count and ref_count
                else "0/1"
            )
    if not counts["files"]:
        sys.exit(f"{mafdir}: no .maf/.maf.gz files found")
    samples = sorted(s for s, p in owner.items() if s[13:15] in sample_types)
    dropped = ", ".join(
        f"{counts[k]} rows {k}" for k in
        ("wrong sample type", "replicate aliquot", "other contigs", "unusable CONTEXT")
        if counts[k]
    )
    print(f"   {len(variants)} distinct mutations from {counts['files']} MAFs"
          f" across {len(samples)} tumors" + (f" ({dropped})" if dropped else ""))
    return variants, samples


def write_vcf(outfile, variants, samples):
    n = len(samples)
    order = {c: i for i, c in enumerate(CONTIGS)}
    records = sorted(
        ((order[chrom], pos, chrom, ref, alt, v["row"], v["calls"])
         for (chrom, pos, ref, alt), v in variants.items()),
        key=lambda r: (r[0], r[1], r[3], r[4]),
    )

    with open(outfile, "w") as fh:
        fh.write(
            "##fileformat=VCFv4.2\n"
            "##source=maf_to_vcf.py (GDC Masked Somatic Mutation MAF)\n"
            "##reference=GRCh38\n"
            '##INFO=<ID=AC,Number=A,Type=Integer,Description="Tumors carrying the alt allele">\n'
            '##INFO=<ID=AN,Number=1,Type=Integer,Description="Total alleles in the cohort">\n'
            '##INFO=<ID=AF,Number=A,Type=Float,Description="Fraction of tumors carrying the alt allele">\n'
            '##INFO=<ID=NTUMOR,Number=1,Type=Integer,Description="Number of tumors with this mutation">\n'
            '##INFO=<ID=GENE,Number=1,Type=String,Description="MAF Hugo_Symbol">\n'
            '##INFO=<ID=HGVSP,Number=1,Type=String,Description="MAF HGVSp_Short">\n'
            '##INFO=<ID=CLASS,Number=1,Type=String,Description="MAF Variant_Classification">\n'
            '##INFO=<ID=CSQ,Number=.,Type=String,Description="Consequence annotations from the'
            f" MAF's VEP columns. Format: {CSQ_FORMAT}\">\n"
            '##FILTER=<ID=PASS,Description="Passed the GDC somatic mutation filters">\n'
            '##FORMAT=<ID=GT,Number=1,Type=String,Description="0/1 where the tumor\'s MAF reports'
            ' this mutation, else 0/0 (absence of a call, not proven reference)">\n'
            '##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Tumor ref and alt read counts'
            ' (MAF t_ref_count, t_alt_count)">\n'
            '##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Tumor read depth (MAF t_depth)">\n'
        )
        for c in CONTIGS:
            fh.write(f"##contig=<ID={c}>\n")
        fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t"
                 + "\t".join(samples) + "\n")

        for _idx, pos, chrom, ref, alt, row, calls in records:
            ac = len(calls)
            rsid = row.get("dbSNP_RS", "")
            # MAF writes "novel" for a site with no rsID, and can carry several
            ids = ";".join(i for i in rsid.split(",") if i.startswith("rs")) or "."
            info = [
                f"AC={ac}",
                f"AN={2 * n}",
                f"AF={ac / n:.5g}",
                f"NTUMOR={ac}",
                f"GENE={row['Hugo_Symbol']}",
            ]
            if row.get("HGVSp_Short"):
                info.append(f"HGVSP={row['HGVSp_Short']}")
            info.append(f"CLASS={row['Variant_Classification']}")
            info.append(f"CSQ={csq(row)}")
            gts = "\t".join(calls.get(s, "0/0") for s in samples)
            fh.write(f"{chrom}\t{pos}\t{ids}\t{ref}\t{alt}\t.\tPASS\t"
                     + ";".join(info) + f"\tGT:AD:DP\t{gts}\n")
    print(f"   wrote {len(records)} variants x {n} tumors to {outfile}")


def main(argv):
    args = parse_args(argv)
    types = set(args.sample_types.split(","))
    variants, samples = collect(args.mafdir, types)
    write_vcf(args.outfile, variants, samples)


if __name__ == "__main__":
    main(sys.argv[1:])
