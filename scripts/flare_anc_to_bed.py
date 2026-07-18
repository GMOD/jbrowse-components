#!/usr/bin/env python3
"""Collapse FLARE per-marker local-ancestry calls (AN1/AN2) into per-haplotype
BED9 runs, one row per (individual, haplotype), for the trio ancestry track in
analyze_trio.md.

Usage: flare_anc_to_bed.py <flare.anc.vcf.gz> <child> <father> <mother> <out.bed>

Output columns (matching the config_demo BedTabixAdapter columnNames):
  chrom start end name score strand thickStart thickEnd itemRgb sample ancestry
where `sample` is the row label ("Child hap1", ...) partitioned on by the
display, and `itemRgb` colors each block directly (the BED itemRgb column).
"""
import gzip
import sys
from collections import Counter

anc_vcf, child, father, mother, out_bed = sys.argv[1:6]

role_of = {child: 'Child', mother: 'Mother', father: 'Father'}
# Okabe-Ito colorblind-safe palette; only AFR/EUR are expected for an ASW trio.
color_of = {'AFR': '230,159,0', 'EUR': '0,114,178',
            'EAS': '0,158,115', 'SAS': '204,121,167'}

code2anc = {}
sample_col = {}
runs = {}   # (role, hap) -> [ancestry, start0, end]
out = []


def flush(key, chrom):
    r = runs.get(key)
    if r is None:
        return
    anc, s0, e0 = r
    role, hap = key
    out.append([chrom, str(s0), str(e0), anc, '0', '.', str(s0), str(e0),
                color_of.get(anc, '128,128,128'), f'{role} {hap}', anc])


chrom = None
with gzip.open(anc_vcf, 'rt') as fh:
    for line in fh:
        if line.startswith('##ANCESTRY='):
            body = line.strip().split('=', 1)[1].strip('<> \n')
            for pair in body.split(','):
                nm, cd = pair.split('=')
                code2anc[int(cd)] = nm
            continue
        if line.startswith('##'):
            continue
        if line.startswith('#CHROM'):
            cols = line.rstrip('\n').split('\t')
            sample_col = {s: 9 + i for i, s in enumerate(cols[9:])}
            continue
        f = line.rstrip('\n').split('\t')
        chrom = f[0]
        pos = int(f[1])
        fmt = f[8].split(':')
        i1, i2 = fmt.index('AN1'), fmt.index('AN2')
        for smp, role in role_of.items():
            call = f[sample_col[smp]].split(':')
            for hap, gi in (('hap1', i1), ('hap2', i2)):
                anc = code2anc[int(call[gi])]
                key = (role, hap)
                r = runs.get(key)
                if r is not None and r[0] == anc:
                    r[2] = pos
                else:
                    flush(key, chrom)
                    runs[key] = [anc, pos - 1, pos]

for key in list(runs):
    flush(key, chrom)

out.sort(key=lambda r: (r[9], int(r[1])))
with open(out_bed, 'w') as fh:
    for r in out:
        fh.write('\t'.join(r) + '\n')

print('runs per row:', dict(Counter(r[9] for r in out)))
print('bp per ancestry:',
      dict(Counter(r[3] for r in out for _ in [0])))
tot = {}
for r in out:
    tot[r[3]] = tot.get(r[3], 0) + (int(r[2]) - int(r[1]))
mb = {k: round(v / 1e6, 1) for k, v in tot.items()}
print('Mb per ancestry (summed over all 6 haplotypes):', mb)
print('total runs:', len(out))
