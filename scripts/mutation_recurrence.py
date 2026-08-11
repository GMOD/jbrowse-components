#!/usr/bin/env python3
"""Collapse a cohort somatic-mutation VCF into a per-gene recurrence bedGraph:
per gene, what percent of the cohort carries a mutation in it.

Input is the multi-sample VCF built by build_tcga_cohort_mutations.sh, whose
INFO carries the MAF's own gene symbol and VEP annotation:

    chr17  7670684  .  C  G  ...  GENE=TP53;CLASS=Missense_Mutation;CSQ=G|missense_variant|MODERATE|TP53|...

Output is one interval per gene, spanning that gene's called sites, valued in
percent of the cohort:

    #chrom  start    end      mutated
    chr17   7670607  7676593  34.42

This is the mutation counterpart of cnv_recurrence.py, and exists for the same
reason: the matrix display encodes a group's mutation rate as how dark its band
is, and density is exactly the channel that fails when the groups are different
sizes. A band 3.8x taller carrying the same number of marks is 3.8x sparser and
reads as comparable. A bar on a pinned axis does not have that problem.

With --groups the same tally runs once per clinical group and each group gets
its own column, which a BedGraphTabixAdapter exposes as one signal per column
and a MultiQuantitativeTrack draws as one row per signal:

    #chrom  start    end      HR+/HER2-  HER2+  triple-negative  unknown
    chr17   7670607  7676593  20         40.83  82.52            33.07

The denominator is every sample in the VCF (or in the group), not the samples
with a call: a MAF records no coverage for sites its caller did not call, so
`0/0` is an absence of a call rather than a proven reference base and there is
no per-site coverage mask to take. Every tumor in the cohort was exome
sequenced, so the denominator is the cohort.

A gene is counted once per tumor however many times it was called there, so the
value is the percent of tumors carrying any qualifying mutation in the gene and
never the mutation count.

Usage: mutation_recurrence.py IN.vcf[.gz] OUT.bedGraph [--impact LIST]
                              [--min-tumors N] [--groups SAMPLES.tsv:COLUMN]
                              [--min-group N]
"""
import argparse
import gzip
import sys
from collections import defaultdict

# VEP's IMPACT tiers, coarsest first. HIGH is the truncating class (frameshift,
# nonsense, splice acceptor/donor), MODERATE is missense and inframe indels;
# LOW and MODIFIER are the synonymous, UTR and intronic calls a recurrence
# figure should not count as hits.
IMPACT_TIERS = ("HIGH", "MODERATE", "LOW", "MODIFIER")

# Field positions in the CSQ that maf_to_vcf.py writes:
# allele|consequence|IMPACT|SYMBOL|gene|transcript|biotype|HGVSc|HGVSp|...
CSQ_IMPACT = 2


def open_maybe_gz(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("infile")
    p.add_argument("outfile")
    p.add_argument("--impact", default="HIGH,MODERATE",
                   help="comma-separated VEP IMPACT tiers that count as a hit,"
                        " or 'all' to count every call (default HIGH,MODERATE:"
                        " the tiers the matrix display's own consequence-impact"
                        " coloring draws in a color rather than in grey)")
    p.add_argument("--min-tumors", type=int, default=2,
                   help="drop genes mutated in fewer than this many tumors,"
                        " whose percentages are one tumor's worth of signal")
    p.add_argument("--groups", metavar="SAMPLES.tsv:COLUMN",
                   help="tally each group of a samples TSV separately, into its"
                        " own column; the TSV's first column is the sample name")
    p.add_argument("--min-group", type=int, default=20,
                   help="with --groups, skip groups with fewer than this many"
                        " samples in the VCF, whose percentages would be noise")
    return p.parse_args(argv)


def read_group_map(spec):
    """{sample: group label} from a `PATH:COLUMN` samples TSV spec.

    The same TSV the variant track loads as `samplesTsvLocation` and the same
    spec cnv_recurrence.py takes, so a tumor falls in the same group in all
    three tracks without a second table.
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


def parse_info(field):
    """INFO string to dict. Valueless keys map to the empty string."""
    out = {}
    for part in field.split(";"):
        key, sep, value = part.partition("=")
        out[key] = value if sep else ""
    return out


def read_mutations(path, impacts):
    """Per (chrom, gene): the span of its qualifying calls and the set of tumor
    indices carrying one, plus the VCF's sample names.

    Streamed rather than held, because the cohort VCF is one row per distinct
    mutation by one column per tumor and the genotype columns are most of the
    file. Only the per-gene carrier sets survive the pass.
    """
    samples = []
    genes = {}
    n_records = 0
    n_counted = 0
    with open_maybe_gz(path) as fh:
        for line in fh:
            if line.startswith("##"):
                continue
            f = line.rstrip("\n").split("\t")
            if line.startswith("#CHROM"):
                samples = f[9:]
                continue
            n_records += 1
            info = parse_info(f[7])
            gene = info.get("GENE")
            if not gene:
                continue
            if impacts is not None:
                csq = info.get("CSQ", "").split("|")
                if len(csq) <= CSQ_IMPACT or csq[CSQ_IMPACT] not in impacts:
                    continue
            n_counted += 1
            # VCF POS is 1-based inclusive against BED's 0-based half-open, and
            # a REF longer than one base (the anchored form of a deletion)
            # covers that many reference bases from there.
            start = int(f[1]) - 1
            end = start + len(f[3])
            key = (f[0], gene)
            entry = genes.get(key)
            if entry is None:
                entry = genes[key] = [start, end, set()]
            else:
                entry[0] = min(entry[0], start)
                entry[1] = max(entry[1], end)
            carriers = entry[2]
            for i, gt in enumerate(f[9:]):
                # `.` and `./.` are absent calls, `0/0` is the MAF reporting no
                # mutation here; everything else names an alt allele
                code = gt.partition(":")[0]
                if code and code not in ("0/0", "./.", "."):
                    carriers.add(i)
    return genes, samples, n_records, n_counted


def resolve_groups(samples, group_map, min_group):
    """([(label, size)], group index per sample), largest group first.

    Ungrouped (no --groups) is the one-group case with an empty label, which is
    what keeps the default output a single `mutated` column.
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


def clip_overlaps(rows):
    """Trim overlapping gene spans so the output is a valid bedGraph.

    Genes overlap on the genome (nested genes, readthrough loci, opposite
    strands sharing a UTR) and a bedGraph is a step function, so two intervals
    covering the same base have no defined value there. The later-starting span
    is pulled forward to the earlier one's end, and one that would be emptied by
    that is dropped rather than emitted zero-length.

    Trimming the span rather than the value keeps every gene's percentage
    exactly what was tallied: the span is only ever where the gene's calls were
    found, so shortening it moves the bar's left edge and never its height.
    """
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    out = []
    clipped = 0
    end_of = {}
    for chrom, start, end, values, gene in rows:
        prev_end = end_of.get(chrom, 0)
        if start < prev_end:
            clipped += 1
            start = prev_end
            if start >= end:
                continue
        end_of[chrom] = end
        out.append((chrom, start, end, values, gene))
    return out, clipped


def main(argv):
    args = parse_args(argv)
    impacts = None if args.impact == "all" else set(args.impact.upper().split(","))
    if impacts is not None:
        unknown = impacts - set(IMPACT_TIERS)
        if unknown:
            sys.exit(f"--impact: unknown tier {', '.join(sorted(unknown))}"
                     f" (known: {', '.join(IMPACT_TIERS)})")
    group_map = read_group_map(args.groups) if args.groups else None

    genes, samples, n_records, n_counted = read_mutations(args.infile, impacts)
    if not samples:
        sys.exit(f"{args.infile}: no samples found")
    if not genes:
        sys.exit(f"{args.infile}: no records carry a GENE= INFO field")
    groups, group_of_sample = resolve_groups(samples, group_map, args.min_group)
    if not groups:
        sys.exit(f"{args.infile}: no group reaches --min-group {args.min_group}")

    rows = []
    thin = 0
    for (chrom, gene), (start, end, carriers) in genes.items():
        if len(carriers) < args.min_tumors:
            thin += 1
            continue
        counts = [0] * len(groups)
        for i in carriers:
            g = group_of_sample[i]
            if g >= 0:
                counts[g] += 1
        values = tuple(round(100 * c / n, 2) for c, (_, n) in zip(counts, groups))
        rows.append((chrom, start, end, values, gene))

    rows, clipped = clip_overlaps(rows)

    columns = [g or "mutated" for g, _ in groups]
    with open(args.outfile, "w") as fh:
        fh.write("#chrom\tstart\tend\t" + "\t".join(columns) + "\n")
        for chrom, start, end, values, _ in rows:
            fh.write(f"{chrom}\t{start}\t{end}\t"
                     + "\t".join(f"{v:g}" for v in values) + "\n")

    scope = (f" in {len(groups)} groups ("
             + ", ".join(f"{g} {n}" for g, n in groups) + ")") if args.groups else ""
    kept = "every call" if impacts is None else "+".join(
        t for t in IMPACT_TIERS if t in impacts)
    print(f"   {len(rows)} genes from {n_counted} of {n_records} mutations"
          f" ({kept}) across {len(samples)} tumors{scope}"
          f" ({thin} genes under --min-tumors {args.min_tumors},"
          f" {clipped} spans clipped where genes overlap)")


if __name__ == "__main__":
    main(sys.argv[1:])
