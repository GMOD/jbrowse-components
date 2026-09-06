#!/usr/bin/env python3
"""Convert an odp `.rbh` ortholog table into the MCScanBlocksAdapter table
JBrowse loads as an N-genome synteny track, plus one BED per species.

An `.rbh` is one row per ortholog set with, per species `SP`, the columns
`SP_gene`, `SP_scaf` and `SP_pos`. The species are read off the header in the
order the columns appear, or in `--species` order when given, and the first
one is the anchor column. A missing cell (empty or `nan`) becomes `.`.

**The linkage-group label rides in the table.** odp writes `gene_group` and a
per-group `color` on the tables it has colored, and both go out unchanged as
the attribute columns after the gene columns, which is what the track's
`attributeColumns` names. A table odp has not colored (a raw `odp_nway_rbh`
output) has neither, so `--alg` joins them in from a colored table that shares
a species: the ortholog's gene id in that species looks up its group. The
join rate is printed, and a row with no group gets `.`, which the display
paints as missing rather than as a group of its own.

**Gene intervals come from the `.chrom`, not from `_pos`.** `_pos` is one
coordinate per gene, and a BED made from it alone is a 1 bp feature the
browser cannot show as a gene. odp's `.chrom` (protein, scaffold, strand,
start, stop; 1-based inclusive) has the real interval, so `--chrom SP=FILE`
writes that species' BED from it and reports what share of the table's ids it
resolved. A species with no `.chrom` falls back to the 1 bp `_pos` interval,
and says so. A column that resolves none of its ids against its `.chrom` is an
id mismatch rather than a biological result, so that exits non-zero.

Requires: python3 only.
Usage:
  python3 rbh_to_blocks.py table.rbh -o alg.blocks --bed-dir beds \\
      [--species COW HCA EMU RES] [--chrom RES=rhopilema.chrom ...] \\
      [--alg BCnSSimakov2022.rbh] [--attributes gene_group color]
"""

import argparse
import csv
import os
import sys

MISSING = {"", "nan", "NA", "NULL", ".", "None"}


def read_table(path):
    with open(path, newline="") as fh:
        rows = list(csv.reader(fh, delimiter="\t"))
    return rows[0], rows[1:]


def species_of(header):
    return [c[: -len("_scaf")] for c in header if c.endswith("_scaf")]


def cell(row, index):
    value = row[index].strip() if index < len(row) else ""
    return "" if value in MISSING else value


def read_chrom(path):
    """protein, scaffold, strand, start, stop; the gene id keyed to its BED
    fields. 1-based inclusive in, 0-based half-open out."""
    genes = {}
    with open(path) as fh:
        for line in fh:
            fields = line.rstrip("\r\n").split("\t")
            if len(fields) >= 5 and fields[0]:
                protein, scaffold, strand, start, stop = fields[:5]
                genes[protein] = (scaffold, int(start) - 1, int(stop), strand)
    return genes


def alg_lookup(path, species):
    """gene id in `species` -> (gene_group, color) off a colored table."""
    header, rows = read_table(path)
    gene = header.index(f"{species}_gene")
    group = header.index("gene_group")
    color = header.index("color") if "color" in header else None
    return {
        cell(r, gene): (cell(r, group), cell(r, color) if color is not None else "")
        for r in rows
        if cell(r, gene) and cell(r, group)
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("rbh")
    ap.add_argument("-o", "--out", required=True, help="the .blocks to write")
    ap.add_argument("--bed-dir", required=True, help="one SP.bed per species goes here")
    ap.add_argument("--species", nargs="*", help="species codes, anchor first; default is the header's order")
    ap.add_argument("--chrom", nargs="*", default=[], metavar="SP=FILE", help="odp .chrom per species, for real gene intervals")
    ap.add_argument("--alg", help="a colored .rbh to take gene_group and color from, joined by a shared species' gene ids")
    ap.add_argument("--alg-species", metavar="SP[=ALGSP]", help="the species to join --alg on, and its code in the --alg table where the two differ (RESLi=RES); default is the first code the two tables share")
    ap.add_argument("--attributes", nargs="*", default=["gene_group", "color"], help="attribute columns to carry, in order")
    args = ap.parse_args()

    header, rows = read_table(args.rbh)
    species = args.species or species_of(header)
    for sp in species:
        if f"{sp}_gene" not in header:
            sys.exit(f"{args.rbh} has no {sp}_gene column; it has {species_of(header)}")
    chroms = {}
    for kv in args.chrom:
        if "=" not in kv:
            sys.exit(f"--chrom wants SP=FILE, got {kv!r}")
        sp, path = kv.split("=", 1)
        chroms[sp] = read_chrom(path)

    lookup = None
    if args.alg:
        alg_header, _ = read_table(args.alg)
        shared = [s for s in species if s in species_of(alg_header)]
        if args.alg_species:
            join_on, _, alg_code = args.alg_species.partition("=")
            alg_code = alg_code or join_on
        elif shared:
            join_on = alg_code = shared[0]
        else:
            sys.exit(f"--alg {args.alg} shares no species code with {args.rbh}; name the pair with --alg-species SP=ALGSP")
        if join_on not in species:
            sys.exit(f"--alg-species {join_on} is not a column of {args.rbh}")
        lookup = (join_on, alg_lookup(args.alg, alg_code))

    gene_col = {sp: header.index(f"{sp}_gene") for sp in species}
    scaf_col = {sp: header.index(f"{sp}_scaf") for sp in species}
    pos_col = {sp: header.index(f"{sp}_pos") for sp in species}
    attr_col = {a: header.index(a) for a in args.attributes if a in header}

    os.makedirs(args.bed_dir, exist_ok=True)
    beds = {sp: {} for sp in species}
    seen = {sp: 0 for sp in species}
    resolved = {sp: 0 for sp in species}
    joined = 0
    with open(args.out, "w") as out:
        for row in rows:
            genes = [cell(row, gene_col[sp]) for sp in species]
            if lookup:
                sp, table = lookup
                group, color = table.get(cell(row, gene_col[sp]), ("", ""))
                joined += bool(group)
                attrs = {"gene_group": group, "color": color}
            else:
                attrs = {a: cell(row, attr_col[a]) for a in attr_col}
            for sp, gene in zip(species, genes):
                if gene:
                    seen[sp] += 1
                    if sp in chroms:
                        hit = chroms[sp].get(gene)
                        if hit:
                            resolved[sp] += 1
                            beds[sp][gene] = hit
                    else:
                        scaf, pos = cell(row, scaf_col[sp]), cell(row, pos_col[sp])
                        if scaf and pos:
                            resolved[sp] += 1
                            beds[sp][gene] = (scaf, int(float(pos)) - 1, int(float(pos)), "+")
            out.write(
                "\t".join([g or "." for g in genes] + [attrs.get(a) or "." for a in args.attributes])
                + "\n"
            )

    for sp in species:
        with open(os.path.join(args.bed_dir, f"{sp}.bed"), "w") as fh:
            for gene, (scaf, start, end, strand) in sorted(beds[sp].items(), key=lambda kv: (kv[1][0], kv[1][1])):
                fh.write(f"{scaf}\t{start}\t{end}\t{gene}\t0\t{strand}\n")
        how = "from its .chrom" if sp in chroms else "as 1 bp points from _pos, no --chrom given"
        print(f"{sp}: {resolved[sp]}/{seen[sp]} ids resolved {how}", file=sys.stderr)
        if seen[sp] and not resolved[sp]:
            sys.exit(f"{sp}: none of its ids resolve; the .chrom and the table name genes differently")
    if lookup:
        print(f"gene_group joined on {lookup[0]}: {joined}/{len(rows)} rows", file=sys.stderr)
    print(" ".join(species))


if __name__ == "__main__":
    main()
