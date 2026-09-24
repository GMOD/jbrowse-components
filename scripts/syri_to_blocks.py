#!/usr/bin/env python3
"""SyRI's syri.out as a JBrowse pair table plus one BED per genome.

Each top-level structural region (syntenic, inverted, translocated, duplicated)
becomes a row of <prefix>.blocks naming the region's SyRI id on both sides, with
its type, that type's color and its reference length after them, and a line of
each genome's BED placing that id. An inverted type is written on the minus
strand of the query BED, which is what draws its ribbon crossed.

MCScanBlocksAdapter reads the three files; list the extra columns in its
attributeColumns as ["type", "color", "length"].

<prefix>.regions.bed places the same regions on the reference alone, named by
type, colored by itemRgb and carrying the query's name, so the regions of
several queries against one reference concatenate into one track whose rows
are the queries.

<prefix>.paf is the same regions as alignment records between PanSN-named
sequences (<genome>#1#<chrom>), carrying their type and color as the tags
syri:Z: and color:Z:, so the PAFs of several pairs concatenate into one file
MultiGenomePAFAdapter reads with attributeColumns ["syri", "color"]. Sequence
lengths come from <genome>.chrom.sizes beside the input where present.
"""

import argparse
import os

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


def write_regions_bed(path, found, query):
    with open(path, 'w') as fh:
        fh.write(
            '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand'
            '\tthickStart\tthickEnd\titemRgb\tquery\n'
        )
        for r in sorted(found, key=lambda r: (r['ref'][0], r['ref'][1])):
            chrom, start, end, _ = r['ref']
            strand = r['qry'][3]
            rgb = ','.join(str(int(COLORS[r['type']][i : i + 2], 16)) for i in (1, 3, 5))
            fh.write(
                f"{chrom}\t{start}\t{end}\t{r['type']}\t0\t{strand}"
                f'\t{start}\t{end}\t{rgb}\t{query}\n'
            )


def chrom_sizes(genome):
    path = f'{genome}.chrom.sizes'
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return {line.split('\t')[0]: int(line.split('\t')[1]) for line in fh}


def write_paf(path, found, reference, query):
    ref_sizes, qry_sizes = chrom_sizes(reference), chrom_sizes(query)
    with open(path, 'w') as fh:
        for r in found:
            rchrom, rstart, rend, _ = r['ref']
            qchrom, qstart, qend, strand = r['qry']
            length = max(rend - rstart, qend - qstart)
            fh.write(
                f'{query}#1#{qchrom}\t{qry_sizes.get(qchrom, 0)}\t{qstart}\t{qend}'
                f'\t{strand}\t{reference}#1#{rchrom}\t{ref_sizes.get(rchrom, 0)}'
                f'\t{rstart}\t{rend}\t{min(rend - rstart, qend - qstart)}\t{length}'
                f"\t60\tsyri:Z:{r['type']}\tcolor:Z:{COLORS[r['type']]}\n"
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
    write_bed(f'{args.prefix}.{reference}.bed', [(r['id'], r['ref']) for r in found])
    write_bed(f'{args.prefix}.{query}.bed', [(r['id'], r['qry']) for r in found])
    with open(f'{args.prefix}.blocks', 'w') as fh:
        for r in found:
            fh.write(
                f"{r['id']}\t{r['id']}\t{r['type']}\t{COLORS[r['type']]}\t{r['length']}\n"
            )
    write_regions_bed(f'{args.prefix}.regions.bed', found, query)
    write_paf(f'{args.prefix}.paf', found, reference, query)
    print(f'{args.prefix}: {len(found)} regions')


if __name__ == '__main__':
    main()
