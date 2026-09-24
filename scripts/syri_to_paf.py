#!/usr/bin/env python3
"""SyRI's syri.out as PAF records, plus the same regions on the reference.

Each top-level structural region (syntenic, inverted, translocated, duplicated)
becomes a line of <prefix>.paf between PanSN-named sequences
(<genome>#1#<chrom>), carrying its type and that type's color as the tags
syri:Z: and color:Z:. An inverted type is on the minus strand, which is what
draws its ribbon crossed. The PAFs of several pairs concatenate into one file,
which MultiGenomePAFAdapter reads with attributeColumns ["syri", "color"].
Sequence lengths come from <genome>.chrom.sizes beside the input where present.

<prefix>.regions.bed places the regions on the reference alone, named by type,
colored by itemRgb and carrying the query's name, so the regions of several
queries against one reference concatenate into one track whose rows are the
queries.
"""

import argparse
import os

# plotsr's palette, so a figure here reads like the one SyRI's users know. It
# paints an inverted translocation or duplication as the plain one, and so
# does this.
COLORS = {
    'SYN': '#c8c8c8',
    'INV': '#ffa500',
    'TRANS': '#9acd32',
    'INVTR': '#9acd32',
    'DUP': '#00bbff',
    'INVDP': '#00bbff',
}


def regions(path):
    with open(path) as fh:
        for line in fh:
            f = line.rstrip('\n').split('\t')
            kind, parent = f[10], f[9]
            if kind in COLORS and parent == '-':
                qry_start, qry_end = sorted((int(f[6]), int(f[7])))
                yield {
                    'type': kind,
                    'ref': (f[0], int(f[1]) - 1, int(f[2])),
                    'qry': (f[5], qry_start - 1, qry_end),
                    'strand': '-' if kind.startswith('INV') else '+',
                }


def chrom_sizes(genome):
    path = f'{genome}.chrom.sizes'
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return {chrom: int(size) for chrom, size in (l.split('\t')[:2] for l in fh)}


def write_paf(path, found, reference, query):
    ref_sizes, qry_sizes = chrom_sizes(reference), chrom_sizes(query)
    with open(path, 'w') as fh:
        for r in found:
            rchrom, rstart, rend = r['ref']
            qchrom, qstart, qend = r['qry']
            lengths = (rend - rstart, qend - qstart)
            fh.write(
                f'{query}#1#{qchrom}\t{qry_sizes.get(qchrom, 0)}\t{qstart}\t{qend}'
                f"\t{r['strand']}\t{reference}#1#{rchrom}\t{ref_sizes.get(rchrom, 0)}"
                f'\t{rstart}\t{rend}\t{min(lengths)}\t{max(lengths)}\t60'
                f"\tsyri:Z:{r['type']}\tcolor:Z:{COLORS[r['type']]}\n"
            )


def write_regions_bed(path, found, query):
    with open(path, 'w') as fh:
        fh.write(
            '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand'
            '\tthickStart\tthickEnd\titemRgb\tquery\n'
        )
        for r in sorted(found, key=lambda r: r['ref']):
            chrom, start, end = r['ref']
            hex_color = COLORS[r['type']]
            rgb = ','.join(str(int(hex_color[i : i + 2], 16)) for i in (1, 3, 5))
            fh.write(
                f"{chrom}\t{start}\t{end}\t{r['type']}\t0\t{r['strand']}"
                f'\t{start}\t{end}\t{rgb}\t{query}\n'
            )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('syri_out')
    parser.add_argument(
        '--prefix',
        required=True,
        help='<reference>_<query>, the two assembly names the files are named by',
    )
    args = parser.parse_args()
    reference, query = args.prefix.split('_', 1)

    found = list(regions(args.syri_out))
    write_paf(f'{args.prefix}.paf', found, reference, query)
    write_regions_bed(f'{args.prefix}.regions.bed', found, query)
    print(f'{args.prefix}: {len(found)} regions')


if __name__ == '__main__':
    main()
