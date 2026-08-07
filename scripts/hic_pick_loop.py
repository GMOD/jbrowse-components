#!/usr/bin/env python3
"""Pick the locus for website figure hic/loops_and_domains from the call files.

A megabase of Hi-C chosen for its genes draws Arrowhead domains wider than the
frame and a fan of HiCCUPS arcs with no matrix feature under them, which is what
the chr18 window this figure used to show did. The pair worth drawing is a
contact domain whose two corners carry a strong loop: the domain, the arc and
the block in the matrix are then one object seen three ways.

So: for every Arrowhead domain in a plausible size range, find the strongest
HiCCUPS loop whose anchors sit on its two corners, and rank by that loop's
`observed` contact count. Both files are ENCODE GM12878 in situ Hi-C
(ENCSR410MDC) calls, the same two the figure draws.

    python3 scripts/hic_pick_loop.py            # downloads both bedpe.gz
    python3 scripts/hic_pick_loop.py --window chr8:127620000-128620000

The second form prints what a candidate window actually contains, which is the
check that matters: a domain that crosses the frame edge draws as a bar rather
than a box, and every loop with one anchor outside the frame adds an arc going
nowhere.
"""

import argparse
import gzip
import os
import sys
import urllib.request
from collections import defaultdict

ENCODE = 'https://encode-public.s3.amazonaws.com/2021/10/28'
LOOPS = f'{ENCODE}/70e6944c-1212-45f9-855c-dbc74e9a21f5/ENCFF712NKX.bedpe.gz'
DOMAINS = f'{ENCODE}/467750ae-7aab-47b0-a304-dc5f8dff89f7/ENCFF301CUL.bedpe.gz'

# how far a loop anchor's midpoint may sit from the domain corner it is taken to
# mark. The calls are on a 5-10 kb grid and the two callers round independently.
CORNER_SLOP = 25_000

# a domain has to be small enough to fit in a frame with flank either side, and
# big enough that its block is more than a few bins across
MIN_DOMAIN, MAX_DOMAIN = 250_000, 900_000


def fetch(url, cache_dir):
    path = os.path.join(cache_dir, url.rsplit('/', 1)[-1])
    if not os.path.exists(path):
        print(f'fetching {url}', file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return path


def read_bedpe(path):
    rows = []
    for line in gzip.open(path, 'rt'):
        if line.startswith('#'):
            continue
        f = line.rstrip('\n').split('\t')
        # col 11 is `observed` in the HiCCUPS file and the Arrowhead score in
        # the domain file; both are the number each caller ranks its calls by
        rows.append((f[0], int(f[1]), int(f[2]), int(f[4]), int(f[5]), float(f[11])))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache-dir', default='/tmp')
    ap.add_argument('--window', help='chrN:start-end, report contents instead')
    ap.add_argument('--top', type=int, default=15)
    args = ap.parse_args()

    loops = read_bedpe(fetch(LOOPS, args.cache_dir))
    domains = read_bedpe(fetch(DOMAINS, args.cache_dir))
    print(f'{len(loops)} loops, {len(domains)} domains', file=sys.stderr)

    if args.window:
        chrom, span = args.window.split(':')
        start, end = (int(x.replace(',', '')) for x in span.split('-'))
        print(f'{args.window}  ({(end - start) / 1e6:.2f} Mb)\n')
        print('domains:')
        # x1/x2 only: Arrowhead writes both bedpe mates as the same interval, so
        # a domain's y1/y2 repeat its x1/x2 and carry nothing extra
        for c, x1, x2, _y1, _y2, score in domains:
            if c == chrom and x2 > start and x1 < end:
                whole = 'inside' if x1 >= start and x2 <= end else 'CROSSES EDGE'
                print(f'  {x1:,}-{x2:,}  {(x2 - x1) // 1000:>4} kb  {whole}  score={score:.2f}')
        print('loops:')
        for c, x1, _x2, _y1, y2, obs in sorted(loops, key=lambda r: -r[5]):
            if c == chrom and y2 > start and x1 < end:
                whole = 'inside' if x1 >= start and y2 <= end else 'CROSSES EDGE'
                print(f'  {x1:,}-{y2:,}  {(y2 - x1) // 1000:>4} kb  {whole}  observed={obs:.0f}')
        return

    by_chrom = defaultdict(list)
    for row in loops:
        by_chrom[row[0]].append(row)

    ranked = []
    for c, x1, x2, _dy1, _dy2, score in domains:
        size = x2 - x1
        if not MIN_DOMAIN <= size <= MAX_DOMAIN:
            continue
        best = 0.0
        for _lc, lx1, lx2, ly1, ly2, obs in by_chrom[c]:
            near_left = abs((lx1 + lx2) // 2 - x1) <= CORNER_SLOP
            near_right = abs((ly1 + ly2) // 2 - x2) <= CORNER_SLOP
            if near_left and near_right:
                best = max(best, obs)
        if best:
            ranked.append((best, c, x1, x2, size, score))

    ranked.sort(reverse=True)
    print(f'{len(ranked)} domains are bounded by a loop; top {args.top}:')
    for obs, c, x1, x2, size, score in ranked[: args.top]:
        print(
            f'  observed={obs:7.0f}  {c}:{x1:,}-{x2:,}  '
            f'{size // 1000:>3} kb  arrowhead={score:.2f}'
        )


if __name__ == '__main__':
    main()
