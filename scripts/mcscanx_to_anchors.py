#!/usr/bin/env python3
"""Convert an MCScanX run into the jcvi/MCScan files JBrowse loads: a pairwise
`.anchors` and `.anchors.simple`, or for three or more genomes a `.blocks`
ortholog table, plus one BED per genome.

MCScanX writes one `.collinearity` holding every block it found, self-synteny
and cross-species together, and tells the genomes apart only by the two-letter
tag it requires on each chromosome name in its `.gff`. MCScanAnchorsAdapter,
MCScanSimpleAnchorsAdapter and MCScanBlocksAdapter want one file per genome pair
or per reference genome, plus BEDs resolving gene ids to coordinates, which is
what jcvi emits.

`--species` given twice writes the two anchor files; given more, it writes
`<first>.blocks`, anchored on the first genome as MCScanBlocksAdapter's column
0. Only a pair including that reference can fill a cell there, since the adapter
joins the other columns through it. Given once, it writes the anchor files for
that genome against itself, which is what MCScanX's whole-genome-duplication use
produces: load them as a self-alignment track naming the assembly twice.

Three things the two disagree on:

* **Chromosome names.** MCScanX demands the tag (`at1`), the assembly does not.
  It is stripped by default; `--chr-prefix peach=Pp0` puts the real refName
  back, `--keep-chr-tag` leaves it alone. BED column 1 has to match the assembly
  byte for byte.
* **Strand.** MCScanX's `.gff` has no strand column, so every `.anchors` pair
  would draw as collinear. `--strand-gff3 peach=peach.gff3.gz` recovers it from
  the annotation the MCScanX input came from. Block orientation is unaffected
  either way: `.anchors.simple` takes it from the collinearity block header.
* **Score.** MCScanX scores a pair with an e-value where jcvi writes a bit
  score, so the anchors score is `-log10(e_value)` capped at 1000 (also what
  `e_value=0` becomes). The simple file's score is the block's anchor count,
  matching jcvi.

Requires: python3 only.
Usage:
  python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \\
      --species at=grape --species pp=peach [--species tc=cacao] [--outdir DIR]

Writes one <name>.bed per genome, plus <sp1>.<sp2>.anchors and
<sp1>.<sp2>.anchors.simple for one or two genomes, or <sp1>.blocks for more.
"""

import argparse
import gzip
import math
import os
import re
import sys

# The MCScanX gff's gene ids are whatever the user's own extraction wrote, so
# every id-ish attribute is indexed, with Ensembl's `gene:`/`mRNA:` namespace
# prefix stripped.
ID_ATTRS = ("ID", "Name", "gene_id", "transcript_id", "protein_id", "locus_tag")
HEADER = re.compile(r"^## Alignment .*\b(plus|minus)\s*$")


def opener(path):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def parse_kv(values, what):
    for v in values:
        if "=" not in v:
            sys.exit(f"--{what} wants TAG=VALUE, got {v!r}")
    return dict(v.split("=", 1) for v in values)


def read_mcscanx_gff(paths):
    """gene -> (chrom, start, end), 1-based inclusive as MCScanX carries it."""
    genes = {}
    for path in paths:
        with opener(path) as fh:
            for line in fh:
                f = line.rstrip("\n").split("\t")
                if len(f) >= 4 and not f[0].startswith("#"):
                    genes[f[1]] = (f[0], int(f[2]), int(f[3]))
    return genes


def read_gff3_strands(path):
    strands = {}
    with opener(path) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            if len(f) >= 9 and f[6] in "+-" and not line.startswith("#"):
                for key, _, val in (a.partition("=") for a in f[8].split(";")):
                    if key.strip() in ID_ATTRS:
                        val = val.strip()
                        strands[val] = strands[val.split(":")[-1]] = f[6]
    return strands


def score_from_evalue(text):
    try:
        e = float(text)
    except ValueError:
        return 0
    return 1000 if e <= 0 else max(0, min(1000, round(-math.log10(e))))


def read_collinearity(path):
    """[(orientation, [(gene1, gene2, score), ...]), ...] in file order."""
    blocks = []
    with opener(path) as fh:
        for line in fh:
            m = HEADER.match(line.rstrip("\n"))
            if m:
                blocks.append(("-" if m.group(1) == "minus" else "+", []))
            elif blocks and not line.startswith("#") and line.strip():
                f = [x.strip() for x in line.split("\t")]
                f = f if len(f) >= 4 else line.split()
                if len(f) >= 4:
                    blocks[-1][1].append((f[1], f[2], score_from_evalue(f[3])))
    return blocks


def species_of(genes, tags, gene):
    chrom = genes.get(gene, ("",))[0]
    return next((i for i, t in enumerate(tags) if chrom.startswith(t)), None)


def convert_blocks(blocks, genes, tags):
    """([(anchor_pairs, simple_row), ...], counts).

    Keeps the pairs joining the genomes asked for, with column 1 normalized to
    the first of them however the block was written, and drops a block left with
    none: MCScanX writes every pair it examined into one file. One --species is
    a self-alignment run, which keeps the same-genome blocks the two-genome case
    throws away and throws away everything else.
    """
    out = []
    wanted = {0, 1} if len(tags) > 1 else {0}
    counts = {"kept": 0, "skipped": 0, "unknown": 0}

    for orientation, pairs in blocks:
        cross = []
        for g1, g2, score in pairs:
            s1 = species_of(genes, tags, g1)
            s2 = species_of(genes, tags, g2)
            if s1 is None or s2 is None:
                counts["unknown"] += 1
            elif {s1, s2} == wanted:
                cross.append((g1, g2, score) if s1 == 0 else (g2, g1, score))
        if cross:
            # a simple row names the first and last gene of the block on each
            # side, each ordered by its own coordinates
            by_pos = [sorted((r[i] for r in cross), key=lambda g: genes[g][1])
                      for i in (0, 1)]
            counts["kept"] += 1
            out.append((cross, (by_pos[0][0], by_pos[0][-1], by_pos[1][0],
                                by_pos[1][-1], str(len(cross)), orientation)))
        elif pairs:
            counts["skipped"] += 1
    return out, counts


def build_table(blocks, genes, tags):
    """([row, ...], counts) for the reference-anchored ortholog table.

    Column 0 is the first --species. Only a pair that includes it can fill a
    cell: MCScanBlocksAdapter joins two other columns transitively through the
    reference, so an MCScanX block between two non-reference genomes has nowhere
    to go here. Where the reference gene has several orthologs in one genome
    (MCScanX will report a gene in more than one block), the best-scoring wins,
    since a cell holds one id.
    """
    best = {}
    counts = {"kept": 0, "indirect": 0, "unknown": 0}
    for _orientation, pairs in blocks:
        for g1, g2, score in pairs:
            s1 = species_of(genes, tags, g1)
            s2 = species_of(genes, tags, g2)
            if s1 is None or s2 is None:
                counts["unknown"] += 1
            elif s1 != s2 and 0 in (s1, s2):
                ref, other, col = (g1, g2, s2) if s1 == 0 else (g2, g1, s1)
                cells = best.setdefault(ref, {})
                if score >= cells.get(col, (-1,))[0]:
                    cells[col] = (score, other)
            elif s1 != s2:
                counts["indirect"] += 1
    rows = []
    for ref in sorted(best, key=lambda g: genes[g]):
        cells = best[ref]
        rows.append([ref] + [cells[c][1] if c in cells else "."
                             for c in range(1, len(tags))])
        counts["kept"] += 1
    return rows, counts


def unmatched_refnames(rows, fai_path):
    """The BED refNames the assembly does not have, and what it does have.

    Both adapters resolve a gene through its BED entry and then draw it on the
    named reference sequence, so a refName the assembly never heard of is the
    one mistake that produces an empty track rather than an error.
    """
    with opener(fai_path) as fh:
        have = {line.split("\t")[0] for line in fh if line.strip()}
    return sorted({r[0] for r in rows} - have), sorted(have)


def bed_rows(genes, tag, strands, keep_tag, prefix):
    return sorted(
        (prefix + (chrom if keep_tag else chrom[len(tag):]), min(start, end) - 1,
         max(start, end), gene, 0, strands.get(gene, "+"))
        for gene, (chrom, start, end) in genes.items()
        if chrom.startswith(tag)
    )


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--gff", action="append", required=True,
                   help="MCScanX .gff (repeatable, e.g. one per genome)")
    p.add_argument("--collinearity", required=True, help="MCScanX .collinearity")
    p.add_argument("--species", action="append", required=True, metavar="TAG=NAME",
                   help="two-letter MCScanX chromosome tag = JBrowse assembly "
                        "name; once for a self-alignment, twice for anchors, "
                        "more for a .blocks table. the first is column 0")
    p.add_argument("--chr-prefix", action="append", default=[], metavar="NAME=PFX")
    p.add_argument("--keep-chr-tag", action="store_true")
    p.add_argument("--strand-gff3", action="append", default=[], metavar="NAME=FILE")
    p.add_argument("--fai", action="append", default=[], metavar="NAME=FILE",
                   help="that assembly's .fa.fai, to check the BED refNames "
                        "against before a track draws nothing")
    p.add_argument("--outdir", default=".")
    args = p.parse_args()

    species = parse_kv(args.species, "species")
    tags, names = list(species), list(species.values())
    prefixes = parse_kv(args.chr_prefix, "chr-prefix")
    fais = parse_kv(args.fai, "fai")
    strands = {n: read_gff3_strands(f)
               for n, f in parse_kv(args.strand_gff3, "strand-gff3").items()}
    for name in list(prefixes) + list(strands) + list(fais):
        if name not in names:
            sys.exit(f"{name!r} is not one of the --species names {names}")

    genes = read_mcscanx_gff(args.gff)
    os.makedirs(args.outdir, exist_ok=True)
    for tag, name in zip(tags, names):
        rows = bed_rows(genes, tag, strands.get(name, {}), args.keep_chr_tag,
                        prefixes.get(name, ""))
        if not rows:
            sys.exit(f"no genes on chromosomes tagged {tag!r} ({name})")
        if name in fais:
            missing, have = unmatched_refnames(rows, fais[name])
            if missing:
                sys.exit(f"{name}: {len(missing)} refName(s) written to the BED "
                         f"are not in {fais[name]}: {', '.join(missing[:5])}\n"
                         f"the assembly has: {', '.join(have[:5])}\n"
                         f"adjust with --chr-prefix {name}=... or --keep-chr-tag")
        with open(os.path.join(args.outdir, f"{name}.bed"), "w") as fh:
            fh.writelines("\t".join(str(x) for x in r) + "\n" for r in rows)

    blocks = read_collinearity(args.collinearity)
    written = [os.path.join(args.outdir, f"{n}.bed") for n in names]
    if len(names) > 2:
        rows, counts = build_table(blocks, genes, tags)
        table = os.path.join(args.outdir, f"{names[0]}.blocks")
        with open(table, "w") as fh:
            fh.writelines("\t".join(r) + "\n" for r in rows)
        written.append(table)
        summary = (f"{counts['kept']} reference genes in the table, "
                   f"{counts['indirect']} pairs between two non-reference "
                   f"genomes dropped")
    else:
        converted, counts = convert_blocks(blocks, genes, tags)
        stem = os.path.join(args.outdir, f"{names[0]}.{names[-1]}")
        with open(f"{stem}.anchors", "w") as anchors, \
                open(f"{stem}.anchors.simple", "w") as simple:
            for cross, simple_row in converted:
                anchors.write("###\n")
                anchors.writelines(f"{g1}\t{g2}\t{s}\n" for g1, g2, s in cross)
                simple.write("\t".join(simple_row) + "\n")
        written += [f"{stem}.anchors", f"{stem}.anchors.simple"]
        summary = (f"{counts['kept']} blocks kept, {counts['skipped']} blocks "
                   f"not joining {' and '.join(dict.fromkeys(names))} skipped")

    print(f"wrote {' '.join(written)}\n{summary}, {counts['unknown']} pairs on "
          f"unlisted genomes skipped", file=sys.stderr)


if __name__ == "__main__":
    main()
