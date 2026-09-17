#!/usr/bin/env bash
#
# TRGT's genotypes for 100 HPRC samples at the ABCA7 intronic VNTR, written as
# a VCF in TRGT's own format for the pangenome_graph_walk_rows tutorial. The
# calls come from PacBio's published TRGTdb (Zenodo 8329210); nothing here
# re-genotypes anything.
#
# Requires: curl, tar, duckdb, python3, bgzip, tabix
# Usage:    bash scripts/build_hprc_abca7_trgt.sh [outdir]
#
# Writes hprc_abca7_trgt.vcf.gz{,.tbi}
set -euo pipefail

OUTDIR="${1:-hprc_abca7_trgt_build}"
CHROM=chr19
START=1049407
END=1050096
mkdir -p "$OUTDIR"
cd "$OUTDIR"

if [ ! -d hprc_100.tdb ]; then
  curl -sL -o adotto_hprc.tdb.tar \
    https://zenodo.org/records/8329210/files/adotto_hprc.tdb.tar
  tar xf adotto_hprc.tdb.tar
  rm adotto_hprc.tdb.tar
fi

curl -s "https://api.genome.ucsc.edu/getData/sequence?genome=hg38;chrom=$CHROM;start=$((START - 1));end=$END" \
  >ref.json

curl -sL https://zenodo.org/records/8329210/files/adotto_repeats.hg38.bed.gz |
  gzip -dc | awk -v c=$CHROM -v s=$START '$1 == c && $2 == s { print $4 }' \
  >catalogue.txt

duckdb -json -c "
  select allele_number, sequence from read_parquet('hprc_100.tdb/allele.pq')
  where LocusID = (select LocusID from read_parquet('hprc_100.tdb/locus.pq')
    where chrom = '$CHROM' and start = $START and \"end\" = $END)
  order by allele_number" >alleles.json

duckdb -json -c "
  select regexp_extract(filename, 'sample\.(.*)\.pq', 1) as sample,
    allele_number, spanning_reads
  from read_parquet('hprc_100.tdb/sample.*.pq', filename = true)
  where LocusID = (select LocusID from read_parquet('hprc_100.tdb/locus.pq')
    where chrom = '$CHROM' and start = $START and \"end\" = $END)
  order by sample" >calls.json

CHROM=$CHROM START=$START END=$END python3 - <<'PY' >hprc_abca7_trgt.vcf
import json, os
chrom, start, end = os.environ['CHROM'], int(os.environ['START']), int(os.environ['END'])
ref = json.load(open('ref.json'))['dna'].upper()
anchor, refseq = ref[0], ref[1:]
seqs = {int(a['allele_number']): a['sequence'] for a in json.load(open('alleles.json'))}
assert seqs[0] == refseq, 'allele 0 is not GRCh38'
calls = {}
for c in json.load(open('calls.json')):
    calls.setdefault(c['sample'], []).append({**c, 'allele_number': int(c['allele_number'])})
used = sorted({c['allele_number'] for cs in calls.values() for c in cs} - {0})
index = {0: 0, **{a: i + 1 for i, a in enumerate(used)}}
catalogue = open('catalogue.txt').read().strip()
print('##fileformat=VCFv4.2')
print(f'##contig=<ID={chrom},length=58617616>')
print('##INFO=<ID=TRID,Number=1,Type=String,Description="Tandem repeat ID">')
print('##INFO=<ID=END,Number=1,Type=Integer,Description="End position of the repeat">')
print('##INFO=<ID=MOTIFS,Number=1,Type=String,Description="Motifs the repeat is composed of">')
print('##INFO=<ID=STRUC,Number=1,Type=String,Description="Structure of the region">')
print('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">')
print('##FORMAT=<ID=AL,Number=.,Type=Integer,Description="Length of each allele">')
print('##FORMAT=<ID=SD,Number=.,Type=Integer,Description="Number of spanning reads supporting each allele">')
samples = sorted(calls)
print('\t'.join(['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO', 'FORMAT', *samples]))
cols = []
for s in samples:
    cs = sorted(calls[s], key=lambda c: len(seqs[c['allele_number']]))
    gt = '/'.join(str(index[c['allele_number']]) for c in cs)
    al = ','.join(str(len(seqs[c['allele_number']])) for c in cs)
    sd = ','.join(str(c['spanning_reads']) for c in cs)
    cols.append(f'{gt}:{al}:{sd}')
alt = ','.join(anchor + seqs[a] for a in used)
fields = dict(kv.split('=', 1) for kv in catalogue.split(';'))
info = f"TRID={fields['ID']};END={end};MOTIFS={fields['MOTIFS']};STRUC={fields['STRUC']}"
print('\t'.join([chrom, str(start), '.', anchor + refseq, alt, '.', '.', info, 'GT:AL:SD', *cols]))
PY

bgzip -f hprc_abca7_trgt.vcf
tabix -f -p vcf hprc_abca7_trgt.vcf.gz
