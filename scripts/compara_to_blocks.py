#!/usr/bin/env python3
"""Convert an Ensembl Compara homology TSV into the pairwise ortholog tables
`MCScanBlocksAdapter` loads, carrying Compara's per-link measurements as
attribute columns.

Compara publishes one TSV per species holding that species' homologies against
every other, already curated, so a synteny track needs a download rather than an
all-against-all protein search:

  https://ftp.ensembl.org/pub/release-113/tsv/ensembl-compara/homologies/
      homo_sapiens/Compara.113.protein_default.homologies.tsv

Unlike an OrthoFinder or jcvi table, whose cells are bare gene ids, each row here
carries what the orthology inference measured, and those ride out as the
`attributeColumns` the adapter names. `identity` is written as a FRACTION,
because that is the domain the identity ramp is defined on; Compara's own column
is a percent.

Which columns the export fills varies by division: `identity` and
`homology_identity` are always there, `goc_score` on most vertebrate rows and no
plant ones, and `wga_coverage`/`dn`/`ds` on none. Empty columns are still
written, since what is null this release may not be next.

**One table per pair, not one table for N genomes.** A `.blocks` row's attribute
columns describe the ROW, and a per-link measurement is only meaningful where a
row is one link. An N-genome table's row is an orthogroup spanning several pairs,
with no single dN/dS. Stack N genomes off an OrthoFinder or jcvi table; use this
where the measurement is the point.

A reference gene with several orthologs in one genome (`ortholog_one2many`)
becomes several rows, the same choice `orthogroups_to_blocks.py --pick expand`
makes: a cell holds one id, and dropping the rest would draw one confident link
picked by file order. Past `--max-copies` it is a gene family rather than a set
of copies and contributes nothing, which is the same line that script draws.

Requires: python3 only.
Usage:
  python3 compara_to_blocks.py Compara.113.protein_default.homologies.tsv.gz \\
      --reference homo_sapiens=human --species mus_musculus=mouse \\
      --bed human=human.bed --bed mouse=mouse.bed
"""

import argparse
import collections
import gzip
import os
import sys

# The columns read off the header row rather than by position, so a release that
# adds one does not silently shift dS into goc_score.
NEEDED = (
    "gene_stable_id",
    "species",
    "homology_type",
    "homology_gene_stable_id",
    "homology_species",
    "identity",
    "homology_identity",
    "dn",
    "ds",
    "goc_score",
    "wga_coverage",
    "is_high_confidence",
)

# Written after the two gene columns, in this order. Matches the
# `attributeColumns` the printed track config names.
#
# `copies` is not Compara's; it is counted here. It is how many orthologs the
# reference gene has in the partner genome, so every row of a fanned-out gene
# carries the same number. Against a polyploid that number IS the ploidy: a
# diploid outgroup gene answers to three bread-wheat homoeologs, and the genes
# answering to fewer are the ones that lost one.
ATTRS = ("identity", "homology_identity", "dn", "ds", "goc_score",
         "wga_coverage", "copies")

MISSING = {"", ".", "NA", "NULL", "\\N"}


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_kv(values, what):
    for v in values:
        if "=" not in v:
            sys.exit(f"--{what} wants KEY=VALUE, got {v!r}")
    return dict(v.split("=", 1) for v in values)


def read_bed_names(path):
    """Column 4 of a BED, the field the table's ids have to match. Stripped, and
    the line ending taken off before the split: only the last field carries the
    newline, so a BED with the four required columns and no score/strand would
    otherwise resolve every id to nothing."""
    names = set()
    with opener(path) as fh:
        for line in fh:
            if not line.startswith(("#", "track ", "browser ")):
                fields = line.rstrip("\r\n").split("\t")
                if len(fields) > 3 and fields[3].strip():
                    names.add(fields[3].strip())
    return names


def cell(value, scale=1.0):
    """A measurement, or `.` where Compara had none. A missing dS is not a dS of
    zero: the adapter drops the cell so the ratio stays undefined rather than
    reading as total purifying selection."""
    if value in MISSING:
        return "."
    try:
        return f"{float(value) * scale:g}"
    except ValueError:
        return "."


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("homologies", help="Compara homology TSV (plain or .gz)")
    p.add_argument("--reference", required=True, metavar="COMPARA=NAME",
                   help="the species this file is anchored on, and its JBrowse "
                        "assembly name")
    p.add_argument("--species", action="append", required=True,
                   metavar="COMPARA=NAME",
                   help="another species to pair the reference with, and its "
                        "JBrowse assembly name (repeatable)")
    p.add_argument("--bed", action="append", default=[], metavar="NAME=FILE",
                   help="that assembly's BED, to check the ids resolve")
    p.add_argument("--homology-type", action="append", default=[],
                   metavar="TYPE",
                   help="Compara homology_type to keep (repeatable); default "
                        "ortholog_one2one and ortholog_one2many")
    p.add_argument("--high-confidence-only", action="store_true",
                   help="keep only rows Compara flags is_high_confidence")
    p.add_argument("--max-copies", type=int, default=4, metavar="N",
                   help="drop a reference gene with more than N orthologs in "
                        "one partner: that is a gene family rather than a set "
                        "of copies (default 4, 0 to keep every one)")
    p.add_argument("--outdir", default=".")
    args = p.parse_args()

    reference = parse_kv([args.reference], "reference")
    ref_compara, ref_name = next(iter(reference.items()))
    others = parse_kv(args.species, "species")
    bed_files = parse_kv(args.bed, "bed")
    names = [ref_name, *others.values()]
    for name in bed_files:
        if name not in names:
            sys.exit(f"--bed {name!r} is not one of the assemblies {names}")
    keep_types = set(args.homology_type) or {"ortholog_one2one",
                                             "ortholog_one2many"}

    beds = {n: read_bed_names(f) for n, f in bed_files.items()}
    os.makedirs(args.outdir, exist_ok=True)

    # The input is streamed, but the OUTPUT rows are held: `copies` counts a
    # reference gene's orthologs in one partner, and that total is only known
    # once its last row has been read. A pairwise table is tens of thousands of
    # rows against an input of millions, so what is held is the small end.
    rows = collections.defaultdict(list)
    copies = collections.Counter()
    # the reference is tracked in the same two dicts as its partners, so the
    # report below has one shape rather than a special case for column 0
    seen = {n: set() for n in names}
    placed = {n: set() for n in names}
    counts = {"rows": 0, "kept": 0, "unresolved": 0}
    with opener(args.homologies) as fh:
        header = fh.readline().rstrip("\n").split("\t")
        index = {}
        for column in NEEDED:
            if column not in header:
                sys.exit(f"{args.homologies} has no {column!r} column; its "
                         f"header is {header}")
            index[column] = header.index(column)
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) < len(header):
                continue
            counts["rows"] += 1
            if f[index["species"]] != ref_compara:
                continue
            other = others.get(f[index["homology_species"]])
            if other is None or f[index["homology_type"]] not in keep_types:
                continue
            if args.high_confidence_only and \
                    f[index["is_high_confidence"]] != "1":
                continue
            ref_gene = f[index["gene_stable_id"]]
            other_gene = f[index["homology_gene_stable_id"]]
            ok = True
            for name, gene in ((ref_name, ref_gene), (other, other_gene)):
                seen[name].add(gene)
                if name in beds and gene not in beds[name]:
                    ok = False
                else:
                    placed[name].add(gene)
            if not ok:
                counts["unresolved"] += 1
                continue
            # identity as a fraction: the ramp's domain, not Compara's percent
            rows[other].append([
                ref_gene, other_gene,
                cell(f[index["identity"]], 0.01),
                cell(f[index["homology_identity"]], 0.01),
                cell(f[index["dn"]]),
                cell(f[index["ds"]]),
                cell(f[index["goc_score"]]),
                cell(f[index["wga_coverage"]], 0.01),
            ])
            copies[other, ref_gene] += 1
            counts["kept"] += 1
    # A gene with dozens of "orthologs" in one genome is a family, not a set of
    # copies, and it is not only noise: `copies` has no declared domain, so an
    # attribute mode scales to what it sees, and one gene at 68 pushes the 1-vs-3
    # distinction the polyploid case is about into the bottom twentieth of the
    # ramp. Dropped rather than clamped, so the count stays a count.
    counts["families"] = 0
    written = collections.Counter()
    for other, table in rows.items():
        with open(os.path.join(args.outdir,
                               f"{ref_name}.{other}.blocks"), "w") as out:
            for cells in table:
                n = copies[other, cells[0]]
                if args.max_copies and n > args.max_copies:
                    counts["families"] += 1
                    continue
                # the count goes on last, once every row for the gene was read
                out.write("\t".join([*cells, str(n)]) + "\n")
                written[other] += 1

    def share(name):
        if name not in beds:
            return f"  {name}: {len(seen[name])} ids, unchecked (pass --bed {name}=FILE)"
        total, kept = len(seen[name]), len(placed[name])
        pct = f"{kept * 100 // total}%" if total else "no ids"
        return (f"  {name}: {kept}/{total} ids ({pct}) placed by "
                f"{bed_files[name]}")

    dead = [n for n in names if n in beds and seen[n] and not placed[n]]
    placed_report = "\n".join(share(n) for n in names)
    # Before the no-rows check below, not after: a BED keyed on the wrong ids
    # rejects every row, which leaves no table written and otherwise reports as
    # "nothing matched your species filter" — the one diagnosis that sends the
    # reader to look at the species names, which were right.
    if dead:
        sys.exit(f"genes placed per assembly:\n{placed_report}\n\n"
                 f"{', '.join(dead)}: the BED places none of the ids Compara "
                 f"names, which is an id mismatch and not a biological result. "
                 f"Compara keys on Ensembl gene stable ids (ENSG..., ENSMUSG...), "
                 f"so BED column 4 has to carry those rather than transcript or "
                 f"protein ids.")

    if not rows:
        sys.exit(f"no rows matched: reference species {ref_compara!r}, "
                 f"homology types {sorted(keep_types)}, partners "
                 f"{sorted(others)}. Check those against the file's own values.")

    # `rows` is filled before --max-copies runs, so the guard above passes and
    # the filter can still leave a table with nothing in it. A zero-byte .blocks
    # indexes and loads fine and draws a blank track, which is the same silent
    # wrong picture --max-copies exists to prevent — so an emptied table is
    # named, and an entirely emptied run is fatal rather than an exit 0 over
    # files nothing will report on again.
    empty = [n for n in rows if not written[n]]
    if len(empty) == len(rows):
        sys.exit(f"--max-copies {args.max_copies} dropped every row: each of "
                 f"{', '.join(sorted(empty))} has more than {args.max_copies} "
                 f"orthologs per reference gene throughout. Raise it, or pass "
                 f"0 to keep every copy.")

    # only when the filter is on: "0 dropped for a gene with more than 0
    # orthologs" is what `--max-copies 0` otherwise reports, which reads as a
    # threshold of zero rather than as the filter being off
    families = (f", {counts['families']} for a gene with more than "
                f"{args.max_copies} orthologs in one partner"
                if args.max_copies else "")
    # a blank track among several is as silent as a blank run
    emptied = (f"\n{', '.join(sorted(empty))}: emptied by --max-copies, written "
               f"as a 0-byte table that will load as a blank track"
               if empty else "")
    print(f"wrote {len(rows)} table(s) from {counts['rows']} rows: "
          f"{counts['kept'] - counts['families']} links kept, "
          f"{counts['unresolved']} dropped for an id neither BED places"
          f"{families}{emptied}"
          f"\ngenes placed per assembly:\n{placed_report}",
          file=sys.stderr)
    print(" ".join(ATTRS))


if __name__ == "__main__":
    main()
