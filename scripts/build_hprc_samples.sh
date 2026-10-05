#!/usr/bin/env bash
#
# Build demos/hprc's hprc_samples.tsv, the sample table the KIV-2 copies tracks
# read through samplesTsvLocation, and print what the faceted KIV-2 figure in
# website/docs/tutorials/pangenome_hprc_repeats.md shows, so the page need not
# assert it.
#
# Columns: name, population, superpopulation, sex. Population and sex come from
# HPRC's release 2 sample table; superpopulation is the 1000 Genomes code for
# that population. A population the 1000 Genomes table lacks (ASL, MKK) keeps a
# blank superpopulation rather than a guessed one. Every sample of the KIV-2
# record gets a row, GRCh38 and CHM13 with blanks, because a samples table that
# omits a sample drops it from a multi-sample display.
#
# Usage: scripts/build_hprc_samples.sh [outdir]   (default: a temp dir)
# Then:  scripts/deploy-demo.sh <outdir>/hprc_samples.tsv hprc/hprc_samples.tsv
set -euo pipefail

out=${1:-$(mktemp -d)}
mkdir -p "$out"
cd "$out"

curl -fsSL -o hprc_release2_sample_metadata.csv \
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/sample/hprc_release2_sample_metadata.csv
curl -fsSL -o 20131219.populations.tsv \
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/20131219.populations.tsv
curl -fsSL -o hprc_kiv2_copies_all.vcf.gz \
  https://jbrowse.org/demos/hprc/hprc_kiv2_copies_all.vcf.gz

python3 - <<'PY'
import csv, gzip
from collections import Counter, defaultdict

superpop = {
    r['Population Code']: r['Super Population']
    for r in csv.DictReader(open('20131219.populations.tsv'), delimiter='\t')
    if r.get('Population Code')
}
meta = {r['sample_id']: r for r in csv.DictReader(open('hprc_release2_sample_metadata.csv'))}
lines = [l for l in gzip.open('hprc_kiv2_copies_all.vcf.gz', 'rt') if not l.startswith('##')]
header = lines[0].rstrip('\n').split('\t')
record = lines[1].rstrip('\n').split('\t')
samples = header[9:]

def row(name):
    m = meta.get(name, {})
    pop = m.get('population_abbreviation', '')
    pop = '' if pop in ('', 'N/A') else pop
    sex = m.get('sex', '')
    return [name, pop, superpop.get(pop, ''), '' if sex in ('', 'N/A') else sex]

with open('hprc_samples.tsv', 'w') as f:
    f.write('name\tpopulation\tsuperpopulation\tsex\n')
    for name in samples:
        f.write('\t'.join(row(name)) + '\n')
print(f'wrote hprc_samples.tsv: {len(samples)} samples')
missing = sorted({r[1] for r in map(row, samples) if r[1] and not r[2]})
print('populations with no 1000 Genomes superpopulation, left blank:', ', '.join(missing) or 'none')

info = dict(kv.split('=', 1) for kv in record[7].split(';'))
rn = list(map(int, info['RN'].split(',')))
names = info['RUNAME'].split(',')
ruc = list(map(float, info['RUC'].split(',')))
k = 0
b_copies = []
for n in rn:
    b_copies.append(sum(ruc[k + j] for j in range(n) if names[k + j] == 'KIV-2B'))
    k += n
tally = defaultdict(Counter)
for name, call in zip(samples, record[9:]):
    sp = row(name)[2] or 'none'
    for a in call.split(':')[0].replace('/', '|').split('|'):
        if a in ('.', '0'):
            continue
        b = b_copies[int(a) - 1]
        tally[sp]['haplotypes'] += 1
        tally[sp]['any KIV-2B'] += b >= 1
        tally[sp]['2+ KIV-2B'] += b >= 2
print('\nKIV-2B by superpopulation, haplotypes of the KIV-2 record:')
print(f"{'':6}{'haplotypes':>11}{'any KIV-2B':>12}{'2+ KIV-2B':>11}")
for sp in sorted(tally, key=lambda s: (s == 'none', s)):
    t = tally[sp]
    n = t['haplotypes']
    print(f"{sp:6}{n:11}{100 * t['any KIV-2B'] / n:11.0f}%{100 * t['2+ KIV-2B'] / n:10.0f}%")
PY
