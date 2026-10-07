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
symbols in the other joins nothing. Unnamed genes are skipped by --unnamed,
which defaults to NCBI's LOC ids; a PGAP bacterial annotation wants
--unnamed '_RS[0-9]+$' for its locus tags.

NCBI names a non-human gene after its human ortholog, except that human
C1orf35 becomes C1H1orf35 in chimp, "chromosome 1 C1orf35 homolog", with the
species' own chromosome first (C2AH2orf40 on chimp 2A, CXHXorf1 on X). The
table undoes that spelling, so the ortholog joins, and its BED names it, as
C1orf35.

Each BED names a gene by its symbol, so the table's cells, and the ortholog
groups JBrowse builds from them, read as gene names. A gene with no symbol is
named by its locus tag, and a symbol's second and later copies in one genome
get RefSeq's -2, -3 suffixes.

The anchor's genes come first, one row each in the anchor's coordinate order,
so the table is reference-anchored the way jcvi's mcscan output is. A symbol
the anchor lacks follows as a row with a dot in the anchor's column, ordered by
where the first genome carrying it places the gene. A row that names only one
gene is dropped, since it links nothing.

**--merge-cited joins a gene renamed between annotation releases.** PGAP
records the protein it annotated each gene from (`inference=...similar to AA
sequence:RefSeq:NP_416533.1` on the CDS). When that protein is one of the
table's genes under a different symbol, and no genome carries both symbols, the
two are one gene under two names (gndA annotated from K-12's gnd) and join. A
genome carrying both is a paralog pair (narH and narY) and they stay apart.

**A symbol carried by several genes becomes several rows.** A link is one gene
to one gene, so a genome with two copies of a symbol has no single correct cell,
and taking the first copy hides the duplication. `--pick expand` (the default)
emits one row per copy, index-paired across columns in each gene's own reading
direction, so a symbol costs rows equal to its largest copy count rather than
their product; each copy then draws its own ribbon. A symbol with more than `--max-copies` genes in a column is a
gene family rather than a duplication and empties that cell. `--pick first`
takes the first copy along the gene, and `--pick single` empties any multi-copy
cell for a strictly one-to-one table. `orthogroups_to_blocks.py` spells the same
three over OrthoFinder's cells.

The column order printed on stdout is what the JBrowse track's blockAssemblies
and bedLocations have to list, in that order.
"""
import argparse
import gzip
import re
import sys
from collections import Counter, OrderedDict

CITED = re.compile(r'similar to AA sequence:RefSeq:([A-Z]{2}_[0-9]+\.[0-9]+)')
HUMAN_ORF_HOMOLOG = re.compile(r'^C(?:[0-9]+[A-Z]?|X|Y)H([0-9]+|X|Y)orf([0-9]+[A-Z]*)$', re.I)


def human_symbol(symbol):
    m = symbol and HUMAN_ORF_HOMOLOG.match(symbol)
    return f'C{m.group(1).upper()}orf{m.group(2).upper()}' if m else symbol


def open_text(path):
    return gzip.open(path, 'rt') if path.endswith('.gz') else open(path)


def attr(attrs, key):
    m = re.search(rf'(?:^|;){key}=([^;]*)', attrs)
    return m.group(1) if m else None


def read_gff(path, biotype, with_cds, pseudogenes):
    genes = []
    parent = {}
    cds = []
    with open_text(path) as fh:
        for line in fh:
            if not line or line[0] == '#':
                continue
            f = line.rstrip('\n').split('\t')
            if len(f) < 9:
                continue
            if f[2] == 'gene' or (pseudogenes and f[2] == 'pseudogene'):
                if biotype and f[2] == 'gene' and attr(f[8], 'gene_biotype') != biotype:
                    continue
                gid = attr(f[8], 'ID')
                if gid:
                    genes.append({
                        'ref': f[0], 'start': int(f[3]) - 1, 'end': int(f[4]),
                        'id': gid, 'strand': f[6], 'symbol': human_symbol(attr(f[8], 'Name')),
                        'locus_tag': attr(f[8], 'locus_tag'),
                    })
            elif with_cds:
                fid = attr(f[8], 'ID')
                if fid:
                    parent[fid] = attr(f[8], 'Parent')
                if f[2] == 'CDS':
                    cited = CITED.search(attr(f[8], 'inference') or '')
                    cds.append((attr(f[8], 'Parent'), attr(f[8], 'protein_id'),
                                cited.group(1) if cited else None))
    by_id = {g['id']: g for g in genes}
    for par, protein, cited in cds:
        seen = set()
        while par is not None and par not in by_id and par not in seen:
            seen.add(par)
            par = parent.get(par)
        g = by_id.get(par)
        if g is not None:
            if protein:
                g.setdefault('proteins', set()).add(protein)
            if cited:
                g.setdefault('cited', set()).add(cited)
    return genes


def label_genes(genes):
    taken = set()
    for g in genes:
        base = g['symbol'] or g['locus_tag'] or g['id']
        label, n = base, 1
        while label in taken:
            n += 1
            label = f'{base}-{n}'
        taken.add(label)
        g['label'] = label


def reading_order(genes):
    """One symbol's genes in one genome, first to last along the gene.

    Copies are paired across genomes by index, and a chromosome deposited the
    other way round lists them in the opposite order, so two halves of a split
    gene would pair first with last. Genes all on the minus strand read from
    the high coordinate down.
    """
    ordered = sorted(genes, key=lambda g: (g['ref'], g['start']))
    return ordered[::-1] if {g['strand'] for g in genes} == {'-'} else ordered


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


def merge_cited(columns):
    owner = {}
    for name, genes in columns.items():
        for g in genes:
            for p in g.get('proteins', ()):
                owner[p] = g['key']
    support = Counter()
    for genes in columns.values():
        for g in genes:
            for p in g.get('cited', ()):
                target = owner.get(p)
                if g['key'] is not None and target is not None and target != g['key']:
                    support[(g['key'], target)] += 1
    root = {}
    carriers = {}
    for name, genes in columns.items():
        for g in genes:
            if g['key'] is not None:
                root[g['key']] = g['key']
                carriers.setdefault(g['key'], set()).add(name)

    def find(k):
        while root[k] != k:
            root[k] = root[root[k]]
            k = root[k]
        return k

    merged = 0
    for (a, b), _ in sorted(support.items(), key=lambda kv: (-kv[1], kv[0])):
        ra, rb = find(a), find(b)
        if ra != rb and not carriers[ra] & carriers[rb]:
            root[ra] = rb
            carriers[rb] |= carriers.pop(ra)
            merged += 1
    for genes in columns.values():
        for g in genes:
            if g['key'] is not None:
                g['key'] = find(g['key'])
    return merged


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('genomes', nargs='+', metavar='NAME=GFF3', help='a column of the table and the BED it places')
    p.add_argument('--anchor', required=True, help='the genome whose genes are the rows')
    p.add_argument('-o', '--out', required=True, help='the .blocks table to write')
    p.add_argument('--bed-dir', default='.', help='where each NAME.bed is written')
    p.add_argument('--biotype', default='protein_coding', help="keep genes of this gene_biotype only; '' keeps every gene")
    p.add_argument('--pseudogenes', action='store_true', help='also read pseudogene features, which NCBI writes outside the gene type and the --biotype filter')
    p.add_argument('--unnamed', default=r'^LOC\d+', help='a Name= matching this is an unnamed gene and joins nothing')
    p.add_argument('--keep-case', action='store_true', help='compare symbols as written instead of case-folded')
    p.add_argument('--merge-cited', action='store_true',
                   help='join two symbols when a gene under one was annotated from a protein under the other and no genome carries both')
    p.add_argument('--pick', choices=['expand', 'single', 'first'], default='expand',
                   help='a symbol with several copies in a column: expand emits a row per copy, single empties the cell, first takes the first copy')
    p.add_argument('--max-copies', type=int, default=4, metavar='N',
                   help='a column offering more than N copies of a symbol is a gene family, and its cell is emptied')
    a = p.parse_args(argv)

    paths = OrderedDict()
    for spec in a.genomes:
        name, _, path = spec.partition('=')
        if not path:
            p.error(f'{spec}: expected NAME=GFF3')
        paths[name] = path
    if a.anchor not in paths:
        p.error(f'--anchor {a.anchor} is not one of the genomes given')

    unnamed = re.compile(a.unnamed) if a.unnamed else None
    fold = (lambda s: s) if a.keep_case else str.upper

    columns = OrderedDict()
    for name, path in paths.items():
        genes = read_gff(path, a.biotype, a.merge_cited, a.pseudogenes)
        label_genes(genes)
        with open(f'{a.bed_dir}/{name}.bed', 'w') as bed:
            for g in genes:
                bed.write(f"{g['ref']}\t{g['start']}\t{g['end']}\t{g['label']}\t0\t{g['strand']}\n")
        for g in genes:
            sym = g['symbol']
            g['key'] = fold(sym) if sym is not None and not (unnamed and unnamed.search(sym)) else None
        columns[name] = genes

    if a.merge_cited:
        print(f'--merge-cited joined {merge_cited(columns)} renamed symbols', file=sys.stderr)

    by_symbol = {}
    for name, genes in columns.items():
        carriers = {}
        for g in genes:
            if g['key'] is not None:
                carriers.setdefault(g['key'], []).append(g)
        table = {
            key: [g['label'] for g in reading_order(carried)]
            for key, carried in carriers.items()
        }
        by_symbol[name] = table
        dup = sum(1 for labels in table.values() if len(labels) > 1)
        print(f'{name}: {len(genes)} genes, {len(table)} distinct symbols, {dup} with copies', file=sys.stderr)

    order = list(columns)
    keys = []
    seen = set()
    for g in sorted(columns[a.anchor], key=lambda g: (g['ref'], g['start'])):
        if g['key'] is not None and g['key'] not in seen:
            seen.add(g['key'])
            keys.append(g['key'])
    anchored = len(keys)
    for name in order:
        for g in columns[name]:
            if g['key'] is not None and g['key'] not in seen:
                seen.add(g['key'])
                keys.append(g['key'])

    filled = {name: set() for name in order}
    rows = 0
    anchor_rows = 0
    expanded = 0
    families = 0
    with open(a.out, 'w') as out:
        for i, k in enumerate(keys):
            counts = {'families': 0}
            new = symbol_rows([by_symbol[name].get(k, []) for name in order], a.pick, a.max_copies, counts)
            families += counts['families']
            expanded += len(new) > 1
            for cells in new:
                out.write('\t'.join(cells) + '\n')
                rows += 1
                anchor_rows += i < anchored
                for name, c in zip(order, cells):
                    if c != '.':
                        filled[name].add(c)
    print(f'{a.out}: {rows} rows, {rows - anchor_rows} of them for symbols {a.anchor} lacks, '
          f'{expanded} symbols expanded across rows', file=sys.stderr)
    if families:
        print(f'  {families} cells emptied by --max-copies {a.max_copies}', file=sys.stderr)
    for name in order:
        pct = 100 * len(filled[name]) / rows if rows else 0
        print(f'  {name}: {len(filled[name])} genes ({pct:.0f}%)', file=sys.stderr)
    print(' '.join(order))


if __name__ == '__main__':
    main(sys.argv[1:])
