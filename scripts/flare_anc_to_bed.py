#!/usr/bin/env python3
"""Collapse FLARE per-marker local-ancestry calls (AN1/AN2) into per-haplotype
BED9 runs, one row per (sample, haplotype), for the painted ancestry track in
local_ancestry.md.

Usage: flare_anc_to_bed.py <flare.anc.vcf.gz> <labels.tsv> <out.bed>

labels.tsv is two columns, "<sampleName><TAB><row label>". Every sample listed
gets two rows, "<label> hap1" and "<label> hap2"; samples not listed are
skipped, and the file's order sets the track's row order.

Output columns, named by the `#`-header line the BedTabixAdapter reads, so the
track config does not have to repeat them as `columnNames`:
  chrom start end name score strand thickStart thickEnd itemRgb sample ancestry
where `sample` is the row label the display partitions on and `itemRgb` colors
each block directly (the BED itemRgb column).
"""
import gzip
import sys
from collections import Counter

anc_vcf, labels_tsv, out_bed = sys.argv[1:4]

label_of = {}
with open(labels_tsv) as fh:
    for line in fh:
        line = line.rstrip('\n')
        if line and not line.startswith('#'):
            smp, label = line.split('\t')[:2]
            label_of[smp] = label

# Okabe-Ito colorblind-safe palette, assigned by ancestry name (not by FLARE's
# internal code, which is not stable between runs, so keying on it would swap
# the colors under you on a rebuild).
PALETTE = ['0,114,178', '230,159,0', '0,158,115', '204,121,167',
           '213,94,0', '86,180,233']

code2anc = {}
color_of = {}
sample_col = {}
runs = {}   # (label, hap) -> [ancestry, start0, end]
out = []


def flush(key, chrom):
    r = runs.get(key)
    if r is None:
        return
    anc, s0, e0 = r
    label, hap = key
    out.append([chrom, str(s0), str(e0), anc, '0', '.', str(s0), str(e0),
                color_of.get(anc, '128,128,128'), f'{label} {hap}', anc])


chrom = None
with gzip.open(anc_vcf, 'rt') as fh:
    for line in fh:
        if line.startswith('##ANCESTRY='):
            body = line.strip().split('=', 1)[1].strip('<> \n')
            for pair in body.split(','):
                nm, cd = pair.split('=')
                code2anc[int(cd)] = nm
            for i, nm in enumerate(sorted(code2anc.values())):
                color_of[nm] = PALETTE[i % len(PALETTE)]
            continue
        if line.startswith('##'):
            continue
        if line.startswith('#CHROM'):
            cols = line.rstrip('\n').split('\t')
            sample_col = {s: 9 + i for i, s in enumerate(cols[9:])}
            missing = [s for s in label_of if s not in sample_col]
            if missing:
                sys.exit(f'samples not in {anc_vcf}: {", ".join(missing)}')
            continue
        f = line.rstrip('\n').split('\t')
        chrom = f[0]
        pos = int(f[1])
        fmt = f[8].split(':')
        i1, i2 = fmt.index('AN1'), fmt.index('AN2')
        for smp, label in label_of.items():
            call = f[sample_col[smp]].split(':')
            for hap, gi in (('hap1', i1), ('hap2', i2)):
                anc = code2anc[int(call[gi])]
                key = (label, hap)
                r = runs.get(key)
                if r is not None and r[0] == anc:
                    r[2] = pos
                else:
                    flush(key, chrom)
                    runs[key] = [anc, pos - 1, pos]

for key in list(runs):
    flush(key, chrom)

out.sort(key=lambda r: (r[9], int(r[1])))
header = ('#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\t'
          'thickStart\tthickEnd\titemRgb\tsample\tancestry\n')
with open(out_bed, 'w') as fh:
    fh.write(header)
    for r in out:
        fh.write('\t'.join(r) + '\n')

tot = {}
for r in out:
    tot[r[3]] = tot.get(r[3], 0) + (int(r[2]) - int(r[1]))
print('runs per row:', dict(Counter(r[9] for r in out)))
print('Mb per ancestry (summed over all haplotype rows):',
      {k: round(v / 1e6, 1) for k, v in tot.items()})
print('total runs:', len(out))
