#!/usr/bin/env python3
"""Unpack pairwise alignments out of a reference-projected MAF.

Reads MAF on stdin -- what `taffy view -i <taf> -r <ref.contig>:<s>-<e> -m`
emits from a cactus/hal2maf alignment such as the HPRC minigraph-cactus graph
projected onto GRCh38 -- and writes PAF on stdout, one record per run of
consecutive blocks in which a query haplotype continues exactly where it left
off on both the reference and its own sequence, on the same strand. Cactus
blocks tile the reference, so this chaining is what turns millions of block
rows into alignment-sized records; a gap on either side, a strand flip, a
contig change, or a block the haplotype is absent from ends the record.

    taffy view -i hprc.taf.gz -r GRCh38.chr22:0-50818468 -m \\
      | python3 maf_to_pairwise_paf.py --reference GRCh38 \\
          --queries HG01109#1,HG01123#1 --chrom-sizes-dir sizes/ > chr22.paf

Sequence naming. hal2maf writes `<genome>.<contig>` and the HPRC graph's genomes
are `<sample>.<hap>`, so a row reads `HG01109.1.JAHEPA020000012.1` while the
reference reads `GRCh38.chr22`; a PanSN-named MAF reads `HG01109#1#JAHEPA...`.
The file's convention is detected from its first block. A prefix passed to
--reference/--queries may be spelled either way (`HG01109#1` or `HG01109.1`;
`GRCh38` means `GRCh38#0`), and output names are always PanSN,
`<sample>#<hap>#<contig>`, which is what `jbrowse make-pif` and
MultiGenomeIndexedPAFAdapter's assemblyNameToPanSN expect. With --queries omitted
every non-reference genome is a query, and a dotted name is split as
`<sample>.<hap>` when its second field is an integer followed by more fields,
else on its first dot.

The CIGAR is `cg:Z:` over =/X/I/D read straight off the two rows' columns: `=`
where the bases agree case-insensitively, `X` where they differ, `I` where the
reference row has a gap, `D` where the query row does, and a column both rows
gap is dropped. An N on either side is a mismatch, since an unknown base is not
evidence of identity. Columns 2 and 7 are the MAF rows' srcSize; a `-` strand
row's coordinates are converted to PAF's forward-strand query interval with
strand `-`, and such rows chain across blocks as the reference advances and the
forward query coordinate retreats. Output is ordered by reference position, as
the blocks arrive.

--max-gap <bp> relaxes the chain: when a haplotype's next row resumes within
that many bp on both sequences (same contig and strand, both coordinates
advancing), the skipped query bases join the record as an insertion and the
skipped reference bases as a deletion, which is what hal2maf's projection drops
at block boundaries -- at 0, the default, only exact continuations chain and
the HPRC graph unpacks to ~10 kb records where a jump of one unaligned query
base is enough to split them. Bases bridged this way are unaligned in the
graph; a few may also appear aligned elsewhere in another record.
--min-block <bp> drops a record whose reference span is shorter than that.
--chrom-sizes-dir <dir> writes one `<sample>.<hap>.chrom.sizes` per query
listing every contig seen in its rows with its srcSize, so a demo's assemblies
can come from the same alignment.

Throughput is reported on stderr. The full MAF stream is hundreds of bytes per
reference base at HPRC depth, so a pre-filter keeping only `a` lines and the
`s` lines of the reference and queries (`LC_ALL=C grep -E`) ahead of this
script cuts what python has to look at by the depth of the alignment; the
converter is correct on the unfiltered stream too.
"""

import argparse
import os
import re
import sys
import time

PAF_MAPQ = 255
GAP = 0x10
RUN = re.compile(rb'=+|X+|I+|D+')


def code_table(gap, other):
    table = bytearray([other] * 256)
    for i, base in enumerate(b'ACGT', 1):
        table[base] = i
        table[base + 32] = i
    table[ord('-')] = gap
    return bytes(table)


REF_CODES = code_table(GAP, 0x08)
QUERY_CODES = code_table(GAP * 2, 0x0C)
OP_TABLE = bytes(
    ord('=') if x == 0 else ord('X') if x < GAP else ord('I') if x < GAP * 2 else ord('D') if x < GAP * 3 else ord('X')
    for x in range(256)
)
BOTH_GAPS = bytes(range(GAP * 3, GAP * 4))


def column_ops(ref_seq, query_seq):
    n = len(ref_seq)
    if len(query_seq) != n:
        raise SystemExit(f'rows of {n} and {len(query_seq)} columns in one block; the MAF is malformed')
    r = int.from_bytes(ref_seq.translate(REF_CODES), 'big')
    q = int.from_bytes(query_seq.translate(QUERY_CODES), 'big')
    return (r ^ q).to_bytes(n, 'big').translate(OP_TABLE, BOTH_GAPS)


def pansn_of_prefix(prefix):
    if '#' in prefix:
        result = prefix
    else:
        sample, dot, hap = prefix.rpartition('.')
        result = f'{sample}#{hap}' if dot and hap.isdigit() else f'{prefix}#0'
    return result


def dotted_spellings(pansn):
    sample, hap = pansn.split('#', 1)
    return [f'{sample}.{hap}', sample] if hap == '0' else [f'{sample}.{hap}']


def split_dotted_name(name):
    fields = name.split('.')
    return (
        ('.'.join(fields[:2]), '.'.join(fields[2:]))
        if len(fields) > 2 and fields[1].isdigit()
        else (fields[0], '.'.join(fields[1:]))
    )


def name_of(line):
    tab = line.find(b'\t', 2)
    return line[2:tab] if tab > 0 else line.split(None, 2)[1]


class Naming:
    def __init__(self, pansn_names, reference, queries):
        self.pansn_names = pansn_names
        self.reference = reference
        self.queries = queries
        self.cache = {}

    def resolve(self, name):
        if name not in self.cache:
            self.cache[name] = self._resolve(name.decode())
        return self.cache[name]

    def _resolve(self, name):
        if self.pansn_names:
            sample, _, rest = name.partition('#')
            hap, _, contig = rest.partition('#')
            prefix = f'{sample}#{hap}'
        elif self.queries is None:
            dotted, contig = split_dotted_name(name)
            prefix = pansn_of_prefix(dotted)
        else:
            prefix, contig = None, None
            for candidate in [self.reference, *self.queries]:
                for spelling in dotted_spellings(candidate):
                    if contig is None and name.startswith(spelling + '.'):
                        prefix, contig = candidate, name[len(spelling) + 1 :]
        wanted = prefix is not None and (
            prefix == self.reference or self.queries is None or prefix in self.queries
        )
        return (prefix, contig) if wanted else None


class Chain:
    __slots__ = ('query', 'qstrand', 'qsize', 'qstart', 'qend', 'target', 'tsize', 'tstart', 'tend', 'runs', 'matches', 'columns')

    def __init__(self, query, qstrand, qsize, qstart, target, tsize, tstart):
        self.query = query
        self.qstrand = qstrand
        self.qsize = qsize
        self.qstart = qstart
        self.qend = qstart
        self.target = target
        self.tsize = tsize
        self.tstart = tstart
        self.tend = tstart
        self.runs = []
        self.matches = 0
        self.columns = 0

    def add_run(self, length, op):
        last = self.runs[-1] if self.runs else None
        if last is not None and last[1] == op:
            last[0] += length
        else:
            self.runs.append([length, op])
        self.columns += length

    def add_ops(self, ops):
        for m in RUN.finditer(ops):
            self.add_run(m.end() - m.start(), ops[m.start()])
        self.matches += ops.count(b'=')

    def paf_line(self):
        forward_start, forward_end = (
            (self.qstart, self.qend)
            if self.qstrand == b'+'
            else (self.qsize - self.qend, self.qsize - self.qstart)
        )
        return b'\t'.join([
            self.query,
            b'%d' % self.qsize,
            b'%d' % forward_start,
            b'%d' % forward_end,
            self.qstrand,
            self.target,
            b'%d' % self.tsize,
            b'%d' % self.tstart,
            b'%d' % self.tend,
            b'%d' % self.matches,
            b'%d' % self.columns,
            b'%d' % PAF_MAPQ,
            b'cg:Z:' + b''.join(b'%d%c' % (n, op) for n, op in self.runs),
        ]) + b'\n'


class Converter:
    def __init__(self, naming, min_block, max_gap, out):
        self.naming = naming
        self.min_block = min_block
        self.max_gap = max_gap
        self.out = out
        self.open = {}
        self.prev_target = None
        self.contig_sizes = {}
        self.records = 0
        self.rows = 0

    def block(self, ref, rows):
        target, tstart, tlen, tsize, ref_seq = ref
        if target != self.prev_target:
            self.flush_all()
        self.flush_unreachable(tstart)
        for query, qcontig, qstart, qlen, qstrand, qsize, seq in rows:
            self.rows += 1
            self.contig_sizes.setdefault(query, {})[qcontig] = qsize
            ops = column_ops(ref_seq, seq)
            if ops:
                name = f'{query}#{qcontig}'.encode()
                chains = self.open.setdefault((name, qstrand), [])
                chain = self.take_chain(chains, qstart, tstart)
                if chain is None:
                    chain = Chain(name, qstrand, qsize, qstart, target, tsize, tstart)
                else:
                    tgap, qgap = tstart - chain.tend, qstart - chain.qend
                    if tgap:
                        chain.add_run(tgap, ord('D'))
                    if qgap:
                        chain.add_run(qgap, ord('I'))
                chains.append(chain)
                chain.qend = qstart + qlen
                chain.tend = tstart + tlen
                chain.add_ops(ops)
        self.flush_unreachable(tstart + tlen)
        self.prev_target = target

    def take_chain(self, chains, qstart, tstart):
        best = None
        for chain in chains:
            qgap, tgap = qstart - chain.qend, tstart - chain.tend
            if 0 <= qgap <= self.max_gap and 0 <= tgap <= self.max_gap:
                if best is None or qgap + tgap < (qstart - best.qend) + (tstart - best.tend):
                    best = chain
        if best is not None:
            chains.remove(best)
        return best

    def flush_unreachable(self, next_tstart):
        for key, chains in list(self.open.items()):
            kept = []
            for chain in chains:
                if next_tstart - chain.tend > self.max_gap:
                    self.emit(chain)
                else:
                    kept.append(chain)
            if kept:
                self.open[key] = kept
            else:
                del self.open[key]

    def flush_all(self):
        for chains in self.open.values():
            for chain in chains:
                self.emit(chain)
        self.open = {}

    def emit(self, chain):
        if chain.tend - chain.tstart >= max(self.min_block, 1) and chain.qend > chain.qstart:
            self.out.write(chain.paf_line())
            self.records += 1

    def write_chrom_sizes(self, directory):
        os.makedirs(directory, exist_ok=True)
        for query, contigs in self.contig_sizes.items():
            sample, hap = query.split('#', 1)
            with open(os.path.join(directory, f'{sample}.{hap}.chrom.sizes'), 'w') as fh:
                for contig, size in sorted(contigs.items(), key=lambda item: (-item[1], item[0])):
                    fh.write(f'{contig}\t{size}\n')


def parse_prefix_list(text):
    return None if text is None else [pansn_of_prefix(p.strip()) for p in text.split(',') if p.strip()]


def run(stdin, stdout, reference, queries, min_block, max_gap, chrom_sizes_dir):
    started = time.monotonic()
    consumed = 0
    converter = None
    ref_row = None
    rows = []
    first_block = []

    def start_converter():
        nonlocal converter
        pansn_names = all(name_of(line).count(b'#') >= 2 for line in first_block)
        converter = Converter(Naming(pansn_names, reference, queries), min_block, max_gap, stdout)
        for line in first_block:
            take_row(line)

    def finish_block():
        nonlocal ref_row, rows
        if ref_row is not None:
            converter.block(ref_row, rows)
        elif rows:
            raise SystemExit(f'a block with {len(rows)} query rows has no {reference} row; is --reference right?')
        ref_row, rows = None, []

    def take_row(line):
        nonlocal ref_row
        resolved = converter.naming.resolve(name_of(line))
        if resolved is not None:
            prefix, contig = resolved
            fields = line.split()
            start, size, strand, src_size, seq = int(fields[2]), int(fields[3]), fields[4], int(fields[5]), fields[6]
            if prefix == reference:
                if strand != b'+':
                    raise SystemExit(f'reference row {contig} on the - strand; project the alignment onto {reference} first')
                if ref_row is not None:
                    raise SystemExit(f'two {reference} rows in one block at {contig}:{start}')
                ref_row = (f'{reference}#{contig}'.encode(), start, size, src_size, seq)
            else:
                rows.append((prefix, contig, start, size, strand, src_size, seq))

    for line in stdin:
        consumed += len(line)
        lead = line[:1]
        if lead == b's':
            if converter is None:
                first_block.append(line)
            else:
                take_row(line)
        elif lead == b'a':
            if converter is None:
                if first_block:
                    start_converter()
                    finish_block()
            else:
                finish_block()
    if converter is None:
        start_converter()
    finish_block()
    converter.flush_all()
    if chrom_sizes_dir is not None:
        converter.write_chrom_sizes(chrom_sizes_dir)
    elapsed = time.monotonic() - started
    unseen = [q for q in queries or [] if q not in converter.contig_sizes]
    sys.stderr.write(
        f'{consumed / 1e6:.0f} MB in {elapsed:.1f}s ({consumed / 1e6 / max(elapsed, 1e-9):.0f} MB/s): '
        f'{converter.rows} query rows -> {converter.records} PAF records, '
        f'{"PanSN" if converter.naming.pansn_names else "dotted"} names'
        + (f'; no rows for {",".join(unseen)}' if unseen else '')
        + '\n'
    )


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--reference', required=True, help='reference genome prefix, e.g. GRCh38 (or GRCh38#0)')
    parser.add_argument('--queries', help='comma-separated query prefixes, e.g. HG01109#1,HG01123.1; default every non-reference genome')
    parser.add_argument('--min-block', type=int, default=0, help='drop records spanning fewer reference bp than this')
    parser.add_argument('--max-gap', type=int, default=0, help='bridge a jump of up to this many unaligned bp on either sequence between consecutive blocks as I/D; 0 chains exact continuations only')
    parser.add_argument('--chrom-sizes-dir', help='write <sample>.<hap>.chrom.sizes per query here')
    args = parser.parse_args()
    run(
        sys.stdin.buffer,
        sys.stdout.buffer,
        pansn_of_prefix(args.reference),
        parse_prefix_list(args.queries),
        args.min_block,
        args.max_gap,
        args.chrom_sizes_dir,
    )


if __name__ == '__main__':
    main()
