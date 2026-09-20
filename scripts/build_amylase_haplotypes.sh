#!/usr/bin/env bash
#
# Five assembled haplotypes across the human amylase locus, each aligned to the
# row under it, for a linear synteny view whose every band is a real pairwise
# alignment with a CIGAR.
#
# The rows are HPRC release 2 haplotypes and GRCh38, ordered by how many AMY1
# copies each carries. A stack aligned to GRCh38 alone cannot place what two
# haplotypes share and GRCh38 lacks, so each row is aligned to its neighbour
# instead: the locus is fetched from each assembly by range request, minimap2
# aligns each adjacent pair, and the coordinates are lifted back onto the whole
# contigs so the rows draw on the assemblies' own coordinates, under the gene
# tracks demos/hprc_multiway already hosts for them.
#
# Requires: curl, awk, samtools (built with libcurl, for the range requests),
#           minimap2, python3
# Usage:    bash build_amylase_haplotypes.sh [outdir]
#
# Your own haplotypes: replace MANIFEST. A row is the JBrowse assembly name, the
# PanSN name of the contig, a bgzipped and faidx-indexed FASTA (a URL or a
# path) and the region to fetch from it, in the FASTA's own naming. The row
# order is the stack order. The config step assumes the hosted HPRC assemblies;
# for other genomes add each FASTA as an assembly and keep the track.

set -euo pipefail

OUT="${1:-amylase_haplotypes}"
mkdir -p "$OUT"
cd "$OUT"

HPRC=https://s3-us-west-2.amazonaws.com/human-pangenomics/working
HOSTED=https://jbrowse.org/demos/hprc_multiway

# Where the amylase locus sits on each haplotype comes from the alignment
# demos/hprc_multiway hosts: `tabix hprc_multiway_gfa.pif.gz
# 'tGRCh38#0#chr1:103500000-103900000'` names each haplotype's contig and the
# two long records that flank the locus, and each region here is the stretch
# between them with 100 kb either side.
MANIFEST=$(
  cat <<EOF
HG00097.1	HG00097#1#CM094060.1	$HPRC/HPRC/HG00097/assemblies/release2/HG00097_hap1_hprc_r2_v1.0.1.fa.gz	HG00097#1#CM094060.1:104017700-104266751
HG00099.1	HG00099#1#JBHDWO010000005.1	$HPRC/HPRC/HG00099/assemblies/release2/HG00099_hap1_hprc_r2_v1.0.1.fa.gz	HG00099#1#JBHDWO010000005.1:103881093-104112612
hg38	GRCh38#0#chr1	https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz	1:103520894-103832637
HG00133.1	HG00133#1#CM090045.1	$HPRC/HPRC/HG00133/assemblies/release2/HG00133_hap1_hprc_r2_v1.0.1.fa.gz	HG00133#1#CM090045.1:103669666-103981330
HG00128.1	HG00128#1#JBHIKS010000010.1	$HPRC/HPRC/HG00128/assemblies/release2/HG00128_hap1_hprc_r2_v1.0.1.fa.gz	HG00128#1#JBHIKS010000010.1:103876230-104422280
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
                'uri': f'{hosted}/{name}.gfa.chrom.sizes',
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
            'type': 'Gff3TabixAdapter',
            'uri': f'{hosted}/{name}.genes.gff3.gz',
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

echo "Wrote $(pwd)/amylase_adjacent.paf and config.json"
