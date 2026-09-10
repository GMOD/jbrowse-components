#!/usr/bin/env python3
"""Reconstruct rGFA SN/SO/SR tags from a plain GFA's P lines.

rGFA states each segment's stable sequence, offset and rank in tags. A plain
GFA states the same thing in path order: walking a P line with a cumulative
offset assigns every segment it visits an interval on that path's own sequence,
and the first path to reach a segment is the one that names it. So the tags are
recoverable rather than absent, and everything downstream -- build_rgfa_tabix.sh,
build_rgfa_alleles.sh, gfatools bubble -- works unchanged.

Written for the bovine super-pangenome (Leonard et al. 2023, Zenodo 7737904),
whose published minigraph graphs are GFA 1.1 with 12 P lines and no rGFA tag
anywhere: `grep -c SN:Z:` returns 0 on every one of the 29 chromosomes. Nothing
in here is bovine-specific -- the path names and the reference come in as
arguments -- but read the two caveats below before pointing it at another graph.

CAVEAT 1: rank is the argument order, not a measurement. Real minigraph rGFA
records SR as the construction generation. A collapsed graph does not state it
and cannot, so `--paths` order is what SR reflects: rank i means "the i'th path
in the list I was given is the first of them that carries this segment". That is
weaker than minigraph's own SR and weaker still than carriage. Anything reading
SR as "which sample has this" is wrong.

CAVEAT 2: link CIGARs must be trivial. Segment lengths are simply added along a
path, which is only correct when consecutive segments do not overlap. The bovine
graphs are all `0M`, checked. A graph with real overlaps needs the offset walk
to subtract them, which this does not do -- so it refuses rather than silently
mis-coordinating.

Every segment on no path at all is dropped with its links: no path means no
coordinate, and a segment without SN is not representable as rGFA.

Usage:
  gfa_paths_to_rgfa.py --chrom-sizes FILE --indir DIR --chroms 1,2,3 \
      --paths HER,ANG,BIS --reference-name bosTau9 [--id-step 10000000]

Reads <indir>/<chrom>.gfa for each --chroms entry and writes one concatenated
rGFA to stdout, progress and audits to stderr. Segment ids are renumbered by
`chrom * --id-step` so the per-chromosome files, whose ids each restart at 1,
can be concatenated: the link index joins to the segment index by id, and
colliding ids would cross-wire chromosomes. Stable names are written PanSN, the
reference as `<reference-name>#0#chr<k>` and the rest as `<path>#0#chr<k>`.

The reference path's length is checked against --chrom-sizes for every
chromosome and a mismatch is fatal, which is what makes the emitted coordinates
verifiable rather than merely plausible.
"""
import argparse
import sys


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--chrom-sizes', required=True,
                   help='two-column name/length file for the reference')
    p.add_argument('--indir', required=True,
                   help='directory holding <chrom>.gfa')
    p.add_argument('--chroms', required=True,
                   help='comma-separated chromosome numbers, e.g. 1,2,3')
    p.add_argument('--paths', required=True,
                   help='comma-separated P-line names, reference FIRST; the '
                        'order becomes SR (see CAVEAT 1)')
    p.add_argument('--reference-name', required=True,
                   help='PanSN sample name for the reference path, e.g. bosTau9')
    p.add_argument('--id-step', type=int, default=10_000_000,
                   help='segment-id offset per chromosome (default 10000000)')
    return p.parse_args()


def main():
    args = parse_args()
    rank_order = args.paths.split(',')
    chroms = [int(c) for c in args.chroms.split(',')]

    chrom_sizes = {}
    with open(args.chrom_sizes) as fh:
        for line in fh:
            fields = line.split()
            if len(fields) >= 2:
                chrom_sizes[fields[0]] = int(fields[1])

    total_segs = total_links = 0
    for k in chroms:
        seq, links, paths, order = {}, [], {}, []
        with open(f'{args.indir}/{k}.gfa') as fh:
            for line in fh:
                f = line.rstrip('\n').split('\t')
                if f[0] == 'S':
                    seq[f[1]] = f[2]
                    order.append(f[1])
                elif f[0] == 'L':
                    links.append((f[1], f[2], f[3], f[4], f[5]))
                elif f[0] == 'P':
                    paths[f[1]] = f[2].split(',')

        # A path list that does not match the file exactly is a different graph
        # from the one the caller described, and guessing would put the ranks in
        # an order nobody stated. Refuse.
        missing = [p for p in rank_order if p not in paths]
        extra = [p for p in paths if p not in rank_order]
        if missing or extra:
            sys.exit(f'chr{k}: unexpected paths missing={missing} extra={extra}')

        # CAVEAT 2: the offset walk adds segment lengths, so a non-trivial
        # overlap would shift every coordinate after it.
        overlaps = {cg for *_, cg in links} - {'0M', '*'}
        if overlaps:
            sys.exit(f'chr{k}: link CIGARs are not trivial ({sorted(overlaps)[:4]}); '
                     'the offset walk would mis-coordinate every later segment')

        ann = {}
        for rank, name in enumerate(rank_order):
            sn = (f'{args.reference_name}#0#chr{k}' if rank == 0
                  else f'{name}#0#chr{k}')
            off = 0
            rev = 0
            for tok in paths[name]:
                sid, orient = tok[:-1], tok[-1]
                if orient == '-':
                    rev += 1
                if sid not in ann:
                    ann[sid] = (sn, off, rank)
                off += len(seq[sid])
            if rank == 0:
                expect = chrom_sizes[f'chr{k}']
                status = 'OK' if off == expect else f'MISMATCH expect={expect}'
                print(f'chr{k}: {name} path {len(paths[name])} segs, {off} bp, '
                      f'{rev} reverse-oriented -> {status}', file=sys.stderr)
                if off != expect:
                    sys.exit(f'chr{k}: {name} path length {off} != '
                             f'{args.reference_name} chr{k} {expect}')

        orphan = [s for s in order if s not in ann]
        if orphan:
            print(f'chr{k}: WARNING {len(orphan)} segments on no path, dropped',
                  file=sys.stderr)
        keep = set(ann)

        base = k * args.id_step
        out = sys.stdout
        for sid in order:
            if sid not in ann:
                continue
            sn, so, sr = ann[sid]
            s = seq[sid]
            out.write(f'S\ts{base + int(sid)}\t{s}\tLN:i:{len(s)}'
                      f'\tSN:Z:{sn}\tSO:i:{so}\tSR:i:{sr}\n')
            total_segs += 1
        nl = 0
        for a, ao, b, bo, cg in links:
            if a not in keep or b not in keep:
                continue
            out.write(f'L\ts{base + int(a)}\t{ao}\ts{base + int(b)}\t{bo}\t{cg}\n')
            nl += 1
        total_links += nl
        print(f'chr{k}: {len(keep)} segments, {nl} links, '
              f'ids s{base + 1}..s{base + max(int(x) for x in keep)}',
              file=sys.stderr)

    print(f'TOTAL: {total_segs} segments, {total_links} links', file=sys.stderr)


if __name__ == '__main__':
    main()
