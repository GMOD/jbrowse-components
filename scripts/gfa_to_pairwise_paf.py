#!/usr/bin/env python3
"""Unpack pairwise alignments out of a pangenome graph's GFA.

Reads a GFA1 (minigraph-cactus or pggb; W or P paths; gz accepted) once and
writes PAF on stdout: one record per chain of graph nodes a query haplotype
shares with the reference path, so the output has the same shape as
maf_to_pairwise_paf.py's -- PanSN names, `cg:Z:` over =/X/I/D, a chrom.sizes
per query -- without a HAL, a MAF or a projection through the reference.

    pigz -dc hprc-v2.0-mc-grch38.gfa.gz \\
      | python3 gfa_to_pairwise_paf.py --reference GRCh38#0 \\
          --queries HG01109#1,HG01123#1 --chrom-sizes-dir sizes/ > hprc.paf

    python3 gfa_to_pairwise_paf.py ecoli.gfa.gz --reference Sakai#0 \\
          --queries CFT073#0 > sakai_vs_cft073.paf

Any path can be the reference, so two mates align to each other directly
rather than through the reference's coordinates. Only the reference's walks
and the requested queries' are parsed; every other walk is skipped on its
sample and haplotype fields, which is what keeps a 464-haplotype graph
tractable. Node sequences are never kept, only their lengths (`LN:i:` when the
sequence is `*`); L lines are ignored. Line order is free: S lines may follow
W lines (minigraph-cactus writes one chromosome's S, L and W lines after
another's), a query walk arriving before any reference walk is held until the
end, and one arriving after is aligned at once -- which is right as long as no
later reference walk visits a node that query walked as private, and the
converter stops with a message if one does. --hold-queries holds every query
walk (as a step array) until the file is read, which is always right and costs
memory in proportion to the walks held.

Paths. A W line is `sample hap contig start end walk`, and a contig may arrive
as several W lines with different starts (minigraph-cactus writes one per
unclipped stretch); a P line `name steps overlaps` is read as PanSN
`sample#hap#contig` when the name has two `#`, else the whole name is the
sample and the contig with haplotype 0. Names are matched after `#0` is
appended to a bare sample, so `--reference K12` means `K12#0`.

Chains. Each reference contig is indexed node -> (rank, offset, orientation).
A query walk is then followed step by step: a step on a node the reference
visits is an anchor, and a chain is a run of anchors whose reference ranks
advance monotonically as the query advances -- increasing when the query
traverses the nodes in the reference's orientation, decreasing when it
traverses them flipped -- with at most --max-gap private bp skipped between
two anchors on either side. A node the reference visits more than once takes
the occurrence nearest ahead in the chain's direction, else the first. A chain
ends where the next anchor breaks monotonicity, changes relative orientation,
leaves the contig or sits past the gap, and one PAF record is written per
chain: the query interval in forward coordinates with strand `-` for a flipped
chain, the reference interval, matches and block length, mapq 255, and
`cg:Z:` in the reference's forward direction (the way minimap2 writes a `-`
row) where each shared node is `<len>=` -- two paths through one node carry
identical sequence by construction -- and the private bp between two anchors
are `min(q,r)X` then the remainder as `I` (query-only) or `D`
(reference-only), or under --no-x plain `I` then `D`. An `X` here says the
graph put different sequence between the same two anchors, not that a base
was compared: the private runs are not realigned.

--min-block <bp> drops a record whose reference span is shorter than that.
--chrom-sizes-dir <dir> writes `<sample>.<hap>.chrom.sizes` per query. A
contig's length is the largest W `end` seen for it (a P path's is its walk
length), which is the true length when the last piece reaches the contig's
end and short otherwise; --contig-lengths <chrom.sizes or .fai> supplies exact
lengths instead, keyed by contig or by `sample#hap#contig` (the first two
columns are read, so an assembly's .fai works as is). Records are written once
the input ends, since the length sits in column 2 of every row.

stderr gets a line per reference walk as it is indexed (progress, on a file
that takes half an hour), then per query walks read, anchors, chains, `=` bp
and total columns, then bytes consumed and MB/s.
"""

import argparse
import gzip
import os
import re
import sys
import time
from array import array

PAF_MAPQ = 255
WALK_CHUNK = 1 << 24
WALK_SEP = re.compile(rb'[<>]')
NODE_EXTRA = 2


def pansn_of_prefix(prefix):
    if '#' in prefix:
        result = prefix
    else:
        sample, dot, hap = prefix.rpartition('.')
        result = f'{sample}#{hap}' if dot and hap.isdigit() else f'{prefix}#0'
    return result


def parse_prefix_list(text):
    return None if text is None else [pansn_of_prefix(p.strip()) for p in text.split(',') if p.strip()]


def open_input(path):
    if path is None:
        stream = sys.stdin.buffer
        if stream.peek(2)[:2] == b'\x1f\x8b':
            stream = gzip.GzipFile(fileobj=stream)
    else:
        raw = open(path, 'rb')
        magic = raw.read(2)
        raw.seek(0)
        stream = gzip.GzipFile(fileobj=raw) if magic == b'\x1f\x8b' else raw
    return stream


class Nodes:
    """Node lengths by id, dense arrays when ids are positive integers."""

    def __init__(self):
        self.lengths = array('I', [0])
        self.index = None
        self.count = 0

    def add(self, name, length):
        self.count += 1
        if self.index is None and name.isdigit() and name[:1] != b'0':
            node = int(name)
            n = len(self.lengths)
            if node == n:
                self.lengths.append(length)
            elif node > n:
                self.lengths.frombytes(bytes(self.lengths.itemsize * (node - n)))
                self.lengths.append(length)
            else:
                self.lengths[node] = length
        else:
            if self.index is None:
                self.index = {b'%d' % i: i for i in range(1, len(self.lengths))}
            node = self.index.get(name)
            if node is None:
                node = len(self.lengths)
                self.index[name] = node
                self.lengths.append(length)
            else:
                self.lengths[node] = length

    def walk_steps(self, walk):
        if self.index is None:
            pos, n = 0, len(walk)
            while pos < n:
                m = WALK_SEP.search(walk, pos + WALK_CHUNK)
                end = m.start() if m else n
                yield from map(int, walk[pos:end].replace(b'<', b'>-').split(b'>')[1:])
                pos = end
        else:
            index = self.index
            for m in re.finditer(rb'([<>])([^<>]+)', walk):
                node = index[m.group(2)]
                yield node if m.group(1) == b'>' else -node

    def path_steps(self, steps):
        if self.index is None:
            result = [int(t[:-1]) if t[-1:] == b'+' else -int(t[:-1]) for t in steps.split(b',')]
        else:
            index = self.index
            result = [index[t[:-1]] if t[-1:] == b'+' else -index[t[:-1]] for t in steps.split(b',')]
        return result


class Reference:
    """Every reference walk laid end to end as one ranked step list."""

    def __init__(self, nodes):
        self.nodes = nodes
        self.pos = array('I')
        self.visited = bytearray()
        self.steps = array('i')
        self.offsets = array('I')
        self.extra = {}
        self.contigs = []
        self.lengths = {}

    def grow(self):
        n = len(self.nodes.lengths)
        if len(self.pos) < n:
            self.pos.frombytes(bytes(self.pos.itemsize * (n - len(self.pos))))
            self.visited.extend(bytes(n - len(self.visited)))

    def index_walk(self, contig, start, steps):
        """Rank the walk's steps after every earlier reference walk; returns
        how many of its nodes an already-aligned query walked as private."""
        self.grow()
        pos, extra, visited = self.pos, self.extra, self.visited
        lengths = self.nodes.lengths
        rank = len(self.steps)
        lo = rank
        offset = start
        late = 0
        append_step, append_offset = self.steps.append, self.offsets.append
        for step in steps:
            node = step if step > 0 else -step
            packed = ((rank + 1) << 2) | (step < 0)
            if pos[node]:
                extra.setdefault(node, []).append(packed)
                pos[node] |= NODE_EXTRA
            else:
                pos[node] = packed
            late += visited[node]
            append_step(step)
            append_offset(offset)
            offset += lengths[node]
            rank += 1
        self.contigs.append((lo, rank, contig))
        self.lengths[contig] = max(self.lengths.get(contig, 0), offset)
        return late

    def occurrences(self, node):
        first = self.pos[node]
        return [first & ~NODE_EXTRA, *self.extra[node]] if first & NODE_EXTRA else [first]

    def contig_of(self, rank):
        lo = 0
        hi = len(self.contigs)
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.contigs[mid][0] <= rank:
                lo = mid
            else:
                hi = mid
        return self.contigs[lo]


class Chain:
    __slots__ = ('lo', 'hi', 'contig', 'flipped', 'qstart', 'tfixed', 'runs')

    def __init__(self, lo, hi, contig, flipped, q, t, length):
        self.lo = lo
        self.hi = hi
        self.contig = contig
        self.flipped = flipped
        self.qstart = q
        self.tfixed = t + length if flipped else t
        self.runs = [[length, 61]]


class Query:
    __slots__ = ('name', 'walks', 'anchors', 'chains', 'matches', 'columns', 'rows', 'contig_lengths')

    def __init__(self, name):
        self.name = name
        self.walks = 0
        self.anchors = 0
        self.chains = 0
        self.matches = 0
        self.columns = 0
        self.rows = {}
        self.contig_lengths = {}


def add_run(runs, length, op):
    last = runs[-1]
    if last[1] == op:
        last[0] += length
    else:
        runs.append([length, op])


class Converter:
    def __init__(self, nodes, reference, reference_name, max_gap, min_block, pair_x):
        self.nodes = nodes
        self.reference = reference
        self.reference_name = reference_name
        self.max_gap = max_gap
        self.min_block = min_block
        self.pair_x = pair_x
        self.queries = {}

    def query(self, name):
        if name not in self.queries:
            self.queries[name] = Query(name)
        return self.queries[name]

    def align_walk(self, query, contig, start, steps):
        """Follow one walk; the chain's hot state lives in locals and the
        common step -- the next reference node, no private bp between --
        only lengthens the open `=` run."""
        ref = self.reference
        ref.grow()
        lengths = self.nodes.lengths
        pos, ref_offsets, visited = ref.pos, ref.offsets, ref.visited
        max_gap, pair_x = self.max_gap, self.pair_x
        rows = query.rows.setdefault(contig, [])
        anchors = 0
        q = start
        chain = None
        flipped = 0
        last = 0
        qend = 0
        tmoving = 0
        expect = 0
        step4 = 4
        edge = 0
        run = None
        for step in steps:
            if step > 0:
                node = step
                reversed_step = 0
            else:
                node = -step
                reversed_step = 1
            length = lengths[node]
            p = pos[node]
            if p:
                anchors += 1
                if q == qend and p == expect | (reversed_step ^ flipped):
                    run[0] += length
                    qend = q + length
                    last += 1 if step4 > 0 else -1
                    expect = -1 if last == edge else expect + step4
                    tmoving = tmoving - length if flipped else tmoving + length
                else:
                    candidates = ref.occurrences(node) if p & NODE_EXTRA else (p,)
                    chosen = None
                    if chain is not None:
                        for c in candidates:
                            rank = (c >> 2) - 1
                            if ((c & 1) ^ reversed_step) == flipped and chain.lo <= rank < chain.hi:
                                if (rank < last) if flipped else (rank > last):
                                    if chosen is None or (rank > chosen if flipped else rank < chosen):
                                        chosen = rank
                        if chosen is not None:
                            t = ref_offsets[chosen]
                            qgap = q - qend
                            rgap = tmoving - (t + length) if flipped else t - tmoving
                            if qgap <= max_gap and rgap <= max_gap:
                                runs = chain.runs
                                if pair_x:
                                    x = qgap if qgap < rgap else rgap
                                    if x:
                                        add_run(runs, x, 88)
                                    if qgap > x:
                                        add_run(runs, qgap - x, 73)
                                    if rgap > x:
                                        add_run(runs, rgap - x, 68)
                                else:
                                    if qgap:
                                        add_run(runs, qgap, 73)
                                    if rgap:
                                        add_run(runs, rgap, 68)
                                add_run(runs, length, 61)
                                run = runs[-1]
                                last = chosen
                                qend = q + length
                                tmoving = t if flipped else t + length
                                expect = -1 if last == edge else ((last + 1) << 2) + step4
                            else:
                                chosen = None
                    if chosen is None:
                        if chain is not None:
                            self.emit(query, rows, chain, qend, tmoving)
                        c = candidates[0]
                        last = (c >> 2) - 1
                        flipped = (c & 1) ^ reversed_step
                        lo, hi, ref_contig = ref.contig_of(last)
                        t = ref_offsets[last]
                        chain = Chain(lo, hi, ref_contig, flipped, q, t, length)
                        run = chain.runs[0]
                        qend = q + length
                        tmoving = t if flipped else t + length
                        step4 = -4 if flipped else 4
                        edge = lo if flipped else hi - 1
                        expect = -1 if last == edge else ((last + 1) << 2) + step4
            else:
                visited[node] = 1
            q += length
        if chain is not None:
            self.emit(query, rows, chain, qend, tmoving)
        query.walks += 1
        query.anchors += anchors
        return q

    def emit(self, query, rows, chain, qend, tmoving):
        tstart, tend = (tmoving, chain.tfixed) if chain.flipped else (chain.tfixed, tmoving)
        if tend - tstart >= max(self.min_block, 1):
            runs = chain.runs[::-1] if chain.flipped else chain.runs
            matches = sum(n for n, op in runs if op == 61)
            columns = sum(n for n, op in runs)
            rows.append((
                chain.qstart,
                qend,
                chain.flipped,
                chain.contig,
                tstart,
                tend,
                matches,
                columns,
                b''.join(b'%d%c' % (n, op) for n, op in runs),
            ))
            query.chains += 1
            query.matches += matches
            query.columns += columns

    def write_paf(self, out, contig_lengths):
        for query in self.queries.values():
            for contig, rows in query.rows.items():
                qname = f'{query.name}#{contig}'.encode()
                qlen = contig_lengths.get(qname, contig_lengths.get(contig.encode(), query.contig_lengths[contig]))
                for qstart, qend, flipped, ref_contig, tstart, tend, matches, columns, cigar in rows:
                    out.write(b'\t'.join([
                        qname,
                        b'%d' % qlen,
                        b'%d' % qstart,
                        b'%d' % qend,
                        b'-' if flipped else b'+',
                        f'{self.reference_name}#{ref_contig}'.encode(),
                        b'%d' % self.reference.lengths[ref_contig],
                        b'%d' % tstart,
                        b'%d' % tend,
                        b'%d' % matches,
                        b'%d' % columns,
                        b'%d' % PAF_MAPQ,
                        b'cg:Z:' + cigar,
                    ]) + b'\n')

    def write_chrom_sizes(self, directory, contig_lengths):
        os.makedirs(directory, exist_ok=True)
        for query in self.queries.values():
            sample, hap = query.name.split('#', 1)
            sizes = {
                contig: contig_lengths.get(f'{query.name}#{contig}'.encode(), contig_lengths.get(contig.encode(), size))
                for contig, size in query.contig_lengths.items()
            }
            with open(os.path.join(directory, f'{sample}.{hap}.chrom.sizes'), 'w') as fh:
                for contig, size in sorted(sizes.items(), key=lambda item: (-item[1], item[0])):
                    fh.write(f'{contig}\t{size}\n')


def read_contig_lengths(path):
    lengths = {}
    if path is not None:
        with open(path, 'rb') as fh:
            for line in fh:
                fields = line.split()
                if len(fields) >= 2:
                    lengths[fields[0]] = int(fields[1])
    return lengths


def path_name_parts(name):
    fields = name.split(b'#')
    return (
        (fields[0].decode(), fields[1].decode(), b'#'.join(fields[2:]).decode())
        if len(fields) >= 3
        else (name.decode(), '0', name.decode())
    )


def run(stream, out, reference, queries, max_gap, min_block, pair_x, hold_queries, chrom_sizes_dir, contig_lengths_path):
    started = time.monotonic()
    consumed = 0
    nodes = Nodes()
    ref = Reference(nodes)
    converter = Converter(nodes, ref, reference, max_gap, min_block, pair_x)
    wanted = None if queries is None else set(queries)
    held = []

    def align(name, contig, start, end, steps):
        query = converter.query(name)
        walked = converter.align_walk(query, contig, start, steps)
        query.contig_lengths[contig] = max(query.contig_lengths.get(contig, 0), walked, end)

    def walk_of(name, contig, start, end, steps):
        if name == reference:
            late = ref.index_walk(contig, start, steps)
            sys.stderr.write(f'{reference}#{contig}: {ref.contigs[-1][1] - ref.contigs[-1][0]} steps, {ref.lengths[contig]} bp; {time.monotonic() - started:.0f}s\n')
            if late:
                raise SystemExit(
                    f'{reference} {contig}:{start} arrived after a query walk that visits {late} of its nodes had '
                    f'already been aligned; re-run with --hold-queries'
                )
        elif hold_queries or not ref.contigs:
            held.append((name, contig, start, end, array('i', steps)))
        else:
            align(name, contig, start, end, steps)

    for line in stream:
        consumed += len(line)
        lead = line[0]
        if lead == 83:
            tab1 = line.index(b'\t', 2)
            tab2 = line.find(b'\t', tab1 + 1)
            seqlen = (len(line) - 1 if tab2 < 0 else tab2) - tab1 - 1
            if seqlen == 1 and line[tab1 + 1] == 42:
                m = re.search(rb'\tLN:i:(\d+)', line)
                seqlen = int(m.group(1)) if m else 0
            nodes.add(line[2:tab1], seqlen)
        elif lead == 87:
            tab1 = line.index(b'\t', 2)
            tab2 = line.index(b'\t', tab1 + 1)
            name = f'{line[2:tab1].decode()}#{line[tab1 + 1:tab2].decode()}'
            if name == reference or wanted is None or name in wanted:
                fields = line[tab2 + 1 :].rstrip(b'\n').split(b'\t', 4)
                contig = fields[0].decode()
                start = 0 if fields[1] == b'*' else int(fields[1])
                end = 0 if fields[2] == b'*' else int(fields[2])
                walk_of(name, contig, start, end, nodes.walk_steps(fields[3]))
        elif lead == 80:
            tab1 = line.index(b'\t', 2)
            sample, hap, contig = path_name_parts(line[2:tab1])
            name = f'{sample}#{hap}'
            if name == reference or wanted is None or name in wanted:
                tab2 = line.find(b'\t', tab1 + 1)
                walk_of(name, contig, 0, 0, nodes.path_steps(line[tab1 + 1 : len(line) - 1 if tab2 < 0 else tab2]))
    if not ref.contigs:
        raise SystemExit(f'no {reference} walk in the input; is --reference right? (a bare sample means haplotype 0)')
    for name, contig, start, end, steps in held:
        align(name, contig, start, end, steps)
    contig_lengths = read_contig_lengths(contig_lengths_path)
    converter.write_paf(out, contig_lengths)
    if chrom_sizes_dir is not None:
        converter.write_chrom_sizes(chrom_sizes_dir, contig_lengths)
    elapsed = time.monotonic() - started
    for query in converter.queries.values():
        sys.stderr.write(
            f'{query.name}: {query.walks} walks, {query.anchors} anchors -> {query.chains} chains, '
            f'{query.matches} bp =, {query.columns} columns\n'
        )
    unseen = [q for q in queries or [] if q not in converter.queries]
    sys.stderr.write(
        f'{nodes.count} nodes, {len(ref.steps)} {reference} steps on {len(ref.contigs)} walks; '
        f'{consumed / 1e6:.0f} MB in {elapsed:.1f}s ({consumed / 1e6 / max(elapsed, 1e-9):.0f} MB/s)'
        + (f'; no walks for {",".join(unseen)}' if unseen else '')
        + '\n'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('gfa', nargs='?', help='GFA file, gz accepted; default stdin (pigz -dc file.gfa.gz | ... is faster for big files)')
    parser.add_argument('--reference', required=True, help='reference sample#hap, e.g. GRCh38#0 or K12#0 (a bare sample means #0)')
    parser.add_argument('--queries', help='comma-separated query sample#hap list; default every other sample#hap seen')
    parser.add_argument('--max-gap', type=int, default=10000, help='a chain may skip up to this many private bp on either side between two anchors')
    parser.add_argument('--min-block', type=int, default=0, help='drop records spanning fewer reference bp than this')
    parser.add_argument('--chrom-sizes-dir', help='write <sample>.<hap>.chrom.sizes per query here')
    parser.add_argument('--no-x', action='store_true', help='write private runs as I then D instead of pairing them as X')
    parser.add_argument('--hold-queries', action='store_true', help='align every query walk after the whole file is read, for a file whose reference walks come after query walks that share their nodes')
    parser.add_argument('--contig-lengths', help='chrom.sizes or .fai giving exact query contig lengths, keyed by contig or sample#hap#contig')
    args = parser.parse_args()
    run(
        open_input(args.gfa),
        sys.stdout.buffer,
        pansn_of_prefix(args.reference),
        parse_prefix_list(args.queries),
        args.max_gap,
        args.min_block,
        not args.no_x,
        args.hold_queries,
        args.chrom_sizes_dir,
        args.contig_lengths,
    )


if __name__ == '__main__':
    main()
