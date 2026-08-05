#!/usr/bin/env python3
"""Find multi-hop structural-variant paths in a somatic SV VCF and reconstruct
the derivative allele they imply, for the "complex rearrangements" tutorial
(website/docs/tutorials/cancer_sv.md).

A gene fusion does not need a single variant. Two genes can be brought together
by a chain of junctions, and when the reference segments between those junctions
are short enough, one long read crosses the whole chain. That is what
SplitThreader searched for in SK-BR-3 (Nattestad 2018); this does the same
search against any somatic SV VCF (nanomonsv, Severus, GRIDSS, Sniffles2, ...)
and then rebuilds the allele from the reads that span it.

  chains   parse the VCF, join junctions whose endpoints sit within --max-segment
           of each other, and print each chain with the --loci string for `derive`

  derive   pull the reads spanning every locus of a chain, build a consensus
           derivative contig from them, align that contig back to the reference,
           and realign the reads to it -- so the reconstruction can be shown as a
           synteny view and checked against the reads rather than hand-drawn

Requires: samtools and minimap2 on PATH, plus tabix for --genes.

Usage:
  sv_multihop.py chains somatic.sv.vcf.gz [--max-segment 20000]
  sv_multihop.py derive --aln tumor.cram --ref GRCh38.fa \\
      --loci chr3:25359568,chr10:58717464,chr12:72273112 --out der3
  sv_multihop.py derive ... --jbrowse-out config.json   # + a browsable config
"""

import argparse
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

BND_MATE = re.compile(r'[\[\]]([^\[\]:]+):(\d+)[\[\]]')
CONTIG_ID = re.compile(r'##contig=<[^>]*ID=([^,>]+)')

# How far apart the two records of one reciprocal breakend pair may place the
# same junction and still be read as one. See dedupe_junctions.
DEDUP_TOLERANCE = 10


def open_maybe_gzip(path):
    return gzip.open(path, 'rt') if path.endswith('.gz') else open(path)


def info_field(info, key):
    r"""One INFO value, matched from the start of its own field.

    Unanchored, `END=(\d+)` also matches the END inside `CIEND=5,10`, and
    re.search takes the first hit -- so a record that writes its confidence
    interval before its END gets a junction at position 5 and no complaint. The
    same applies to any caller-specific INFO key ending in the one being asked
    for (`OLDSVTYPE=DEL` for `SVTYPE`).
    """
    m = re.search(rf'(?:^|;){key}=([^;]*)', info)
    return m.group(1) if m else None


def dedupe_junctions(junctions, tolerance):
    """One entry per adjacency, from records that describe some of them twice.

    A breakend and its mate are one junction written from both ends, so the pair
    collapses on the two positions it names. Callers disagree about those
    positions by a base or two -- which side of the junction the coordinate sits
    on is a convention, and an imprecise caller carries a CIPOS besides -- and
    matching them exactly then keeps both records, reporting every adjacency
    twice and a 3-junction chain as 6.

    The tolerance is a few bases on purpose, and is not --max-segment. Two
    junctions joining the same pair of chromosomes 20 kb apart are two
    junctions; linking those rather than merging them is the whole job of
    `chains`, and a dedup wide enough to swallow them would delete the chain it
    is looking for.
    """
    def ends(junction):
        return tuple(sorted((c.lower(), p) for c, p in junction))

    width = max(1, tolerance)
    kept, index = [], {}
    for junction in junctions:
        (ca, pa), (cb, pb) = ends(junction)
        # the same 3x3 bucket probe as find_chains: two positions within the
        # tolerance share a bucket or sit in adjacent ones, on each axis
        seen = any(
            abs(qa - pa) <= tolerance and abs(qb - pb) <= tolerance
            for da in (-1, 0, 1)
            for db in (-1, 0, 1)
            for qa, qb in index.get((ca, cb, pa // width + da, pb // width + db), ())
        )
        if seen:
            continue
        kept.append(junction)
        index.setdefault((ca, cb, pa // width, pb // width), []).append((pa, pb))
    return kept


def parse_junctions(vcf, dedup_tolerance=DEDUP_TOLERANCE):
    """Every VCF record that joins two reference loci, as ((chrom, pos), ...).

    Breakend records name their partner in the ALT; symbolic DEL/DUP/INV records
    carry it in INFO END. Reciprocal breakend pairs describe one junction twice,
    so they are collapsed.
    """
    junctions = []
    contigs = {}
    for line in open_maybe_gzip(vcf):
        if line.startswith('#'):
            m = CONTIG_ID.match(line)
            if m:
                contigs.setdefault(m.group(1).lower(), m.group(1))
            continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 8:
            continue
        chrom, pos, alt, info = f[0], int(f[1]), f[4], f[7]
        contigs.setdefault(chrom.lower(), chrom)
        svtype = info_field(info, 'SVTYPE')
        if svtype == 'BND':
            m = BND_MATE.search(alt)
            if m:
                junctions.append(((chrom, pos), (m.group(1), int(m.group(2)))))
        elif svtype in ('DEL', 'DUP', 'INV'):
            end = info_field(info, 'END')
            if end and end.isdigit():
                junctions.append(((chrom, pos), (chrom, int(end))))

    # Callers vary on refName case in the ALT bracket (CHR12 against a chr12
    # CHROM). Resolving the mate to the spelling the file itself uses does two
    # jobs at once: reciprocal pairs match, so they collapse, and the loci
    # `chains` prints stay usable as samtools regions against the reference the
    # callset was made on. Lower-casing them reaches only the first -- on any
    # assembly not spelled in lower case (Chr1, scaffold names, 1/2/3 with a
    # `chr` prefix elsewhere) `derive` is then handed a region that does not
    # exist.
    def canonical(endpoint):
        return (contigs.get(endpoint[0].lower(), endpoint[0]), endpoint[1])

    return dedupe_junctions(
        [(canonical(a), canonical(b)) for a, b in junctions], dedup_tolerance
    )


def find_chains(junctions, max_segment, min_hops):
    """Group junctions into chains linked by short reference segments.

    Two junctions are linked when an endpoint of one lands within max_segment of
    an endpoint of the other on the same chromosome: that intervening reference
    segment is short enough for a single read to carry both junctions. Chains are
    the connected components of that relation.

    Endpoints are bucketed by max_segment rather than compared pairwise. Every
    endpoint in one bucket is within max_segment of every other by construction,
    so a bucket is one component outright, and two neighbouring buckets join
    exactly when their closest pair does -- which leaves nothing at all to
    compare against the rest of the callset. A whole-genome VCF is tens of
    thousands of junctions and the pairwise form is quadratic in that.
    """
    parent = list(range(len(junctions)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        parent[find(i)] = find(j)

    width = max(1, max_segment)
    buckets = {}
    for i, junction in enumerate(junctions):
        for chrom, pos in junction:
            buckets.setdefault((chrom.lower(), pos // width), []).append((pos, i))

    for (chrom, b), entries in buckets.items():
        for _, i in entries[1:]:
            union(entries[0][1], i)
        # Two junctions sharing a breakpoint EXACTLY are the strongest link there
        # is -- one reference position that two adjacencies both leave from -- and
        # an earlier `endpoint_a != endpoint_b` guard here excluded precisely that
        # pair, so a chain hinged on a reused breakpoint came back as unrelated
        # singletons. Nothing below treats equality as a special case.
        nxt = buckets.get((chrom, b + 1))
        if nxt and min(p for p, _ in nxt) - max(p for p, _ in entries) <= max_segment:
            union(entries[0][1], nxt[0][1])

    groups = {}
    for i in range(len(junctions)):
        groups.setdefault(find(i), []).append(junctions[i])

    chains = [g for g in groups.values() if len(g) >= min_hops]
    chains.sort(key=len, reverse=True)
    return chains


def chain_loci(chain, max_segment):
    """One representative position per distinct locus the chain touches."""
    loci = []
    for endpoint in (e for junction in chain for e in junction):
        if not any(
            l[0].lower() == endpoint[0].lower() and abs(l[1] - endpoint[1]) <= max_segment
            for l in loci
        ):
            loci.append(endpoint)
    return sorted(loci)


def cmd_chains(args):
    junctions = parse_junctions(args.vcf, args.dedup_tolerance)
    print(f'{len(junctions)} distinct junctions in {args.vcf}')
    chains = find_chains(junctions, args.max_segment, args.min_hops)
    print(
        f'{len(chains)} chain(s) of >={args.min_hops} junctions linked by '
        f'reference segments <={args.max_segment} bp\n'
    )
    for n, chain in enumerate(chains):
        loci = chain_loci(chain, args.max_segment)
        chroms = sorted({c.lower() for c, _ in loci})
        print(f'chain {n}: {len(chain)} junctions across {len(chroms)} chromosome(s)')
        for (c1, p1), (c2, p2) in chain:
            print(f'    {c1}:{p1:,} <-> {c2}:{p2:,}')
        print('    --loci ' + ','.join(f'{c}:{p}' for c, p in loci) + '\n')


CIGAR_OP = re.compile(r'(\d+)([MIDNSHP=X])')


def reference_span(cigar):
    return sum(int(n) for n, op in CIGAR_OP.findall(cigar) if op in 'MDN=X')


def primary_records(sam_path):
    """(name, sequence, [(chrom, start, end), ...]) per primary alignment.

    The segment list is the read's whole path across the genome: its own locus
    plus each supplementary alignment named in SA.
    """
    for line in open(sam_path):
        if line.startswith('@'):
            continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 11:
            continue
        start = int(f[3])
        segments = [(f[2], start, start + reference_span(f[5]))]
        for field in f[11:]:
            if field.startswith('SA:Z:'):
                for entry in field[5:].rstrip(';').split(';'):
                    parts = entry.split(',')
                    if len(parts) >= 5:
                        sa_start = int(parts[1])
                        segments.append(
                            (parts[0], sa_start, sa_start + reference_span(parts[3]))
                        )
        yield f[0], f[9], segments


def touches_all(segments, loci, tolerance):
    """Every locus falls inside (or within tolerance of) some aligned segment.

    Testing containment rather than proximity to a segment start is what lets a
    read whose chr3 arm begins 50 kb away still count as crossing a chr3
    breakpoint at its far end.
    """
    return all(
        any(
            s[0].lower() == c.lower() and s[1] - tolerance <= p <= s[2] + tolerance
            for s in segments
        )
        for c, p in loci
    )


def run(cmd, **kw):
    print('  $ ' + ' '.join(cmd), file=sys.stderr)
    return subprocess.run(cmd, check=True, **kw)


def run_out(cmd, path, **kw):
    """run(), writing stdout to a file that is then closed."""
    with open(path, 'w') as fh:
        return run(cmd, stdout=fh, **kw)


def require_tools(*tools):
    """Fail before the expensive fetch, not after it.

    `derive` reads the alignment file once and it may be a remote URL, so a
    minimap2 that is not installed otherwise surfaces as a traceback several
    minutes into the run.
    """
    missing = [t for t in tools if shutil.which(t) is None]
    if missing:
        sys.exit(f'not on PATH: {", ".join(missing)}')


def align_and_sort(target_fa, reads_fa, out_bam, preset, threads, tmp):
    """minimap2 -ax | sort | index, which derive does twice: once to polish the
    backbone into a consensus, once to realign the reads to the result."""
    sam = os.path.join(tmp, os.path.basename(out_bam) + '.sam')
    run_out(['minimap2', '-ax', preset, '-t', str(threads), target_fa, reads_fa],
            sam, stderr=subprocess.DEVNULL)
    run(['samtools', 'sort', '-@', str(threads), '-o', out_bam, sam])
    run(['samtools', 'index', out_bam])


def read_fai(fasta):
    """Reference sequence lengths, from the FASTA index."""
    if not os.path.exists(fasta + '.fai'):
        run(['samtools', 'faidx', fasta])
    lengths = {}
    for line in open(fasta + '.fai'):
        f = line.split('\t')
        lengths[f[0]] = int(f[1])
    return lengths


def merge_spans(spans, pad):
    """Padded, merged (chrom, start, end) windows, one per stretch of reference.

    The derivative's arms come back as several PAF rows per chromosome; a panel
    showing one locstring per row would repeat the same window.
    """
    merged = []
    for chrom, start, end in sorted(spans):
        window = (chrom, max(1, start - pad), end + pad)
        if merged and merged[-1][0] == chrom and window[1] <= merged[-1][2]:
            merged[-1] = (chrom, merged[-1][1], max(merged[-1][2], window[2]))
        else:
            merged.append(window)
    return merged


def unplaced_gaps(rows, contig_length, min_segment):
    """Stretches of the contig that no first-pass alignment covers.

    A templated insert of a couple of hundred bases will not survive chaining
    against a 30 kb arm, however fine the seeding, so each of these is realigned
    on its own afterwards. Those inserts are the whole point of the figure, so
    losing them is not an option.
    """
    gaps, cursor = [], 0
    for f in sorted(rows, key=lambda f: int(f[2])):
        if int(f[2]) - cursor >= min_segment:
            gaps.append((cursor, int(f[2])))
        cursor = max(cursor, int(f[3]))
    if contig_length - cursor >= min_segment:
        gaps.append((cursor, contig_length))
    return gaps


def place_gap_row(row, name, contig_length, start):
    """A second-pass PAF row, rewritten as a row of the whole contig.

    The fragment was cut out and aligned on its own, so its query name, length
    and coordinates are the fragment's; only the target side arrives correct.
    Left alone, the recovered segment reports at the top of the contig -- it
    draws as a ribbon to the wrong part of the allele rather than as an error,
    and the segment recovered here is the templated insert the figure is about.
    """
    row[0] = name
    row[1] = str(contig_length)
    row[2] = str(int(row[2]) + start)
    row[3] = str(int(row[3]) + start)
    return row


def lift_to_chromosome(rows, chrom_length):
    """PAF rows aligned against `chrom:start-end` window sequences, rewritten
    against whole chromosomes.

    The contig is aligned to windows around the chain's own loci rather than to
    the genome -- seeding fine enough to catch a 200 bp insert matches every
    repeat there is -- so every target coordinate arrives window-relative, and a
    PAF that says so is one no browser can place.
    """
    for f in rows:
        chrom, span = f[5].rsplit(':', 1)
        window_start = int(span.split('-')[0])
        f[5] = chrom
        f[6] = str(chrom_length[chrom])
        f[7] = str(int(f[7]) + window_start - 1)
        f[8] = str(int(f[8]) + window_start - 1)
    return rows


def track_ids(name, ref_name):
    return {
        'synteny': f'{name}_vs_{ref_name}',
        'segments': f'{name}_segments',
        'reads': f'{name}_reads',
        'genes': f'{name}_genes',
    }


def project_feature(row, chrom, start, end, strand):
    """One reference feature in derivative coordinates, or None if it misses.

    `row` is a PAF row: query (derivative) start/end, strand, target chromosome
    and target start/end, all 0-based half-open. `start`/`end` are the feature's
    0-based half-open reference span. A feature is clipped to the segment, since
    a junction cuts wherever it cuts -- half an exon on the derivative is the
    result being shown, not a case to drop.

    An inverted segment reverses the interval AND the feature's strand: an exon
    of a plus-strand gene spliced in backwards is transcribed on the other
    strand of the derivative, which is the thing the picture is about.

    Offsets are measured from the segment's leading edge rather than walked
    through its CIGAR, so an indel between that edge and the feature shifts it by
    the indel's length. The templated inserts this is built for align gaplessly
    (199M, 183M), and on a 30 kb arm the worst case is the arm's own indel total,
    which is under a pixel at any zoom that shows the arm.
    """
    qs, qe, seg_strand = int(row[2]), int(row[3]), row[4]
    if chrom != row[5]:
        return None
    ts, te = int(row[7]), int(row[8])
    lo, hi = max(start, ts), min(end, te)
    if lo >= hi:
        return None
    if seg_strand == '-':
        ds, de = qs + (te - hi), qs + (te - lo)
    else:
        ds, de = qs + (lo - ts), qs + (hi - ts)
    # a feature can only land inside the segment it was projected through
    return (max(qs, min(ds, qe)), max(qs, min(de, qe)), strand * (-1 if seg_strand == '-' else 1))


# The transcript row is here for the same reason the exons are: a gene glyph is
# gene -> transcript -> exon/CDS, and a projection that keeps the exons but drops
# the transcript they name as their Parent leaves them orphaned, drawn as loose
# blocks beside a bare gene bar instead of as the cut transcript.
GFF_FEATURE_TYPES = ('gene', 'mRNA', 'transcript', 'exon', 'CDS',
                     'start_codon', 'stop_codon')


def project_gff(rows, lines, name, types=GFF_FEATURE_TYPES):
    """Reference GFF3 lines projected onto the derivative, as GFF3 lines.

    Every segment is projected independently, so a gene the chain visits twice
    is written twice -- once per copy in the allele, which is what a foldback
    does to it. `ID`s and `Parent`s are suffixed with the segment for the same
    reason: it keeps each copy's hierarchy pointing within that copy.
    """
    out = []
    for line in lines:
        if line.startswith('#'):
            continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 9 or f[2] not in types:
            continue
        strand = -1 if f[6] == '-' else 1
        for i, row in enumerate(rows):
            hit = project_feature(row, f[0], int(f[3]) - 1, int(f[4]), strand)
            if hit is None:
                continue
            ds, de, dstrand = hit
            attrs = re.sub(r'\bID=([^;]*)', rf'ID=\1.seg{i}', f[8])
            # GFF3 lets a feature name several parents, comma-separated; a single
            # suffix on the whole list renames only the last and leaves the rest
            # pointing at IDs no copy carries.
            attrs = re.sub(
                r'\bParent=([^;]*)',
                lambda m: 'Parent=' + ','.join(
                    f'{p}.seg{i}' for p in m.group(1).split(',')
                ),
                attrs,
            )
            out.append('\t'.join([
                name, f[1], f[2], str(ds + 1), str(de), f[5],
                '-' if dstrand < 0 else '+', f[7], attrs,
            ]))
    out.sort(key=lambda l: int(l.split('\t')[3]))
    return out


def jbrowse_config(name, ref_name, ref_fasta, out, config_dir, genes=False):
    """The config.json that wires derive's four outputs together.

    Without it the tool leaves a reader with an assembly, a PAF, a BED and a BAM
    and no statement of how they relate: which assembly each track belongs to,
    and which side of the PAF is the derivative. Paths are relative to the
    config, so the whole output directory can be served or moved as one.
    """
    def loc(path):
        return {
            'uri': os.path.relpath(os.path.abspath(path), os.path.abspath(config_dir)),
            'locationType': 'UriLocation',
        }

    def assembly(asm_name, fasta):
        return {
            'name': asm_name,
            'sequence': {
                'type': 'ReferenceSequenceTrack',
                'trackId': f'{asm_name}-ReferenceSequenceTrack',
                'adapter': {
                    'type': 'IndexedFastaAdapter',
                    'fastaLocation': loc(fasta),
                    'faiLocation': loc(fasta + '.fai'),
                },
            },
        }

    ids = track_ids(name, ref_name)
    return {
        'assemblies': [
            assembly(ref_name, ref_fasta),
            assembly(name, f'{out}.derivative.fa'),
        ],
        'tracks': [
            {
                'type': 'SyntenyTrack',
                'trackId': ids['synteny'],
                'name': f'Derivative allele vs {ref_name}',
                'assemblyNames': [name, ref_name],
                'adapter': {
                    'type': 'PAFAdapter',
                    'pafLocation': loc(f'{out}.vs_reference.paf'),
                    # named rather than positional: the PAF's query is the
                    # derivative, and an assemblyNames array read the wrong way
                    # round renders against the wrong assembly instead of erroring
                    'queryAssembly': name,
                    'targetAssembly': ref_name,
                },
            },
            {
                'type': 'FeatureTrack',
                'trackId': ids['segments'],
                'name': 'Where each segment came from',
                'assemblyNames': [name],
                'adapter': {
                    'type': 'BedAdapter',
                    'bedLocation': loc(f'{out}.derivative_segments.bed'),
                },
            },
            *([{
                'type': 'FeatureTrack',
                'trackId': ids['genes'],
                'name': 'Reference genes projected onto the derivative',
                'assemblyNames': [name],
                'adapter': {
                    'type': 'Gff3Adapter',
                    'gffLocation': loc(f'{out}.derivative_genes.gff3'),
                },
            }] if genes else []),
            {
                'type': 'AlignmentsTrack',
                'trackId': ids['reads'],
                'name': 'Spanning reads realigned to the derivative',
                'assemblyNames': [name],
                'adapter': {
                    'type': 'BamAdapter',
                    'bamLocation': loc(f'{out}.reads_vs_derivative.bam'),
                    'index': {
                        'location': loc(f'{out}.reads_vs_derivative.bam.bai'),
                        'indexType': 'BAI',
                    },
                },
            },
        ],
    }


def session_spec(name, ref_name, rows, contig_length, pad=2000):
    """A synteny view of the reconstruction, as a `session=spec-` URL session.

    The reference panel carries one locstring per stretch the contig aligned to,
    so every ribbon has a target: a single window around one arm leaves the
    templated inserts -- the reason for the reconstruction -- pointing at nothing.
    """
    ids = track_ids(name, ref_name)
    # PAF target coordinates are 0-based half-open; a locstring is 1-based
    # inclusive, which is the same convention --genes hands to tabix.
    spans = merge_spans(
        [(f[5], int(f[7]) + 1, int(f[8])) for f in rows], pad
    )
    return {
        'views': [
            {
                'type': 'LinearSyntenyView',
                'displayName': f'{name} vs {ref_name}',
                'views': [
                    {
                        'assembly': ref_name,
                        'loc': ' '.join(f'{c}:{s}-{e}' for c, s, e in spans),
                    },
                    {
                        'assembly': name,
                        'loc': f'{name}:1-{contig_length}',
                        'tracks': [ids['segments'], ids['reads']],
                    },
                ],
                'tracks': [[ids['synteny']]],
                'drawCurves': True,
            }
        ]
    }


def cmd_derive(args):
    require_tools('samtools', 'minimap2', *(['tabix'] if args.genes else []))
    # Every intermediate is a whole uncompressed SAM -- of every read near the
    # loci, then of those reads against the backbone and against the result. On a
    # tumour BAM that is gigabytes, and on a session tmpfs it is enough to wedge
    # the machine, so they do not outlive the run.
    with tempfile.TemporaryDirectory(prefix='sv_multihop.') as tmp:
        derive(args, tmp)


def derive(args, tmp):
    loci = []
    for token in args.loci.split(','):
        chrom, pos = token.rsplit(':', 1)
        loci.append((chrom, int(pos)))

    print(f'looking for reads spanning {len(loci)} loci:')
    for c, p in loci:
        print(f'    {c}:{p:,}')

    chrom_length = read_fai(args.ref)
    missing = sorted({c for c, _ in loci if c not in chrom_length})
    if missing:
        sys.exit(f'{args.ref} has no reference sequence named: {", ".join(missing)}')

    def window(chrom, pos, half):
        """A (chrom, start, end) window around a locus, inside the chromosome."""
        return chrom, max(1, pos - half), min(pos + half, chrom_length[chrom])

    regions = [f'{c}:{s}-{e}'
               for c, s, e in (window(c, p, args.window) for c, p in loci)]

    # One pass over the alignment file, which may be a remote URL, so everything
    # after this works against a local slice.
    slice_sam = os.path.join(tmp, 'slice.sam')
    run_out(['samtools', 'view', '-F', '0x900', '-T', args.ref, args.aln, *regions],
            slice_sam)

    spanning = {
        name: seq
        for name, seq, segments in primary_records(slice_sam)
        if seq != '*' and touches_all(segments, loci, args.tolerance)
    }
    if not spanning:
        sys.exit('no read spans every locus; widen --tolerance/--window or pick a shorter chain')
    print(f'{len(spanning)} spanning reads')

    # The primary record carries the full read sequence; supplementary records
    # are hard-clipped, so they would truncate the allele.
    reads_fa = f'{args.out}.spanning_reads.fa'
    with open(reads_fa, 'w') as fh:
        for name, seq in spanning.items():
            fh.write(f'>{name}\n{seq}\n')

    # Longest spanning read is the backbone; the rest polish it into a consensus,
    # so the contig is not one molecule's error profile.
    name, seq = max(spanning.items(), key=lambda kv: len(kv[1]))
    print(f'backbone read {name} ({len(seq):,} bp)')
    backbone = os.path.join(tmp, 'backbone.fa')
    with open(backbone, 'w') as fh:
        fh.write(f'>{args.name}\n{seq}\n')

    polished_bam = os.path.join(tmp, 'polish.bam')
    align_and_sort(backbone, reads_fa, polished_bam, args.preset, args.threads, tmp)

    derivative = f'{args.out}.derivative.fa'
    raw_consensus = os.path.join(tmp, 'consensus.fa')
    run(['samtools', 'consensus', '-f', 'fasta', '--min-depth', str(args.min_depth),
         '-o', raw_consensus, polished_bam])

    # The backbone is the longest read, so it overhangs the others at one or both
    # ends and consensus masks those tails to N. Keep only the stretch actually
    # supported by --min-depth reads.
    consensus = ''.join(
        line.strip() for line in open(raw_consensus) if not line.startswith('>')
    )
    trimmed = consensus.strip('Nn')
    if not trimmed:
        sys.exit(f'no base of the backbone is supported by >={args.min_depth} '
                 'reads, so there is no contig to reconstruct; lower --min-depth '
                 'or widen --window')
    interior_n = trimmed.upper().count('N')
    if interior_n:
        print(f'warning: {interior_n} unsupported bases inside the contig')
    with open(derivative, 'w') as fh:
        fh.write(f'>{args.name}\n')
        for i in range(0, len(trimmed), 60):
            fh.write(trimmed[i : i + 60] + '\n')
    print(f'wrote {derivative} ({len(trimmed):,} bp supported by >={args.min_depth} reads)')

    # The reconstruction, aligned back to the reference: this is the synteny track.
    #
    # A templated insert can be a couple of hundred bases, far under what the asm
    # presets will chain, and losing those segments loses the point of the figure.
    # Seeding sensitive enough to keep them also matches every repeat in the
    # genome, so the target is narrowed to windows around the chain's own loci
    # and the resulting coordinates are lifted back to whole-chromosome space.
    paf = f'{args.out}.vs_reference.paf'
    subset = os.path.join(tmp, 'subset.fa')
    # Merged, because a chain that turns back on itself gives two loci on one
    # chromosome, and windows around both hold the same sequence twice: every
    # genuine hit becomes a two-way tie at MAPQ 0 and --min-mapq drops it. What
    # survives is the templated insert alone -- a reconstruction that looks like
    # a clean answer and is missing both arms.
    windows = merge_spans(
        [window(c, p, args.flank) for c, p in loci], 0
    )
    run_out(['samtools', 'faidx', args.ref,
             *(f'{c}:{s}-{e}' for c, s, e in windows)], subset)

    def align(query_fa, extra):
        out = os.path.join(tmp, 'pass.paf')
        run_out(['minimap2', '-c', '--cs', '-t', str(args.threads), *extra,
                 subset, query_fa], out, stderr=subprocess.DEVNULL)
        kept = []
        for line in open(out):
            f = line.rstrip('\n').split('\t')
            # Windows around the loci share repeats; those land at MAPQ 0 while
            # the genuine segments come back at 60.
            if int(f[11]) >= args.min_mapq:
                kept.append(f)
        return kept

    splice = ['-x', 'splice', '-u', 'n'] if args.splice else []
    rows = align(derivative, [*splice, '-k', '11', '-w', '5', '-m', '30',
                              '-s', '40', '-N', '20', '-p', '0.1'])
    rows.sort(key=lambda f: int(f[2]))

    for start, end in unplaced_gaps(rows, len(trimmed), args.min_segment):
        fragment = os.path.join(tmp, f'gap_{start}.fa')
        with open(fragment, 'w') as fh:
            fh.write(f'>gap\n{trimmed[start:end]}\n')
        found = align(fragment, [*splice, '-k', '9', '-w', '3', '-m', '20',
                                 '-s', '30', '-N', '5', '-p', '0.5'])
        if found:
            best = max(found, key=lambda r: int(r[9]))
            rows.append(place_gap_row(best, args.name, len(trimmed), start))
            print(f'    gap {start}-{end} placed by second pass')

    if not rows:
        sys.exit('no part of the contig aligned back to the reference above MAPQ '
                 f'{args.min_mapq}; widen --flank or lower --min-mapq')

    lift_to_chromosome(rows, chrom_length)
    rows.sort(key=lambda f: int(f[2]))
    with open(paf, 'w') as fh:
        for f in rows:
            fh.write('\t'.join(f) + '\n')
    print(f'wrote {paf}')
    for f in rows:
        print(f'    derivative {int(f[2]):>7}-{int(f[3]):<7} {f[4]} -> '
              f'{f[5]}:{int(f[7]):,}-{int(f[8]):,}  ({int(f[9])} matches, MQ {f[11]})')

    # The same segments as a track on the derivative itself, so a viewer can read
    # where each stretch came from without cross-referencing the other panel. A
    # gene track is a poor substitute here: a window inside one large intron
    # draws a bare line, which is what most derivative windows are.
    segments_bed = f'{args.out}.derivative_segments.bed'
    with open(segments_bed, 'w') as fh:
        for f in rows:
            span = int(f[8]) - int(f[7])
            size = f'{span / 1000:.1f} kb' if span >= 1000 else f'{span} bp'
            orientation = ' inverted' if f[4] == '-' else ''
            label = f'{f[5]}:{int(f[7]):,}-{int(f[8]):,} ({size}{orientation})'
            fh.write(
                f'{args.name}\t{f[2]}\t{f[3]}\t{label}\t0\t{f[4]}\n'
            )
    print(f'wrote {segments_bed}')

    # What the allele does to the genes it cuts, in the allele's own
    # coordinates: which exons each piece carries, and which way round. Read off
    # the reference annotation rather than asserted, so a junction landing
    # mid-exon shows as the half-exon it is.
    if args.genes:
        genes_gff = f'{args.out}.derivative_genes.gff3'
        spans = merge_spans([(f[5], int(f[7]) + 1, int(f[8])) for f in rows], 0)
        lines = run(
            ['tabix', args.genes, *(f'{c}:{s}-{e}' for c, s, e in spans)],
            stdout=subprocess.PIPE, text=True,
        ).stdout.splitlines()
        projected = project_gff(rows, lines, args.name)
        with open(genes_gff, 'w') as fh:
            fh.write('##gff-version 3\n')
            for line in projected:
                fh.write(line + '\n')
        print(f'wrote {genes_gff} ({len(projected)} features from {len(lines)} reference rows)')

    # The reads, realigned to the reconstruction: end-to-end coverage with no
    # clipping is the evidence that the reconstruction is right.
    proof = f'{args.out}.reads_vs_derivative.bam'
    align_and_sort(derivative, reads_fa, proof, args.preset, args.threads, tmp)
    print(f'wrote {proof}')

    if args.jbrowse_out:
        config_dir = os.path.dirname(os.path.abspath(args.jbrowse_out))
        os.makedirs(config_dir, exist_ok=True)
        # the derivative is served as its own assembly, which needs the index
        run(['samtools', 'faidx', derivative])
        ref_name = args.ref_name or re.sub(
            r'\.(fa|fasta|fna)(\.gz)?$', '', os.path.basename(args.ref)
        )
        config = jbrowse_config(args.name, ref_name, args.ref, args.out, config_dir,
                                genes=bool(args.genes))
        with open(args.jbrowse_out, 'w') as fh:
            json.dump(config, fh, indent=2)
            fh.write('\n')
        print(f'wrote {args.jbrowse_out}')
        spec = urllib.parse.quote(
            json.dumps(session_spec(args.name, ref_name, rows, len(trimmed)))
        )
        print(
            f'    open it with: ?config={os.path.basename(args.jbrowse_out)}'
            f'&session=spec-{spec}'
        )


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='command', required=True)

    c = sub.add_parser('chains', help='find multi-hop junction chains in a somatic SV VCF')
    c.add_argument('vcf')
    c.add_argument('--max-segment', type=int, default=20000,
                   help='longest reference segment a read may bridge between junctions')
    c.add_argument('--min-hops', type=int, default=2)
    c.add_argument('--dedup-tolerance', type=int, default=DEDUP_TOLERANCE,
                   help='how far apart the two records of one reciprocal breakend '
                        'pair may place it and still count as one junction; keep '
                        'this small, it is not --max-segment')
    c.set_defaults(func=cmd_chains)

    d = sub.add_parser('derive', help='rebuild the derivative allele from spanning reads')
    d.add_argument('--aln', required=True, help='tumour BAM/CRAM (indexed, may be a URL)')
    d.add_argument('--ref', required=True, help='reference FASTA the alignment used')
    d.add_argument('--loci', required=True, help='comma-separated chrom:pos from `chains`')
    d.add_argument('--out', required=True, help='output prefix')
    d.add_argument('--name', default='derivative', help='contig name')
    d.add_argument('--tolerance', type=int, default=5000,
                   help='how far outside an aligned segment a locus may sit and '
                        'still count as covered by it')
    d.add_argument('--window', type=int, default=2000,
                   help='half-width of the region fetched around each locus')
    d.add_argument('--flank', type=int, default=200000,
                   help='half-width of the reference window the derivative is aligned against')
    d.add_argument('--min-mapq', type=int, default=20,
                   help='drop derivative-vs-reference alignments below this MAPQ')
    d.add_argument('--min-depth', type=int, default=3,
                   help='reads required before a consensus base is called')
    d.add_argument('--min-segment', type=int, default=50,
                   help='shortest unplaced stretch of contig worth a second alignment pass')
    d.add_argument('--preset', default='map-ont',
                   help='minimap2 preset for read alignment (map-ont, map-hifi, map-pb)')
    d.add_argument('--splice', action='store_true',
                   help='align the contig to the reference splice-aware, for a '
                        'fusion transcript whose exons are adjacent in the contig '
                        'but separated by introns in the genome')
    d.add_argument('--genes', metavar='GFF_GZ',
                   help='tabix-indexed reference GFF3; its genes/exons/CDS are '
                        'projected onto the derivative as their own track')
    d.add_argument('--threads', type=int, default=4)
    d.add_argument('--jbrowse-out', metavar='CONFIG_JSON',
                   help='also write a JBrowse config.json wiring the outputs '
                        '(derivative assembly, synteny PAF, segment BED, reads BAM) '
                        'and print the session URL that opens them')
    d.add_argument('--ref-name', help='assembly name for --ref in that config '
                                      '(default: the FASTA basename)')
    d.set_defaults(func=cmd_derive)

    args = ap.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
