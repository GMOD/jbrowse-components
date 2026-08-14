#!/usr/bin/env python3
"""Measure what a stacked OrthoFinder synteny figure will actually draw, over
the same `.blocks` table and BEDs the demo serves.

A gene-level synteny figure asserts things a reader counts off the picture: how
many ribbons leave each gene of the middle row, whether a duplicated gene's two
copies land one per chromosome, which genes draw nothing. Those numbers end up
in a screenshot spec's comment, and once there they are unfalsifiable — the
`grasses_maize_wgd` spec carried a set that had drifted from the windows it
described, and nothing could have caught it, because the script that produced
them was never committed. This is that script.

**It counts what the FIGURE draws, not what the table holds.** A partner outside
the window its row displays is not a ribbon, so every count here is taken
against the drawn windows. That distinction is the whole point: an ortholog on
another chromosome entirely leaves a gene looking answer-less in the frame while
the table has an answer for it, and a spec comment that says "9 have none"
without saying "as drawn" is describing a different quantity.

The second such pair is ribbons against table rows, and it is reported both
ways for the same reason. `--pick expand` names one gene pair on several rows
and `MCScanBlocksAdapter` draws it once, so the row count runs a few percent
above the ribbon count on a whole chromosome. Either is a fair thing to quote;
quoting one as the other is not.

Rows are given exactly as the spec's `loc` strings, so a window can be pasted
between the two without retyping it. `[rev]` is accepted and ignored: reversing
a row changes where a ribbon is drawn and not which ribbons exist.

Also reports the bp/px each row is drawn at, which is the ratio of the loc
strings: every row, however many regions it names, is fitted to the width
exactly (`fitAllRegions`, LinearGenomeView). A multi-region row used to go
through `showAllRegions` and draw at 1/SHOW_ALL_REGIONS_FILL of that instead,
which is why a figure's apparent scales could disagree with arithmetic done on
its spec.

Requires: python3 only. Reads the demo's own config.json to find the blocks
table and the BEDs, so it needs no argument naming them.

Usage:
  python3 scripts/orthofinder_window_stats.py grasses \\
      --row 'sorghum 1:5,934,000-6,126,000[rev]' \\
      --row 'rice 3:31,590,000-31,775,000' \\
      --row 'maize 1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]' \\
      --query rice
"""
import argparse
import gzip
import json
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict

DEMO_BASE = 'https://jbrowse.org/demos/orthofinder_{set}/'
# Off-window partners named individually before the rest are summarized.
OFFWINDOW_LISTED = 6


def fetch(base, name, cache):
    """Read `name` from the demo, caching it so a re-run costs nothing.

    Cached per demo, not per filename: every set names its files the same way,
    so one flat directory silently answers a wheat run out of a grasses run.
    """
    if os.path.isdir(base):
        return os.path.join(base, name)
    directory = os.path.join(cache, base.rstrip('/').rpartition('/')[2])
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, name)
    if not os.path.exists(path):
        sys.stderr.write(f'fetching {name}\n')
        urllib.request.urlretrieve(base + name, path)
    return path


def parse_row(text):
    """'maize 1:100-200 5:300-400[rev]' -> ('maize', [('1',100,200), ...]).

    Coordinates are 1-based inclusive as typed in the location box; BED starts
    are 0-based, so the window's start is decremented to compare against them.
    A bare refName is a whole sequence, the form the whole-chromosome figures
    use ('tauschii 1D 2D 3D ...'), and its end is filled in from chrom.sizes.
    """
    name, _, rest = text.strip().partition(' ')
    if not rest:
        raise ValueError(f'row {text!r} names an assembly but no region')
    regions = []
    for part in rest.split():
        part = part.removesuffix('[rev]')
        m = re.fullmatch(r'([^:]+):([\d,]+)-([\d,]+)', part)
        if m:
            start = int(m.group(2).replace(',', ''))
            regions.append((m.group(1), start - 1, int(m.group(3).replace(',', ''))))
        elif ':' in part:
            raise ValueError(f'cannot parse region {part!r} of row {text!r}')
        else:
            regions.append((part, 0, None))
    return name, regions


def read_bed(path):
    with gzip.open(path, 'rt') as f:
        return {
            p[3]: (p[0], int(p[1]), int(p[2]))
            for p in (line.rstrip('\n').split('\t') for line in f)
            if len(p) >= 4
        }


def overlaps(hit, regions):
    chrom, start, end = hit
    return any(chrom == c and start < e and end > s for c, s, e in regions)


def percentiles(values, lo=5, hi=95):
    """5th and 95th percentile, nearest-rank, on an unsorted list."""
    s = sorted(values)
    if not s:
        return (0.0, 0.0)
    return (
        s[min(len(s) - 1, int(len(s) * lo / 100))],
        s[min(len(s) - 1, int(len(s) * hi / 100))],
    )


def pearson(pairs):
    n = len(pairs)
    if n < 3:
        return None
    mx = sum(a for a, _ in pairs) / n
    my = sum(b for _, b in pairs) / n
    sxy = sum((a - mx) * (b - my) for a, b in pairs)
    sxx = sum((a - mx) ** 2 for a, b in pairs)
    syy = sum((b - my) ** 2 for a, b in pairs)
    if sxx == 0 or syy == 0:
        return None
    return sxy / (sxx * syy) ** 0.5


def adapter_of(config):
    """The MCScanBlocksAdapter the demo's synteny track loads."""
    for track in config.get('tracks', []):
        adapter = track.get('adapter', {})
        if adapter.get('type') == 'MCScanBlocksAdapter':
            return adapter
    raise SystemExit('no MCScanBlocksAdapter in the demo config')


def chrom_sizes_uri(config, assembly):
    """Where an assembly's chrom.sizes lives, for resolving a bare refName."""
    for entry in config.get('assemblies', []):
        if entry.get('name') == assembly:
            adapter = entry.get('sequence', {}).get('adapter', {})
            return adapter.get('chromSizesLocation', {}).get('uri')
    return None


def resolve_whole_sequences(regions, sizes, assembly):
    """Fill in the end of every bare-refName region from chrom.sizes."""
    out = []
    for chrom, start, end in regions:
        if end is None:
            if chrom not in sizes:
                raise SystemExit(
                    f'{assembly} has no sequence named {chrom} — its '
                    f'chrom.sizes lists {len(sizes)} of them'
                )
            end = sizes[chrom]
        out.append((chrom, start, end))
    return out


def main():
    ap = argparse.ArgumentParser(
        description='what a stacked OrthoFinder synteny figure draws',
    )
    ap.add_argument('set', help='vertebrates, grasses, wheat, or a local dir')
    ap.add_argument(
        '--row',
        action='append',
        required=True,
        metavar='"ASSEMBLY LOC"',
        help="a row's assembly and loc string, as written in the spec; repeat "
        'in the order the rows are stacked',
    )
    ap.add_argument(
        '--query',
        help='the row every count is per-gene-of (default: the middle row)',
    )
    ap.add_argument(
        '--cache',
        default=os.path.join('/tmp', 'orthofinder-window-stats'),
        help='where downloaded demo files are kept',
    )
    ap.add_argument(
        '--genes',
        action='store_true',
        help='also print one line per query gene and its partners',
    )
    args = ap.parse_args()

    base = args.set if os.path.isdir(args.set) else DEMO_BASE.format(set=args.set)
    with open(fetch(base, 'config.json', args.cache), encoding='utf8') as f:
        config = json.load(f)
    adapter = adapter_of(config)

    rows = []
    for text in args.row:
        name, regions = parse_row(text)
        if any(end is None for _, _, end in regions):
            uri = chrom_sizes_uri(config, name)
            if not uri:
                raise SystemExit(
                    f'{name} names a whole sequence but the demo config has no '
                    'chrom.sizes for it'
                )
            with open(
                fetch(base, os.path.basename(uri), args.cache), encoding='utf8'
            ) as f:
                sizes = {
                    p[0]: int(p[1])
                    for p in (l.split('\t') for l in f if l.strip())
                }
            regions = resolve_whole_sequences(regions, sizes, name)
        rows.append((name, regions))
    by_name = dict(rows)
    query = args.query or rows[len(rows) // 2][0]
    if query not in by_name:
        raise SystemExit(f'--query {query} is not one of the rows')

    columns = {name: i for i, name in enumerate(adapter['blockAssemblies'])}
    missing = [name for name, _ in rows if name not in columns]
    if missing:
        raise SystemExit(
            f'the blocks table has no column for {", ".join(missing)} — it has '
            f'{", ".join(columns)}'
        )

    beds = {
        name: read_bed(
            fetch(
                base,
                os.path.basename(adapter['bedLocations'][columns[name]]['uri']),
                args.cache,
            )
        )
        for name, _ in rows
    }

    qbed, qregions = beds[query], by_name[query]
    qgenes = {
        gene: pos for gene, pos in qbed.items() if overlaps(pos, qregions)
    }
    # Counter, not set, so both bases are available: a `--pick expand` table
    # names the same pair on several rows (see orthogroups_to_blocks.py), and
    # MCScanBlocksAdapter draws such a pair once. So the DISTINCT count is the
    # ribbon count and the row count is larger — the two differ by a few percent
    # on a whole chromosome, and a provenance note that reports one without
    # saying which reads as the other.
    partners = defaultdict(lambda: defaultdict(Counter))
    with gzip.open(
        fetch(base, os.path.basename(adapter['uri']), args.cache), 'rt'
    ) as f:
        for line in f:
            cells = line.rstrip('\n').split('\t')
            gene = cells[columns[query]]
            if gene in qgenes:
                for name, _ in rows:
                    cell = cells[columns[name]]
                    if name != query and cell != '.':
                        partners[gene][name][cell] += 1

    ordered = sorted(qgenes.items(), key=lambda kv: (kv[1][0], kv[1][1]))
    print(f'{query}: {len(ordered)} genes in the drawn window')

    for name, regions in rows:
        if name == query:
            continue
        drawn = defaultdict(int)
        spread = repeated = 0
        offwindow = []
        hits_all = []
        table_rows = Counter()
        # Where along the QUERY each partner sequence's links land. The extents
        # below are the partner's own span, which on a whole-chromosome row is
        # near the whole chromosome for every sequence and so separates nothing;
        # this is the axis on which "three consecutive blocks in order along 4A"
        # is a statement, and the percentiles are what keep a handful of
        # scattered singletons from stretching each block over everything.
        qpos = defaultdict(list)
        for gene, _ in ordered:
            hits = [
                (beds[name][p], n)
                for p, n in partners[gene][name].items()
                if p in beds[name]
            ]
            inside = [h for h, _ in hits if overlaps(h, regions)]
            drawn[len(inside)] += 1
            hits_all.extend(inside)
            for h, n in hits:
                if overlaps(h, regions):
                    table_rows[h[0]] += n
                    qpos[h[0]].append((qgenes[gene][1] + qgenes[gene][2]) / 2)
            if len(inside) > 1:
                if len({h[0] for h in inside}) == len(inside):
                    spread += 1
                else:
                    repeated += 1
            for h, _ in hits:
                if not overlaps(h, regions):
                    offwindow.append((gene, h))

        print()
        print(f'--- {name}')
        print(
            '  ribbons per '
            f'{query} gene: '
            + ', '.join(f'{n}x{c}' for n, c in sorted(drawn.items()))
        )
        print(
            f'  {len(hits_all)} ribbons drawn in all, named by '
            f'{sum(table_rows.values())} rows of the table'
        )
        if spread or repeated:
            print(
                f'    of the {spread + repeated} genes drawing more than one, '
                f'{spread} put one copy on each chromosome and {repeated} '
                'repeat a chromosome'
            )

        extents = defaultdict(list)
        for chrom, start, end in hits_all:
            extents[chrom].append((start, end))
        # Busiest sequence first: on a whole-chromosome row that ordering is
        # the result, separating the chromosomes carrying a block from the ones
        # answering in scattered singletons. Deliberately not called a "block" —
        # at that scale the span is the reach of the scatter, and only the gene
        # count and the correlation say which it is.
        for chrom, spans in sorted(
            extents.items(), key=lambda kv: (-len(kv[1]), kv[0])
        ):
            lo = min(s for s, _ in spans)
            hi = max(e for _, e in spans)
            print(
                f'    {chrom}: {len(spans)} genes drawn, {lo:,}-{hi:,} '
                f'({(hi - lo) / 1e3:.0f} kb), from {table_rows[chrom]} '
                'table rows'
            )
            p5, p95 = percentiles(qpos[chrom])
            print(
                f'      lands on {query} between {p5 / 1e6:.1f} Mb and '
                f'{p95 / 1e6:.1f} Mb (5th-95th pct)'
            )
            pairs = [
                ((qbed[g][1] + qbed[g][2]) / 2, (h[1] + h[2]) / 2)
                for g, _ in ordered
                for h in (
                    beds[name][p]
                    for p in partners[g][name]
                    if p in beds[name]
                )
                if h[0] == chrom and overlaps(h, regions)
            ]
            r = pearson(pairs)
            if r is not None:
                print(f'      collinearity with {query}: r={r:+.3f}')

        # Named rather than counted, because at gene scale this is the list of
        # genes that look answer-less in the frame and are not. A
        # whole-chromosome row has hundreds of them (every unplaced scaffold),
        # where the count is the useful form — so it prints both, and never a
        # truncated list with nothing saying it was truncated.
        if offwindow:
            print(
                f'    {len(offwindow)} partner(s) fall outside the drawn '
                'window and draw no ribbon'
            )
            for gene, hit in offwindow[:OFFWINDOW_LISTED]:
                print(f'      {gene} -> {hit[0]}:{hit[1]:,}')
            if len(offwindow) > OFFWINDOW_LISTED:
                print(
                    f'      ... and {len(offwindow) - OFFWINDOW_LISTED} more, '
                    'on '
                    + ', '.join(
                        sorted({h[0] for _, h in offwindow[OFFWINDOW_LISTED:]})[
                            :6
                        ]
                    )
                    + ' and so on'
                )

    print()
    print('drawn scale (row span, and the bp/px it is drawn at per unit width)')
    scales = {}
    for name, regions in rows:
        span = sum(e - s for _, s, e in regions)
        scales[name] = span
        note = f'  [{len(regions)} regions]' if len(regions) > 1 else ''
        print(f'  {name}: {span / 1e3:.0f} kb{note}')
    for name, _ in rows:
        if name != query:
            print(
                f'  {name} draws at {scales[name] / scales[query]:.1f}x '
                f"{query}'s bp/px"
            )

    if args.genes:
        print()
        for gene, pos in ordered:
            hits = ' '.join(
                f'{name}={",".join(sorted(f"{h[0]}:{h[1] // 1000}k" for h in (beds[name][p] for p in partners[gene][name] if p in beds[name]) if overlaps(h, by_name[name]))) or "-"}'
                for name, _ in rows
                if name != query
            )
            print(f'  {gene} {pos[0]}:{pos[1]:,}  {hits}')


if __name__ == '__main__':
    main()
