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

Each expanded row carries the un-duplicated columns' genes too, since the
duplicated column's later copies would otherwise have nothing to link to, so a
pair not touching the duplication is named once per row. The format has no way
to say it once, and `MCScanBlocksAdapter` draws a gene pair once however many
rows name it, which is where that is settled.

`--pick single` empties any multi-gene cell instead, for a strictly one-to-one
table; `--pick first` is the arbitrary choice, if you want the coverage.

`--bed NAME=FILE` reports what share of each column's ids the BED resolves and
drops the rest. OrthoFinder ids come from the protein FASTA headers, so they are
whatever those headers led with, and a table whose ids resolve nowhere loads
without an error and draws nothing. That is the failure this makes visible: a
column resolving none of its ids is an id mismatch rather than a biological
result, so it exits non-zero instead of writing a table with one dead genome in
it. The share needs both numbers to be readable, which is why a column with no
`--bed` is reported as unchecked rather than as a count that looks the same.

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
    """Column 4 of a BED, the field the table's ids have to match.

    Stripped, and the line ending taken off before the split: only the last
    field carries the newline, so a BED with the four required columns and no
    score/strand put it on the name and resolved every id in that column to
    nothing, which is the exact failure this check exists to report."""
    names = set()
    with opener(path) as fh:
        for line in fh:
            if not line.startswith(("#", "track ", "browser ")):
                fields = line.rstrip("\r\n").split("\t")
                if len(fields) > 3 and fields[3].strip():
                    names.add(fields[3].strip())
    return names


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
    """The gene ids a cell offers, and whether --max-copies is what emptied it.

    A cell whose BED resolves none of its genes and a cell dropped as a family
    both come back empty, and only the second is worth counting: the first is
    already the per-column placement share below."""
    genes = [g.strip() for g in cell.split(",") if g.strip()]
    if known is not None:
        genes = [g for g in genes if g in known]
    return ([], True) if len(genes) > max_copies else (genes, False)


def orthogroup_rows(cells, pick, max_copies, beds, counts=None):
    """The table rows one orthogroup contributes."""
    picked = [cell_genes(c, beds[i], max_copies) for i, c in enumerate(cells)]
    copies = [genes for genes, _ in picked]
    if counts is not None:
        counts["families"] += sum(1 for _, family in picked if family)
    if pick == "first":
        copies = [g[:1] for g in copies]
    elif pick == "single":
        copies = [g if len(g) == 1 else [] for g in copies]
    width = max((len(g) for g in copies), default=0)
    # index-paired, so a column with one gene repeats it against each copy in
    # the duplicated column rather than multiplying the row count out
    rows = [[g[i % len(g)] if g else "." for g in copies] for i in range(width)]
    return [r for r in rows if sum(g != "." for g in r) > 1]


def build_rows(lines, columns, pick, beds, max_copies):
    """([row, ...], seen, resolved, counts) from an Orthogroups.tsv body.

    `seen` and `resolved` are per column and hold DISTINCT gene ids: the ids the
    table offers, and the subset its BED places. Counting output cells instead
    over-reports, because `expand` repeats a single-copy gene once per copy of
    the duplicated column beside it, and gives a bare number with nothing to
    read it against — the share is the diagnostic, so both halves are kept."""
    rows = []
    seen = [set() for _ in columns]
    resolved = [set() for _ in columns]
    counts = {"orthogroups": 0, "expanded": 0, "families": 0}
    for line in lines:
        # padded AND truncated to the header's width, once. A row wider than the
        # header used to reach orthogroup_rows whole while the report below saw
        # only the first len(columns) cells, so the stray cell was indexed
        # against a `beds` list that has one entry per column: IndexError, on a
        # file that had already been read.
        cells = line.rstrip("\n").split("\t")[1:]
        cells = (cells + [""] * len(columns))[: len(columns)]
        counts["orthogroups"] += 1
        for i, cell in enumerate(cells):
            for gene in (g.strip() for g in cell.split(",")):
                if gene:
                    seen[i].add(gene)
                    if beds[i] is None or gene in beds[i]:
                        resolved[i].add(gene)
        new = orthogroup_rows(cells, pick, max_copies, beds, counts)
        counts["expanded"] += len(new) > 1
        rows += new
    return rows, seen, resolved, counts


def report_columns(columns, bed_files, seen, resolved):
    """The per-column line to read before loading anything, and the columns that
    are an id mismatch rather than a result.

    A column whose BED places none of its ids still loads: the other columns
    resolve, so the track draws and only that genome's bands are empty. Nothing
    downstream can tell that from a genome with no orthologs here, so it is
    settled at the one point that can see both numbers."""
    lines = []
    dead = []
    for i, column in enumerate(columns):
        if column not in bed_files:
            lines.append(f"  {column}: {len(seen[i])} ids, unchecked "
                         f"(pass --bed {column}=FILE)")
            continue
        total, kept = len(seen[i]), len(resolved[i])
        share = f"{kept * 100 // total}%" if total else "no ids"
        lines.append(f"  {column}: {kept}/{total} ids ({share}) placed by "
                     f"{bed_files[column]}")
        if total and not kept:
            dead.append(column)
    return "\n".join(lines), dead


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
        # the header is already consumed, so the rest of the handle is the body
        rows, seen, resolved, counts = build_rows(
            fh, columns, args.pick, beds, args.max_copies)

    placed, dead = report_columns(columns, bed_files, seen, resolved)
    if dead:
        sys.exit(f"genes placed per column:\n{placed}\n\n"
                 f"{', '.join(dead)}: the BED places none of the ids this "
                 f"column holds, which is an id mismatch and not a biological "
                 f"result. OrthoFinder takes an id from the first token of a "
                 f"protein FASTA header; BED column 4 has to carry that same "
                 f"id byte for byte. Nothing downstream can report this - the "
                 f"other columns resolve, so the track loads and only this "
                 f"genome's bands are empty.")

    with open(args.out, "w") as fh:
        fh.writelines("\t".join(r) + "\n" for r in rows)

    # named rather than left implicit, the same as compara_to_blocks.py: a cell
    # over --max-copies contributes nothing, so a threshold set too low for the
    # ploidy in the set empties the very cells the table exists to show and looks
    # exactly like a genome with fewer orthologs
    families = (f", {counts['families']} dropped as a gene family (a cell with "
                f"more than {args.max_copies} copies)" if counts["families"]
                else "")
    print(f"wrote {args.out}: {len(rows)} rows from {counts['orthogroups']} "
          f"orthogroups, {counts['expanded']} of which hold a duplicated gene "
          f"and became several rows{families}\ngenes placed per column:\n{placed}\n"
          f"blockAssemblies: {columns}", file=sys.stderr)
    # The one line on stdout: the resolved column order, for a caller building a
    # blockAssemblies/bedLocations list to capture instead of assuming its own
    # proteome order matches this file's columns.
    print(" ".join(columns))


if __name__ == "__main__":
    main()
