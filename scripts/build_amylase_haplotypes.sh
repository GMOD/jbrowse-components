#!/usr/bin/env bash
#
# Five assembled haplotypes across the human amylase locus, one of each common
# structure from a single AMY1 copy to seven, each aligned to the row under it,
# for a linear synteny view whose every band is a real pairwise alignment with a
# CIGAR.
#
# A stack aligned to GRCh38 alone cannot place what two haplotypes share and
# GRCh38 lacks, so each row is aligned to its neighbour instead. Which haplotype
# has which structure comes from HPRC's own graph database: every haplotype's
# coordinate at a unique window either side of the locus gives its span across
# it, and the spans fall into the classes of Yilmaz et al. 2024. The locus is
# then fetched from each chosen assembly by range request, minimap2 aligns each
# adjacent pair, and the coordinates are lifted back onto the whole contigs so
# the rows draw on the assemblies' own coordinates under their gene models.
#
# Requires: curl, awk, python3, samtools (built with libcurl, for the range
#           requests), minimap2, and Node.js for `npx`
# Usage:    bash build_amylase_haplotypes.sh [outdir]
#
# Your own haplotypes: replace MANIFEST. A row is the JBrowse assembly name, the
# PanSN name of the contig, a bgzipped and faidx-indexed FASTA (a URL or a
# path) and the region to fetch from it, in the FASTA's own naming. The row
# order is the stack order. The config step names the assemblies and one-model-
# per-gene CAT annotations jbrowse.org/pangenome/hprc-grch38 hosts for every
# release 2 haplotype; for other genomes add each FASTA as an assembly and keep
# the track.

set -euo pipefail

OUT="${1:-amylase_haplotypes}"
mkdir -p "$OUT"
cd "$OUT"

HPRC=https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC
HOSTED=https://jbrowse.org/pangenome/hprc-grch38
GBZ_DB=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
GBZ_INDEX=https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

echo "== every haplotype's span across the locus, from the graph database"
# One window inside RNPC3 and one past AMY1C, both single-copy, so each
# haplotype crosses each exactly once. --context 0 reads the window alone, and
# --alignments prints one record per haplotype with its own coordinates.
for side in left:103540000..103541000 right:103800000..103801000; do
  [ -s "${side%%:*}.json" ] || npx --yes -p @gmod/gbz-base gbz-base-query "$GBZ_DB" \
    --haplotype-index "$GBZ_INDEX" --sample GRCh38 --contig chr1 \
    --interval "${side#*:}" --context 0 --alignments >"${side%%:*}.json"
done
python3 - <<'PY'
import json
import re

# GRCh38's own distance between the two windows
REFERENCE = 103800000 - 103540000


def positions(path):
    found = {}
    for record in json.load(open(path)):
        if record.get('resolved'):
            sample, haplotype, contig = re.sub(r'\[.*', '', record['name']).split('#')
            found[f'{sample}#{haplotype}'] = (contig, record['hapStart'], record['strand'])
    return found


left, right = positions('left.json'), positions('right.json')
with open('locus_spans.tsv', 'w') as fh:
    fh.write('haplotype\tcontig\tstrand\tleft\tright\tspan\tspan_minus_GRCh38\n')
    for name in sorted(left):
        if name in right and left[name][0] == right[name][0]:
            contig, a, strand = left[name]
            span = abs(right[name][1] - a)
            fh.write(f'{name}\t{contig}\t{strand}\t{a}\t{right[name][1]}\t{span}\t{span - REFERENCE}\n')
PY
echo "   $(($(wc -l <locus_spans.tsv) - 1)) haplotypes with both windows on one contig"

# One haplotype of each span class, each on a chromosome-scale contig in the
# reference's orientation. Each region runs from 19,106 bp left of the left
# window to 33,637 bp past the right one, the same frame as the hg38 row.
MANIFEST=$(
  cat <<EOF
HG01361.1	HG01361#1#CM089019.1	$HPRC/HG01361/assemblies/release2/HG01361_pat_hprc_r2_v1.0.1.fa.gz	HG01361#1#CM089019.1:103831655-104050048
hg38	GRCh38#0#chr1	https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz	1:103520894-103832637
HG00133.1	HG00133#1#CM090045.1	$HPRC/HG00133/assemblies/release2/HG00133_hap1_hprc_r2_v1.0.1.fa.gz	HG00133#1#CM090045.1:103669666-103981330
NA18608.2	NA18608#2#CM089849.1	$HPRC/NA18608/assemblies/release2/NA18608_hap2_hprc_r2_v1.0.1.fa.gz	NA18608#2#CM089849.1:103796766-104203421
HG00232.1	HG00232#1#CM089991.1	$HPRC/HG00232/assemblies/release2/HG00232_hap1_hprc_r2_v1.0.1.fa.gz	HG00232#1#CM089991.1:103491008-103991760
EOF
)

echo "== the locus from each assembly, by range request"
: >contig_lengths.tsv
while IFS=$'\t' read -r name pansn fasta region; do
  contig="${region%:*}"
  if [ ! -s "$name.fa" ]; then
    # the header keeps the region, which the lift below reads the offset from
    samtools faidx "$fasta" "$region" |
      awk -v h=">$pansn:${region##*:}" 'NR==1{print h; next} {print}' >"$name.fa"
  fi
  # a contig's full length, so the PAF names the whole contig and not the piece
  case "$fasta" in
  http*) curl -fsSL "$fasta.fai" ;;
  *) cat "$fasta.fai" ;;
  esac | awk -F'\t' -v c="$contig" -v p="$pansn" '$1==c{print p "\t" $2}' >>contig_lengths.tsv
done <<<"$MANIFEST"

echo "== each row against the row under it"
: >adjacent.regions.paf
prev=""
while IFS=$'\t' read -r name _; do
  if [ -n "$prev" ]; then
    # -c writes the CIGAR the view draws indels from, --eqx splits its matches
    #   from its mismatches
    # asm20 tolerates the divergence between paralogous amylase copies, so a
    #   chain can run through the array instead of stopping at it
    minimap2 -c --eqx -x asm20 "$name.fa" "$prev.fa" 2>/dev/null |
      # the primary chain of each pair; the secondary ones are paralogous
      # copies aligning to each other
      awk -F'\t' '$11>=5000 && /tp:A:P/' >>adjacent.regions.paf
  fi
  prev="$name"
done <<<"$MANIFEST"

echo "== lifted onto whole-contig coordinates"
awk -F'\t' -v OFS='\t' '
  NR==FNR { len[$1]=$2; next }
  {
    split($1, q, ":"); split(q[2], qr, "-")
    split($6, t, ":"); split(t[2], tr, "-")
    $1=q[1]; $2=len[q[1]]; $3+=qr[1]-1; $4+=qr[1]-1
    $6=t[1]; $7=len[t[1]]; $8+=tr[1]-1; $9+=tr[1]-1
    print
  }' contig_lengths.tsv adjacent.regions.paf >amylase_adjacent.paf

echo "== amylase gene copies in each row, counted from sequence"
# The three genes as GRCh38 holds them (RefSeq AMY2B, AMY2A and AMY1A), written
# in the coordinates of the fetched hg38 piece, which starts at chr1:103520894.
# A lifted annotation places one model per source gene, so a haplotype's extra
# copies go uncounted there; aligning the gene back finds each of them.
: >genes.fa
while read -r gene start end; do
  samtools faidx hg38.fa "GRCh38#0#chr1:103520894-103832637:$start-$end" |
    awk -v g="$gene" 'NR==1{print ">" g; next} {print}' >>genes.fa
done <<EOF
AMY2B 33751 58641
AMY2A 95758 104887
AMY1 134626 143661
EOF
{
  printf 'row\tAMY1\tAMY2A\tAMY2B\n'
  while IFS=$'\t' read -r name _; do
    # -N keeps that many secondary hits, which is what the extra copies are;
    # -p 0.5 lets a copy scoring half of the best one through
    minimap2 -c --eqx -x asm20 -N 50 -p 0.5 "$name.fa" genes.fa 2>/dev/null |
      # a copy is a hit over 90% of the gene at 97% identity or better
      awk -F'\t' -v n="$name" '
        ($4-$3)/$2>=0.9 && $10/$11>=0.97 { c[$1]++ }
        END { printf "%s\t%d\t%d\t%d\n", n, c["AMY1"], c["AMY2A"], c["AMY2B"] }'
  done <<<"$MANIFEST"
} >gene_copies.tsv
cat gene_copies.tsv

echo "== config.json"
MANIFEST="$MANIFEST" HOSTED="$HOSTED" python3 - <<'PY'
import json
import os

hosted = os.environ['HOSTED']
rows = [line.split('\t') for line in os.environ['MANIFEST'].splitlines()]
names = [row[0] for row in rows]
pansn = {row[0]: '#'.join(row[1].split('#')[:2]) for row in rows}


def haplotype(name):
    return {
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {
                'type': 'ChromSizesAdapter',
                'uri': f'{hosted}/{name}.chrom.sizes',
            },
        },
    }


def genes(name):
    return {
        'type': 'FeatureTrack',
        'trackId': f"hprc_genes_{name.replace('.', '_')}",
        'name': f'{name} genes (HPRC release 2 CAT annotation)',
        'assemblyNames': [name],
        'adapter': {
            'type': 'BedTabixAdapter',
            'uri': f'{hosted}/genes/{name}.genes.bed.gz',
        },
    }


config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [
        {
            'name': 'hg38',
            'aliases': ['GRCh38'],
            'uri': 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
            'refNameAliases': {
                'uri': 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt'
            },
        },
        *[haplotype(name) for name in names if name != 'hg38'],
    ],
    'tracks': [
        {
            'type': 'FeatureTrack',
            'trackId': 'hg38_ncbiRefSeq_ucsc',
            'name': 'NCBI RefSeq genes (hg38)',
            'assemblyNames': ['hg38'],
            'adapter': {
                'type': 'Gff3TabixAdapter',
                'uri': 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
                'csi': True,
            },
        },
        *[genes(name) for name in names if name != 'hg38'],
        {
            'type': 'SyntenyTrack',
            'trackId': 'amylase_adjacent',
            'name': 'Amylase locus, each haplotype against the next (minimap2)',
            'assemblyNames': names,
            'adapter': {
                'type': 'MultiGenomePAFAdapter',
                'uri': 'amylase_adjacent.paf',
                'assemblyNames': names,
                'assemblyNameToPanSN': pansn,
            },
        },
    ],
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
PY

echo "Wrote $(pwd)/amylase_adjacent.paf, locus_spans.tsv, gene_copies.tsv and config.json"
