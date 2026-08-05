"""Genome-wide wolf fraction per animal, from the per-chromosome FLARE runs.

Weighted by the sequence each chromosome actually contributes, not averaged
over chromosomes: FLARE's `global.anc` fraction is per chromosome, and chr1 is
five times chr38, so a plain mean would let the small chromosomes shout. The
weight is the painted span in that chromosome's own BED rather than the
chrom.sizes length, because the painting starts at the first marker and ends at
the last, and that is the sequence the fraction was actually computed over.

Reports the two FLARE runs separately: the 243-animal sweep and the 33-animal
Anglo-French hound clade.

Usage: python3 scripts/dog10k_ancestry_genomewide.py <keepdir> [--sweep]
       where <keepdir> is the `keep` directory
       build_dog10k_ancestry_genomewide.sh wrote.
"""

import collections
import glob
import gzip
import os
import re
import sys


def painted_span(bed_gz):
    """Sequence the painting covers, from one haplotype row of the BED."""
    lo, hi = None, None
    with gzip.open(bed_gz, 'rt') as fh:
        first = None
        for line in fh:
            if line.startswith('#'):
                continue
            f = line.rstrip('\n').split('\t')
            if first is None:
                first = f[9]
            if f[9] != first:
                continue
            s, e = int(f[1]), int(f[2])
            lo = s if lo is None else min(lo, s)
            hi = e if hi is None else max(hi, e)
    return (hi - lo) if lo is not None else 0


def collect(keep, kind, labels_suffix):
    """kind: 'wolfdog' or 'anglofrench'."""
    num = collections.defaultdict(float)   # sample -> wolf bp
    den = collections.defaultdict(float)   # sample -> painted bp
    chroms = []
    labels = {}
    for anc in sorted(glob.glob(f'{keep}/chr*.{kind}_chr*.global.anc.gz')):
        chrom = re.match(r'chr\d+', os.path.basename(anc)).group(0)
        bed = (f'{keep}/{chrom}.dog10k_wolfdog_ancestry.{chrom}.bed.gz'
               if kind == 'wolfdog'
               else f'{keep}/{chrom}.dog10k_anglofrench.{chrom}.bed.gz')
        if not os.path.exists(bed):
            continue
        span = painted_span(bed)
        if not span:
            continue
        chroms.append(chrom)
        lab = f'{keep}/{chrom}.{labels_suffix}'
        if os.path.exists(lab):
            for line in open(lab):
                s, l = line.rstrip('\n').split('\t')
                labels[s] = l
        with gzip.open(anc, 'rt') as fh:
            next(fh)
            for line in fh:
                f = line.rstrip('\n').split('\t')
                num[f[0]] += float(f[1]) * span
                den[f[0]] += span
    return num, den, chroms, labels


def report(keep, kind, labels_suffix, title):
    num, den, chroms, labels = collect(keep, kind, labels_suffix)
    if not den:
        print(f'\n{title}: no data')
        return
    total_mb = sum(den.values()) / len(den) / 1e6
    print(f'\n{title}')
    print(f'  {len(chroms)} autosomes, {total_mb:.0f} Mb painted per animal')
    for s in sorted(den, key=lambda s: -num[s] / den[s]):
        frac = num[s] / den[s]
        print('    %-30s %6.3f  %s'
              % (labels.get(s, s), frac, '#' * int(frac * 50)))


keep = sys.argv[1] if len(sys.argv) > 1 else 'keep'
report(keep, 'anglofrench', 'anglofrench.tsv',
       'Anglo-French hound clade, genome-wide')
if '--sweep' in sys.argv:
    report(keep, 'wolfdog', 'named.tsv',
           'The 243-animal sweep, genome-wide (named subset labelled)')
