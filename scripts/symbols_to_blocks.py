#!/usr/bin/env python3
"""Build an MCScan-style .blocks ortholog table from gene symbols alone.

    python3 symbols_to_blocks.py --anchor human -o primates.blocks \\
        human=human.gff.gz chimp=chimp.gff.gz gorilla=gorilla.gff.gz

Each NAME=GFF3 becomes one column of the table and one NAME.bed beside it.
Two genes are orthologs here when their annotations gave them the same symbol
(the GFF3 `Name=` attribute), compared case-folded so human ATP5F1A meets mouse
Atp5f1a. Nothing is aligned, so the table costs a GFF3 download per genome and
a few seconds, and it says nothing about genes the two annotations named
differently: a gene family whose copies are LOC ids in one genome and lettered
symbols in the other joins nothing, and neither does the accessory genome of a
bacterial pangenome. Unnamed genes are skipped by --unnamed, which defaults to
NCBI's LOC ids; a PGAP bacterial annotation wants --unnamed '_RS[0-9]+$' for
its locus tags.

One row per anchor gene, in the anchor's coordinate order, so the table is
reference-anchored the way jcvi's mcscan output is. A row that names only the
anchor is dropped, since it links nothing.

**A symbol carried by several genes becomes several rows.** A link is one gene
to one gene, so a genome with two copies of a symbol has no single correct cell,
and taking the first copy hides the duplication. `--pick expand` (the default)
emits one row per copy, index-paired across columns, so a symbol costs rows
equal to its largest copy count rather than their product; each copy then draws
its own ribbon. A symbol with more than `--max-copies` genes in a column is a
gene family rather than a duplication and empties that cell. `--pick first`
takes the first copy in file order, and `--pick single` empties any multi-copy
cell for a strictly one-to-one table. `orthogroups_to_blocks.py` spells the same
three over OrthoFinder's cells.

The column order printed on stdout is what the JBrowse track's blockAssemblies
and bedLocations have to list, in that order.
"""
import argparse
import gzip
import re
import sys
from collections import OrderedDict


def open_text(path):
    return gzip.open(path, 'rt') if path.endswith('.gz') else open(path)


def attr(attrs, key):
    m = re.search(rf'(?:^|;){key}=([^;]*)', attrs)
    return m.group(1) if m else None


def genes(path, biotype):
    out = []
    with open_text(path) as fh:
        for line in fh:
            if not line or line[0] == '#':
                continue
            f = line.rstrip('\n').split('\t')
            if len(f) < 9 or f[2] != 'gene':
                continue
            if biotype and attr(f[8], 'gene_biotype') != biotype:
                continue
            gid = attr(f[8], 'ID')
            if gid:
                out.append((f[0], int(f[3]) - 1, int(f[4]), gid, f[6], attr(f[8], 'Name')))
    return out


def symbol_rows(copies, pick, max_copies, counts=None):
    """The table rows one symbol contributes, given each column's copies."""
    if counts is not None:
        counts['families'] += sum(1 for c in copies if len(c) > max_copies)
    copies = [[] if len(c) > max_copies else c for c in copies]
    if pick == 'first':
        copies = [c[:1] for c in copies]
    elif pick == 'single':
        copies = [c if len(c) == 1 else [] for c in copies]
    # index-paired: a single-copy column repeats its gene against each copy
    # beside it, so a symbol costs the largest copy count in rows rather than
    # their product, and the adapter draws a repeated pair once
    rows = [
        [c[i % len(c)] if c else '.' for c in copies]
        for i in range(max((len(c) for c in copies), default=0))
    ]
    return [r for r in rows if sum(g != '.' for g in r) > 1]


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('genomes', nargs='+', metavar='NAME=GFF3', help='a column of the table and the BED it places')
    p.add_argument('--anchor', required=True, help='the genome whose genes are the rows')
    p.add_argument('-o', '--out', required=True, help='the .blocks table to write')
    p.add_argument('--bed-dir', default='.', help='where each NAME.bed is written')
    p.add_argument('--biotype', default='protein_coding', help="keep genes of this gene_biotype only; '' keeps every gene")
    p.add_argument('--unnamed', default=r'^LOC\d+', help='a Name= matching this is an unnamed gene and joins nothing')
    p.add_argument('--keep-case', action='store_true', help='compare symbols as written instead of case-folded')
    p.add_argument('--pick', choices=['expand', 'single', 'first'], default='expand',
                   help='a symbol with several copies in a column: expand emits a row per copy, single empties the cell, first takes the first copy')
    p.add_argument('--max-copies', type=int, default=4, metavar='N',
                   help='a column offering more than N copies of a symbol is a gene family, and its cell is emptied')
    a = p.parse_args(argv)

    columns = OrderedDict()
    for spec in a.genomes:
        name, _, path = spec.partition('=')
        if not path:
            p.error(f'{spec}: expected NAME=GFF3')
        columns[name] = path
    if a.anchor not in columns:
        p.error(f'--anchor {a.anchor} is not one of the genomes given')

    unnamed = re.compile(a.unnamed) if a.unnamed else None
    key = (lambda s: s) if a.keep_case else str.upper

    def named(sym):
        return sym is not None and not (unnamed and unnamed.search(sym))

    by_symbol = {}
    anchor_genes = None
    for name, path in columns.items():
        g = genes(path, a.biotype)
        with open(f'{a.bed_dir}/{name}.bed', 'w') as bed:
            for ref, start, end, gid, strand, _ in g:
                bed.write(f'{ref}\t{start}\t{end}\t{gid}\t0\t{strand}\n')
        table = {}
        for _, _, _, gid, _, sym in g:
            if named(sym):
                table.setdefault(key(sym), []).append(gid)
        by_symbol[name] = table
        dup = sum(1 for gids in table.values() if len(gids) > 1)
        print(f'{name}: {len(g)} genes, {len(table)} distinct symbols, {dup} with copies', file=sys.stderr)
        if name == a.anchor:
            anchor_genes = sorted(g, key=lambda x: (x[0], x[1]))

    order = list(columns)
    filled = {name: set() for name in order}
    rows = 0
    expanded = 0
    families = 0
    seen = set()
    with open(a.out, 'w') as out:
        for _, _, _, _, _, sym in anchor_genes:
            if not named(sym) or key(sym) in seen:
                continue
            seen.add(key(sym))
            counts = {'families': 0}
            new = symbol_rows(
                [by_symbol[name].get(key(sym), []) for name in order],
                a.pick, a.max_copies, counts)
            families += counts['families']
            expanded += len(new) > 1
            for cells in new:
                out.write('\t'.join(cells) + '\n')
                rows += 1
                for name, c in zip(order, cells):
                    if c != '.':
                        filled[name].add(c)
    print(f'{a.out}: {rows} rows, {expanded} symbols expanded across rows', file=sys.stderr)
    if families:
        print(f'  {families} cells emptied by --max-copies {a.max_copies}', file=sys.stderr)
    for name in order:
        pct = 100 * len(filled[name]) / rows if rows else 0
        print(f'  {name}: {len(filled[name])} genes ({pct:.0f}%)', file=sys.stderr)
    print(' '.join(order))


if __name__ == '__main__':
    main(sys.argv[1:])
