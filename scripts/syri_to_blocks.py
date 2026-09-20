#!/usr/bin/env python3
"""SyRI's syri.out as a JBrowse pair table plus one BED per genome.

Each top-level structural region (syntenic, inverted, translocated, duplicated)
becomes a row of <prefix>.blocks naming the region's SyRI id on both sides, with
its type, that type's color and its reference length after them, and a line of
each genome's BED placing that id. An inverted type is written on the minus
strand of the query BED, which is what draws its ribbon crossed.

MCScanBlocksAdapter reads the three files; list the extra columns in its
attributeColumns as ["type", "color", "length"].
"""

import argparse

# plotsr's palette, so a figure here reads like the one SyRI's users know
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
                ref_start, ref_end = int(f[1]), int(f[2])
                qry_start, qry_end = sorted((int(f[6]), int(f[7])))
                yield {
                    'id': f[8],
                    'type': kind,
                    'ref': (f[0], ref_start - 1, ref_end, '+'),
                    'qry': (
                        f[5],
                        qry_start - 1,
                        qry_end,
                        '-' if kind.startswith('INV') else '+',
                    ),
                    'length': ref_end - ref_start + 1,
                }


def write_bed(path, rows):
    with open(path, 'w') as fh:
        for region_id, (chrom, start, end, strand) in sorted(
            rows, key=lambda row: (row[1][0], row[1][1])
        ):
            fh.write(f'{chrom}\t{start}\t{end}\t{region_id}\t0\t{strand}\n')


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
    write_bed(f'{args.prefix}.{reference}.bed', [(r['id'], r['ref']) for r in found])
    write_bed(f'{args.prefix}.{query}.bed', [(r['id'], r['qry']) for r in found])
    with open(f'{args.prefix}.blocks', 'w') as fh:
        for r in found:
            fh.write(
                f"{r['id']}\t{r['id']}\t{r['type']}\t{COLORS[r['type']]}\t{r['length']}\n"
            )
    print(f'{args.prefix}: {len(found)} regions')


if __name__ == '__main__':
    main()
