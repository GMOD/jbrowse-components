#!/usr/bin/env python3
"""Convert an OrthoFinder `Orthogroups.tsv` into the MCScanBlocksAdapter table
JBrowse loads as an N-genome synteny track.

Orthogroups.tsv is already one row per orthogroup and one column per genome. It
needs the header and the leading `Orthogroup` id column dropped, each cell
reduced to a gene id, and an empty cell marked `.`. The header row is the column
order, so `blockAssemblies` is read off the file rather than reconstructed from
the order the proteomes were passed to OrthoFinder.

**A duplicated gene becomes several rows, not one arbitrary choice.** A cell
holds every gene of that genome in the orthogroup, and a link is one gene to one
gene, so a cell with two genes has no single correct answer. Taking the first
one listed picks by whatever order OrthoFinder wrote and hides the duplication,
which in a polyploid is the thing worth seeing: one rice gene against two maize
copies should draw two ribbons. So `--pick expand` (the default) emits one row
per copy, and every direct link (column 0 to another column) is written. Rows
are index-paired across columns rather than multiplied out, so an orthogroup
costs rows equal to its largest cell, not their product. A cell with more than
`--max-copies` genes is a gene family rather than a duplication and is left
empty.

`--pick single` empties any multi-gene cell instead, for a strictly one-to-one
table; `--pick first` is the arbitrary choice, if you want the coverage.

`--bed NAME=FILE` reports how many of each column's ids the BED resolves and
drops the rest. OrthoFinder ids come from the protein FASTA headers, so they are
whatever those headers led with, and a table whose ids resolve nowhere loads
without an error and draws nothing. That is the failure this makes visible.

Requires: python3 only.
Usage:
  python3 orthogroups_to_blocks.py Orthogroups.tsv -o rice.blocks \\
      [--assembly rice.pep=rice] [--bed rice=rice.bed] [--pick single]
"""

import argparse
import gzip
import os
import sys


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_kv(values, what):
    for v in values:
        if "=" not in v:
            sys.exit(f"--{what} wants KEY=VALUE, got {v!r}")
    return dict(v.split("=", 1) for v in values)


def read_bed_names(path):
    with opener(path) as fh:
        return {f[3] for f in (line.split("\t") for line in fh) if len(f) > 3}


def column_names(header, assemblies):
    """The genome per column. OrthoFinder names a column after the proteome file
    it read, so `rice.pep` and `rice.pep.fa` both mean rice; the extensions come
    off and --assembly renames what is left."""
    out = []
    for raw in header:
        name = raw.strip()
        while os.path.splitext(name)[1]:
            name = os.path.splitext(name)[0]
        out.append(assemblies.get(raw.strip(), assemblies.get(name, name)))
    return out


def cell_genes(cell, known, max_copies):
    """The gene ids a cell offers: those its BED resolves, unless there are so
    many that the orthogroup is a family rather than a set of copies."""
    genes = [g.strip() for g in cell.split(",") if g.strip()]
    if known is not None:
        genes = [g for g in genes if g in known]
    return [] if len(genes) > max_copies else genes


def orthogroup_rows(cells, pick, max_copies, beds):
    """The table rows one orthogroup contributes."""
    copies = [cell_genes(c, beds[i], max_copies) for i, c in enumerate(cells)]
    if pick == "first":
        copies = [g[:1] for g in copies]
    elif pick == "single":
        copies = [g if len(g) == 1 else [] for g in copies]
    width = max((len(g) for g in copies), default=0)
    # index-paired, so a column with one gene repeats it against each copy in
    # the duplicated column rather than multiplying the row count out
    rows = [[g[i % len(g)] if g else "." for g in copies] for i in range(width)]
    return [r for r in rows if sum(g != "." for g in r) > 1]


def build_rows(lines, pick, beds, max_copies):
    """([row, ...], counts) from the lines of an Orthogroups.tsv, header first."""
    header = next(lines).rstrip("\n").split("\t")[1:]
    rows = []
    counts = {"orthogroups": 0, "expanded": 0, "resolved": [0] * len(header)}
    for line in lines:
        cells = line.rstrip("\n").split("\t")[1:]
        cells += [""] * (len(header) - len(cells))
        counts["orthogroups"] += 1
        new = orthogroup_rows(cells, pick, max_copies, beds)
        counts["expanded"] += len(new) > 1
        for row in new:
            for i, gene in enumerate(row):
                counts["resolved"][i] += gene != "."
        rows += new
    return rows, header, counts


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("orthogroups", help="OrthoFinder Orthogroups.tsv (plain or .gz)")
    p.add_argument("-o", "--out", required=True, help="output .blocks table")
    p.add_argument("--assembly", action="append", default=[], metavar="COLUMN=NAME",
                   help="rename an OrthoFinder column to its JBrowse assembly")
    p.add_argument("--bed", action="append", default=[], metavar="NAME=FILE",
                   help="that column's BED, to check the ids resolve")
    p.add_argument("--pick", choices=["expand", "single", "first"], default="expand",
                   help="what a multi-gene cell contributes: a row per copy "
                        "(default), nothing, or the first gene listed")
    p.add_argument("--max-copies", type=int, default=4, metavar="N",
                   help="a cell with more genes than this is a gene family, "
                        "and contributes nothing")
    args = p.parse_args()

    assemblies = parse_kv(args.assembly, "assembly")
    bed_files = parse_kv(args.bed, "bed")
    with opener(args.orthogroups) as fh:
        columns = column_names(fh.readline().rstrip("\n").split("\t")[1:], assemblies)
        for name in bed_files:
            if name not in columns:
                sys.exit(f"--bed {name!r} is not one of the columns {columns}")
        beds = [read_bed_names(bed_files[c]) if c in bed_files else None
                for c in columns]
        fh.seek(0)
        rows, _, counts = build_rows(iter(fh), args.pick, beds, args.max_copies)

    with open(args.out, "w") as fh:
        fh.writelines("\t".join(r) + "\n" for r in rows)

    resolved = ", ".join(f"{c} {n}" for c, n in zip(columns, counts["resolved"]))
    print(f"wrote {args.out}: {len(rows)} rows from {counts['orthogroups']} "
          f"orthogroups, {counts['expanded']} of which hold a duplicated gene "
          f"and became several rows\ngenes resolved per column: {resolved}\n"
          f"blockAssemblies: {columns}", file=sys.stderr)
    # The one line on stdout: the resolved column order, for a caller building a
    # blockAssemblies/bedLocations list to capture instead of assuming its own
    # proteome order matches this file's columns.
    print(" ".join(columns))


if __name__ == "__main__":
    main()
