#!/usr/bin/env python3
"""Run `sv_multihop.py derive` end to end against a synthetic foldback.

check-build-scripts.py pins sv_multihop's pure functions. This pins the part
between them: the two-pass alignment, the merged reference windows, the gap
fill, the projection, and the files the emitted config points at. That glue is
where the bugs actually were -- an unmerged window put a chromosome into the
target twice and every genuine hit tied at MAPQ 0, and a second pass had to be
added because minimap2's chaining swallows a 200 bp insert against a 32 kb arm.
Neither is reachable from a unit check, and neither fails loudly: both leave a
reconstruction that looks like a clean answer.

The allele is built rather than downloaded, so the answer is known exactly:

    chrA[0:20000] + chrB[1000:1200] + revcomp(chrA[10000:16000])

Two arms of one chromosome in opposite orientations with a short templated
insert at the turn -- the shape of the COLO829 der(3) the tutorial is about,
small enough to run in seconds. The demo dataset is not a test of this tool; it
is one input to it, and it happens to pass one locus per chromosome, which is
exactly the case the window bug survived.

What this does NOT reach: whether the first alignment pass misses the insert at
all, which is what makes the gap fill necessary. That turned out to be an
aligner accident rather than a property of the geometry -- with the fixture
below it fired on one random seed and not on four others, and a bigger genome
made it less likely rather than more -- so pinning it here would pin a
coincidence that a minimap2 release could silently undo. The rebasing the second
pass does is checked in check-build-scripts.py (`place_gap_row`,
`unplaced_gaps`) and the pass firing for real is checked by the COLO829 run in
reference/SV_MULTIHOP.md.

Usage: python3 scripts/check_sv_multihop_pipeline.py
Requires samtools, minimap2 and tabix on PATH.
"""

import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 20260804

# the splice, in 0-based half-open reference coordinates
ARM1 = ('chrA', 0, 20000)
INSERT = ('chrB', 1000, 1200)
ARM2 = ('chrA', 10000, 16000)   # spliced in reverse-complemented

failures = []


def check(label, actual, expected):
    if actual != expected:
        failures.append(f'{label}\n     got {actual!r}\n  wanted {expected!r}')


def check_true(label, condition, detail=''):
    if not condition:
        failures.append(f'{label}{" -- " + detail if detail else ""}')


def sh(cmd, **kw):
    """Run a tool, and say which one failed rather than unwinding a traceback.

    `shutil.which` finding a name is not the same as that name working: a
    shadowed distro samtools exits 127 on every invocation, and the stack it
    raises from inside a helper says nothing useful about that.
    """
    try:
        return subprocess.run(cmd, check=True, **kw)
    except subprocess.CalledProcessError as e:
        tool = cmd if isinstance(cmd, str) else cmd[0]
        sys.exit(f'{tool} exited {e.returncode} building the fixture; '
                 f'is the one on PATH a working install?')


def build_inputs(work, rng):
    """A two-contig reference, the derivative spliced out of it, and reads.

    Reads come in two kinds, because both are load-bearing: whole molecules that
    cross every junction (what `derive` reconstructs from) and reads that touch
    one locus only (which `touches_all` has to reject, or the consensus is built
    from molecules that never saw the allele).
    """
    chrA = ''.join(rng.choice('ACGT') for _ in range(40000))
    chrB = ''.join(rng.choice('ACGT') for _ in range(5000))
    ref = os.path.join(work, 'ref.fa')
    with open(ref, 'w') as fh:
        for name, seq in (('chrA', chrA), ('chrB', chrB)):
            fh.write(f'>{name}\n')
            for i in range(0, len(seq), 60):
                fh.write(seq[i:i + 60] + '\n')

    revcomp = chrA[ARM2[1]:ARM2[2]].translate(str.maketrans('ACGT', 'TGCA'))[::-1]
    derivative = chrA[ARM1[1]:ARM1[2]] + chrB[INSERT[1]:INSERT[2]] + revcomp

    def mutate(seq, rate=0.01):
        out = []
        for base in seq:
            roll = rng.random()
            if roll < rate * 0.6:
                out.append(rng.choice('ACGT'))          # substitution
            elif roll < rate * 0.8:
                continue                                # deletion
            elif roll < rate:
                out.append(base)
                out.append(rng.choice('ACGT'))          # insertion
            else:
                out.append(base)
        return ''.join(out)

    reads = os.path.join(work, 'reads.fa')
    with open(reads, 'w') as fh:
        for i in range(12):
            start = rng.randint(0, 800)
            end = len(derivative) - rng.randint(0, 800)
            fh.write(f'>span{i}\n{mutate(derivative[start:end])}\n')
        for i in range(4):
            start = rng.randint(0, 30000)
            fh.write(f'>local{i}\n{mutate(chrA[start:start + 6000])}\n')

    aln = os.path.join(work, 'tumor.bam')
    sam = os.path.join(work, 'tumor.sam')
    with open(sam, 'w') as fh:
        sh(['minimap2', '-ax', 'map-ont', '-t', '1', ref, reads],
           stdout=fh, stderr=subprocess.DEVNULL)
    sh(['samtools', 'sort', '-o', aln, sam])
    sh(['samtools', 'index', aln])
    sh(['samtools', 'faidx', ref])

    # a gene straddling the foldback junction, so the projection has something to
    # cut: the allele carries two copies of it, in opposite orientations
    genes = os.path.join(work, 'genes.gff3')
    with open(genes, 'w') as fh:
        fh.write('##gff-version 3\n')
        fh.write('chrA\ttest\tgene\t12001\t21000\t.\t+\t.\tID=g1;Name=GENEA\n')
        fh.write('chrA\ttest\tmRNA\t12001\t21000\t.\t+\t.\tID=t1;Parent=g1\n')
        fh.write('chrA\ttest\texon\t12001\t12500\t.\t+\t.\tID=e1;Parent=t1\n')
        fh.write('chrA\ttest\texon\t19500\t21000\t.\t+\t.\tID=e2;Parent=t1\n')
    sh(f'bgzip -f {genes} && tabix -p gff {genes}.gz', shell=True)

    return ref, aln, f'{genes}.gz', len(derivative)


def parse_paf(path):
    rows = []
    for line in open(path):
        f = line.rstrip('\n').split('\t')
        rows.append({
            'qstart': int(f[2]), 'qend': int(f[3]), 'strand': f[4],
            'target': f[5], 'tstart': int(f[7]), 'tend': int(f[8]),
            'mapq': int(f[11]),
        })
    return sorted(rows, key=lambda r: r['qstart'])


def main():
    missing = [t for t in ('samtools', 'minimap2', 'bgzip', 'tabix', 'python3')
               if shutil.which(t) is None]
    if missing:
        sys.exit(f'not on PATH: {", ".join(missing)}')

    with tempfile.TemporaryDirectory(prefix='sv_multihop_check.') as work:
        rng = random.Random(SEED)
        ref, aln, genes, truth_length = build_inputs(work, rng)
        out = os.path.join(work, 'out', 'der')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        config = os.path.join(work, 'out', 'config.json')

        derive = subprocess.run(
            [sys.executable, os.path.join(HERE, 'sv_multihop.py'), 'derive',
             '--aln', aln, '--ref', ref,
             '--loci', 'chrA:20000,chrB:1100,chrA:13000',
             '--out', out, '--name', 'der1', '--threads', '1',
             '--genes', genes, '--jbrowse-out', config, '--ref-name', 'testref'],
            capture_output=True, text=True,
        )
        if derive.returncode:
            print(derive.stdout)
            print(derive.stderr, file=sys.stderr)
            sys.exit('derive exited nonzero')

        # --- the reconstruction itself -------------------------------------
        rows = parse_paf(f'{out}.vs_reference.paf')
        check('the contig aligns back as three segments', len(rows), 3)
        if len(rows) != 3:
            report(derive)
            return
        check('in derivative order: arm, insert, arm',
              [r['target'] for r in rows], ['chrA', 'chrB', 'chrA'])
        check('with the second arm inverted',
              [r['strand'] for r in rows], ['+', '+', '-'])
        # Every genuine hit ties at MAPQ 0 when the two chrA windows are not
        # merged, and --min-mapq then drops both arms, leaving the insert alone
        # looking like a clean answer.
        check('every segment at MAPQ 60', [r['mapq'] for r in rows], [60] * 3)

        # The junction edges are placed by the splice, but not to the base: with
        # a 1% error rate at the breakpoint the aligner hands a few bases either
        # way to whichever arm extends better, and which way it goes is a
        # property of its version -- the same trap as the interior N below.
        # Across six seeds the edges landed within 7 bp of the truth and never
        # further, so a window that a real mis-splice (hundreds of bases, or the
        # wrong locus entirely) still fails is what these say. The OUTER edges
        # are looser again: they are where the reads happened to start and where
        # --min-depth stopped supporting the consensus, so they are only bounded.
        def near(actual, expected, slack=25):
            return abs(actual - expected) <= slack

        check_true('the first arm runs up to its junction',
                   near(rows[0]['tend'], ARM1[2]), f"at {rows[0]['tend']}")
        check_true('the templated insert is placed at its junctions',
                   near(rows[1]['tstart'], INSERT[1]) and near(rows[1]['tend'], INSERT[2]),
                   f"at {(rows[1]['tstart'], rows[1]['tend'])}")
        check_true('the inverted arm runs back from its junction',
                   near(rows[2]['tend'], ARM2[2]), f"at {rows[2]['tend']}")
        check_true('the first arm starts near the contig start',
                   rows[0]['tstart'] < ARM1[1] + 1500, f"at {rows[0]['tstart']}")
        check_true('the inverted arm stops near the truth',
                   ARM2[1] - 500 < rows[2]['tstart'] < ARM2[1] + 1500,
                   f"at {rows[2]['tstart']}")
        # contiguous in derivative space: a gap here is a segment nothing placed
        check_true('the segments tile the contig without a hole',
                   all(abs(rows[i + 1]['qstart'] - rows[i]['qend']) <= 20
                       for i in range(len(rows) - 1)),
                   str([(r['qstart'], r['qend']) for r in rows]))

        contig = ''.join(l.strip() for l in open(f'{out}.derivative.fa')
                         if not l.startswith('>'))
        check_true('the contig is about the length of the truth',
                   abs(len(contig) - truth_length) < 1500,
                   f'{len(contig)} vs {truth_length}')
        # A HOLE, not a base. `strip('Nn')` already removed the unsupported
        # tails, and depth cannot dip below --min-depth in between -- but that is
        # a property of THIS fixture, not of sv_multihop: `touches_all` keeps
        # only the spanning reads, and build_inputs starts each within 800 bp of
        # the allele's start and ends it within 800 bp of its end, so every one
        # of them covers the whole middle. Depth rises across the left margin,
        # sits at 12, and falls across the right one. (A real run whose reads
        # stop mid-allele can have a genuine hole, which is what sv_multihop's
        # own "uncalled base(s) inside the contig" warning reports the longest
        # run for.)
        #
        # An interior N here is therefore `samtools consensus` declining to call
        # an AMBIGUOUS base at full depth, not an unsupported one -- swap the
        # caller to `-m simple` and one lands at offset 6990 of 25862 under all
        # 12 reads. With a 1% error rate whether a given position crosses that
        # threshold is a property of the caller's version: asserting zero passed
        # on samtools 1.23 and failed on the 1.22 CI installs, over two bases.
        #
        # What this check is for is a segment nothing placed, so it is stated as
        # a fraction instead. That is not redundant with the checks above: from
        # about a kilobase up the run also splits an arm into a fourth PAF row,
        # but a 300-base hole passes every one of them -- an N run preserves the
        # length, the segments still tile, and each still lands on its
        # coordinates -- and only the fraction fires.
        interior_n = contig.upper().count('N')
        check_true('no unsupported stretch survives inside the contig',
                   interior_n <= len(contig) // 1000,
                   f'{interior_n} N in {len(contig)} bp')

        # --- the tracks that go with it ------------------------------------
        bed = [l.split('\t') for l in
               open(f'{out}.derivative_segments.bed').read().splitlines()]
        check('one BED feature per segment', len(bed), 3)
        check('the BED names the source interval and the inversion',
              [f[3].endswith('inverted)') for f in bed], [False, False, True])

        # The foldback visits chrA twice, so the gene it cuts belongs to the
        # allele twice; one copy would draw the allele as if it were simple.
        gff = [l.split('\t') for l in
               open(f'{out}.derivative_genes.gff3').read().splitlines()
               if not l.startswith('#')]
        ids = [re.search(r'ID=([^;]*)', f[8]).group(1) for f in gff]
        check('the cut gene is projected once per copy',
              sorted(i for i in ids if i.startswith('g1')), ['g1.seg0', 'g1.seg2'])
        check('each copy keeps its own transcript',
              sorted(i for i in ids if i.startswith('t1')), ['t1.seg0', 't1.seg2'])
        check_true("an exon's Parent points inside its own copy",
                   all(re.search(r'Parent=([^;]*)', f[8]).group(1).endswith(
                       re.search(r'ID=[^.]*\.(seg\d+)', f[8]).group(1))
                       for f in gff if f[2] == 'exon'),
                   str([f[8] for f in gff if f[2] == 'exon']))
        check_true('the copy on the inverted arm is transcribed the other way',
                   {f[6] for f in gff if '.seg2' in f[8]} == {'-'},
                   str({f[6] for f in gff if '.seg2' in f[8]}))

        # --- the wiring -----------------------------------------------------
        cfg = json.load(open(config))
        check('the config names both assemblies',
              [a['name'] for a in cfg['assemblies']], ['testref', 'der1'])
        # the unit checks build this config from paths that do not exist; only a
        # real run can say the files it points at were actually written
        base = os.path.dirname(config)
        uris = [v['uri'] for a in cfg['assemblies']
                for v in a['sequence']['adapter'].values() if isinstance(v, dict)]
        uris += [v['uri'] for t in cfg['tracks'] for v in t['adapter'].values()
                 if isinstance(v, dict) and 'uri' in v]
        uris += [t['adapter']['index']['location']['uri'] for t in cfg['tracks']
                 if 'index' in t['adapter']]
        absent = [u for u in uris if not os.path.exists(os.path.join(base, u))]
        check('every file the config points at exists', absent, [])

        spec_url = [l for l in derive.stdout.splitlines() if 'session=spec-' in l]
        check('derive prints the session that opens it', len(spec_url), 1)
        if spec_url:
            spec = json.loads(urllib.parse.unquote(
                spec_url[0].split('session=spec-')[1]))
            panels = spec['views'][0]['views']
            # one locstring per stretch, or the insert's ribbon points at nothing
            check('the reference panel covers both chromosomes',
                  sorted({loc.split(':')[0] for loc in panels[0]['loc'].split()}),
                  ['chrA', 'chrB'])
            check('the derivative panel spans the whole contig',
                  panels[1]['loc'], f'der1:1-{len(contig)}')

        # --- the evidence ---------------------------------------------------
        # End-to-end coverage with no clipping is what makes the reconstruction
        # believable; a wrong contig shows up as reads clipped at its junctions.
        #
        # Only clipping AWAY from the contig's own ends says that. The contig is
        # trimmed to where --min-depth stops supporting it, so the reads that
        # start earliest and end latest necessarily hang over those ends and clip
        # by however far they overhang -- counting that counts the trim, not a
        # junction. It stays under 200 bp on this seed and reaches 264 bp on
        # another, with the reconstruction correct in both.
        clipped = 0
        spanning = 0
        for line in sh(
                ['samtools', 'view', '-F', '0x900', f'{out}.reads_vs_derivative.bam'],
                capture_output=True, text=True).stdout.splitlines():
            f = line.split('\t')
            if not f[0].startswith('span'):
                continue
            spanning += 1
            head, tail = re.match(r'^(\d+)[SH]', f[5]), re.search(r'(\d+)[SH]$', f[5])
            start = int(f[3])
            end = start + sum(int(n) for n, op in re.findall(r'(\d+)([MIDNSHP=X])', f[5])
                              if op in 'MDN=X') - 1
            if (start > 20 and head and int(head.group(1)) > 200) or (
                    end < len(contig) - 20 and tail and int(tail.group(1)) > 200):
                clipped += 1
        check('every spanning read realigns to the reconstruction', spanning, 12)
        check('none of them clips at a junction', clipped, 0)

        report(derive)


def report(derive):
    if failures:
        print(derive.stdout)
        # Which samtools and which minimap2, because that is the first question
        # a failure here raises and the answer differs between a workstation and
        # the CI image: consensus calling and breakpoint placement both move
        # between releases, and a check that passes locally and fails on CI is
        # usually saying that rather than saying the pipeline broke.
        for tool in ('samtools', 'minimap2'):
            v = subprocess.run([tool, '--version'], capture_output=True, text=True)
            print(f'    {v.stdout.splitlines()[0] if v.stdout else tool + " ?"}')
        for f in failures:
            print(f'FAIL {f}')
        sys.exit(f'{len(failures)} pipeline check(s) failed')
    print('ok: sv_multihop derive rebuilds the synthetic foldback')


if __name__ == '__main__':
    main()
