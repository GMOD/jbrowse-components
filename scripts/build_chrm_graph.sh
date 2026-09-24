#!/usr/bin/env bash
#
# The mitochondrial chromosome of HPRC release 2's pggb graph: 234 haplotypes at
# base level, read as a graph and as a haplotype matrix of every site.
#
# One window of the graph is cut out for the graph view, the 9 bp COII/tRNA-Lys
# deletion that marks mitochondrial haplogroup B. `vg deconstruct` writes the
# graph's bubbles as a VCF with one column per haplotype, Haplogrep names each
# haplotype's lineage from those calls, and the 1000 Genomes pedigree names its
# population, so the matrix can be colored by either.
#
# Requires: curl, zstd, odgi, vg, bgzip, tabix, python3, and Haplogrep 3
#           (`haplogrep3` on the PATH, or HAPLOGREP=/path/to/haplogrep3; it
#           needs Java)
# Usage:    bash build_chrm_graph.sh [outdir]
#
# Your own graph: any pggb or Minigraph-Cactus GFA. Set GFA to its URL,
# REFERENCE to the sample `vg deconstruct` should call against and WINDOW to
# the stretch of that sample's path to cut out.

set -euo pipefail

OUT="${1:-chrm_graph}"
mkdir -p "$OUT"
cd "$OUT"

GFA="${GFA:-https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/pggb/gfas/by-chromosome/20251014_hprc25272.p98-k311.chrM.gfa.zst}"
REFERENCE="${REFERENCE:-GRCh38}"
WINDOW="${WINDOW:-GRCh38#0#chrM:8200-8400}"
HAPLOGREP="${HAPLOGREP:-haplogrep3}"
PEDIGREE=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt

echo "== the graph"
[ -s chrM.gfa ] || curl -fsSL "$GFA" | zstd -dc >chrM.gfa

echo "== one window of it, as a file the graph view opens"
odgi build -g chrM.gfa -o chrM.og
# -c 0 takes the window's own nodes and no neighbours past it
odgi extract -i chrM.og -o window.og -r "$WINDOW" -c 0
odgi view -i window.og -g >chrM_window.gfa

echo "== the graph's bubbles as a VCF, one column per haplotype"
# -P names the reference sample's paths; -a writes every snarl, nested ones too
vg deconstruct -P "$REFERENCE" -a chrM.gfa >chrM.deconstruct.vcf
# LV=0 keeps the top-level sites, since a nested site reads as no-call in every
# haplotype that takes another branch around it. The contig is renamed to the
# assembly's own spelling, and each genotype is written as the single haploid
# call it is: deconstruct writes a mitochondrial call as one side of a phased
# pair (`.|1`), which draws a second, empty haplotype per sample.
python3 - "$REFERENCE" <<'PY'
import re
import sys

reference = sys.argv[1]
with open('chrM.deconstruct.vcf') as src, open('chrM.vcf', 'w') as out:
    for line in src:
        if line.startswith('#'):
            out.write(line.replace(f'ID={reference}#0#chrM', 'ID=chrM'))
            continue
        f = line.rstrip('\n').split('\t')
        if not re.search(r'(^|;)LV=0(;|$)', f[7]):
            continue
        f[0] = 'chrM'
        for i in range(9, len(f)):
            alleles = [a for a in re.split(r'[|/]', f[i]) if a != '.']
            f[i] = alleles[0] if alleles else '.'
        out.write('\t'.join(f) + '\n')
PY
bgzip -f -k chrM.vcf
tabix -f -p vcf chrM.vcf.gz

echo "== each haplotype's lineage, from Haplogrep"
# Haplogrep reads a diploid genotype, so each haploid call is doubled for it
awk -F'\t' -v OFS='\t' '/^#/ { print; next } { for (i = 10; i <= NF; i++) $i = ($i == "." ? "./." : $i "/" $i); print }' \
  chrM.vcf >chrM.haplogrep.vcf
"$HAPLOGREP" classify --tree phylotree-rcrs@17.3 --in chrM.haplogrep.vcf --out haplogroups.tsv

echo "== the sample table: population, haplogroup and its branch of the tree"
[ -s pedigree.txt ] || curl -fsSL -o pedigree.txt "$PEDIGREE"
python3 - <<'PY'
import csv

# PhyloTree's top branches: L0 to L6 are African, M and N leave L3, R leaves N
M_BRANCH = set('CDEGQZM')
N_BRANCH = set('AIOSWXYN')


def branch(haplogroup):
    if haplogroup.startswith('L'):
        return haplogroup[:2]
    letter = haplogroup[:1]
    return 'M' if letter in M_BRANCH else 'N' if letter in N_BRANCH else 'R'


population = {}
for line in open('pedigree.txt'):
    f = line.split()
    if f[0] != 'FamilyID':
        population[f[1]] = (f[6], f[5])
haplogroup = {
    row['SampleID']: row['Haplogroup']
    for row in csv.DictReader(open('haplogroups.tsv'), delimiter='\t')
}
for line in open('chrM.vcf'):
    if line.startswith('#CHROM'):
        samples = line.rstrip('\n').split('\t')[9:]
        break
with open('chrM_samples.tsv', 'w') as out:
    out.write('name\tsuperpopulation\tpopulation\thaplogroup\tbranch\n')
    for sample in samples:
        superpopulation, pop = population.get(sample, ('other', 'other'))
        h = haplogroup[sample]
        out.write(f'{sample}\t{superpopulation}\t{pop}\t{h}\t{branch(h)}\n')
PY

echo "== config.json"
python3 - <<'PY'
import json

config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'plugins': [
        {
            'name': 'GraphGenomeView',
            'esmUrl': 'https://unpkg.com/jbrowse-plugin-graphgenomeviewer/dist/jbrowse-plugin-graphgenomeviewer.esm.js',
        }
    ],
    'assemblies': [
        {
            'name': 'hg38',
            'aliases': ['GRCh38'],
            'uri': 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
            'refNameAliases': {
                'uri': 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt'
            },
        }
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
        {
            'type': 'VariantTrack',
            'trackId': 'hprc_chrM_graph_variants',
            'name': 'HPRC chrM graph, top-level sites (vg deconstruct)',
            'assemblyNames': ['hg38'],
            'adapter': {
                'type': 'VcfTabixAdapter',
                'uri': 'chrM.vcf.gz',
                'samplesTsvLocation': {'uri': 'chrM_samples.tsv'},
            },
        },
    ],
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
PY

echo "Wrote $(pwd)/chrM_window.gfa, chrM.vcf.gz{,.tbi}, chrM_samples.tsv and config.json"
