#!/usr/bin/env bash
#
# Whole-genome HPRC haplotypes against GRCh38 as one indexed all-vs-all PIF, for
# a MultiWaySyntenyDisplay lane stack: the eight haplotypes demos/hprc draws at
# the CFH cluster, taken genome-wide, each with its whole CAT annotation.
#
# The alignment is unpacked from the pangenome graph itself. HPRC publishes the
# minigraph-cactus graph's alignment projected onto GRCh38 as a TAF
# (hal2maf of the same cactus run that produced the graph; see
# agent-docs/reference/HPRC_RELEASE2.md for why the v2.0 TAF and not the v2.1
# MAF). Each block there holds the reference row and one row per haplotype
# aligned to it, so a haplotype's pairwise alignment to GRCh38 is its rows,
# unpacked and chained: `taffy view` streams one chromosome of blocks and
# scripts/maf_to_pairwise_paf.py turns them into PAF records with =/X/I/D
# CIGARs, chaining consecutive blocks while the haplotype continues on both
# sequences and bridging a jump of up to MAX_GAP unaligned bp on either side as
# an indel (the projection drops insertions that fall between blocks). This
# replaces filtering HPRC's separately published impg PAF
# (hprc465vsgrch38.aln.paf.gz), which is a different alignment of the same
# assemblies rather than the graph's own; what is drawn now is the graph.
#
# The PAF is a star (every row is one haplotype against GRCh38), which is
# exactly the shape a lane stack anchored on hg38 reads; a band between two
# haplotypes is empty by construction.
#
# Requires: curl, awk, sort, python3, bgzip, tabix, taffy (TAFFY=/path/to/taffy
#           to point at a build), and the JBrowse CLI (`jbrowse`, or
#           JBROWSE_CLI="node products/jbrowse-cli/src/bin.ts" for the in-repo
#           one, which is where `make-pif --coarse` lives)
# Usage:    bash scripts/build_hprc_multiway_synteny.sh [outdir]
#           JOBS=8 CAT_JOBS=4 bash scripts/build_hprc_multiway_synteny.sh
#
# Measured 2026-09-05 on 16 cores: taffy decodes chr22 (17 GB of MAF text for
# 464 haplotypes) in 89 s and the converter keeps up with it at 176 MB/s, so
# the genome is ~1 TB of MAF streamed once, JOBS chromosomes at a time. A
# `LC_ALL=C grep` pre-filter ahead of the converter was slower, not faster
# (BSD grep's alternation ran at 90 MB/s), so nothing sits between them.
#
# Writes into ./hprc_multiway_build/:
#   hprc-v2.0-mc-grch38.full.taf.gz{,.tai}  the graph alignment (6 GB, reused)
#   parts/<chr>.paf                    one chromosome each, converter log beside
#   hprc_multiway_graph.paf            the PAF, PanSN names
#   hprc_multiway_graph.pif.gz{,.csi}  make-pif's two-tier index of it
#   <sample>.<hap>.graph.chrom.sizes   query contigs and srcSizes off the MAF
#   <sample>.<hap>.genes.gff3.gz{,.tbi}  HPRC's CAT annotation, whole assembly
#   config.json                        the demo config, relative URIs; the
#                                      checked-in copy is demos/hprc_multiway/
#   README.txt                         provenance, to host beside the data
set -euo pipefail

OUTDIR="${1:-hprc_multiway_build}"
JOBS="${JOBS:-6}"
CAT_JOBS="${CAT_JOBS:-4}"
MAX_GAP="${MAX_GAP:-10000}"
SCRIPTS=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUTDIR"
cd "$OUTDIR"
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR" parts

if [ -n "${JBROWSE_CLI:-}" ]; then jb() { $JBROWSE_CLI "$@"; }
elif command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
TAFFY="${TAFFY:-taffy}"
command -v "$TAFFY" >/dev/null 2>&1 || { echo "taffy not found; build https://github.com/ComparativeGenomicsToolkit/taffy and set TAFFY=" >&2; exit 1; }

REL=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2
TAF_URL=$REL/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz
TAF=$(basename "$TAF_URL")
HG38_SIZES=https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
CAT_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
REFERENCE=GRCh38
HAPLOTYPES="HG01109#1 HG01123#1 HG01960#1 HG02055#1 HG00097#1 HG00099#1 HG00128#1 HG00133#1"
CHROMOSOMES="chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY"
# CAT's liftoff/augustus pass leaves a few "genes" spanning most of a contig
# (a 61 Mb lncRNA on HG01960.1); the longest real human gene is under 2.5 Mb
GENE_LIMIT=5000000

assembly_name() { echo "$1" | tr '#' .; }

fetch() {
  local url=$1 out=$2
  if [ -f "$out" ]; then
    echo "   reusing $out"
  else
    curl -fsSL -C - -o "$out.part" "$url"
    mv "$out.part" "$out"
  fi
}

echo "== graph alignment"
fetch "$TAF_URL" "$TAF"
fetch "$TAF_URL.tai" "$TAF.tai"
fetch "$HG38_SIZES" hg38.chrom.sizes

# taffy view -r fails silently on a range past the contig's end (empty MAF,
# exit 0), so the range is the real chromosome length, and the check is that
# the converter wrote records rather than that a file exists. It also fails
# the same way on a range ending past the contig's LAST INDEX ENTRY when the
# next contig in index order sits earlier in the file (tai_iterator bounds its
# scan with that contig's first record): this file is written chr10..chr19,
# chr1, chr20..chr22, chr2, chr3.., so chr1 (successor chr10) and chr2
# (successor chr20) refuse their full length. A one-line fix in taffy's
# tai.c is to null the bound when it names another contig; with a stock taffy
# the range is retried capped at the last index entry, which drops what lies
# past it -- on chr2 that is 12 kb, 10 kb of it the telomeric N run.
unpack_range() {
  "$TAFFY" view -i "$TAF" -r "$REFERENCE.$1:0-$2" -m 2>"parts/$1.taffy.err" \
    | python3 "$SCRIPTS/maf_to_pairwise_paf.py" --reference "$REFERENCE" \
        --queries "$(echo "$HAPLOTYPES" | tr ' ' ,)" --max-gap "$MAX_GAP" \
        --chrom-sizes-dir "parts/$1.sizes" > "parts/$1.paf.part" 2>"parts/$1.log"
}
last_indexed() {
  awk -v c="$REFERENCE.$1" '$1==c {f=1; p=$2; next} f && $1!="*" {exit} f {p+=$2} END {print p}' "$TAF.tai"
}
convert_chromosome() {
  set -euo pipefail
  local chr=$1 len last
  if [ -f "parts/$chr.paf" ]; then
    echo "   reusing parts/$chr.paf"
  else
    len=$(awk -v c="$chr" '$1==c {print $2}' hg38.chrom.sizes)
    [ -n "$len" ] || { echo "$chr has no length in hg38.chrom.sizes" >&2; exit 1; }
    local started=$SECONDS
    unpack_range "$chr" "$len"
    if [ ! -s "parts/$chr.paf.part" ] && grep -q 'not found in taffy index' "parts/$chr.taffy.err"; then
      last=$(last_indexed "$chr")
      echo "   $chr: taffy refused 0-$len, retrying 0-$last (the last index entry; $((len - last)) bp past it dropped)"
      unpack_range "$chr" "$last"
    fi
    if [ -s "parts/$chr.paf.part" ]; then
      mv "parts/$chr.paf.part" "parts/$chr.paf"
      echo "   $chr: $(cat "parts/$chr.log") [$((SECONDS - started))s]"
    else
      echo "   $chr: NO RECORDS: $(head -c 200 "parts/$chr.taffy.err")" >&2
      exit 1
    fi
  fi
}
export -f unpack_range last_indexed
export -f convert_chromosome
export TAFFY TAF SCRIPTS REFERENCE HAPLOTYPES MAX_GAP

if [ -f hprc_multiway_graph.paf ]; then
  echo "== reusing hprc_multiway_graph.paf"
else
  echo "== unpacking $REFERENCE vs $HAPLOTYPES, $JOBS chromosomes at a time"
  started=$SECONDS
  echo "$CHROMOSOMES" | tr ' ' '\n' | xargs -P "$JOBS" -I{} bash -c 'convert_chromosome {}'
  for chr in $CHROMOSOMES; do cat "parts/$chr.paf"; done > hprc_multiway_graph.paf.part
  mv hprc_multiway_graph.paf.part hprc_multiway_graph.paf
  echo "   unpacked in $((SECONDS - started))s"
fi
echo "   $(wc -l < hprc_multiway_graph.paf | tr -d ' ') rows, $(du -h hprc_multiway_graph.paf | cut -f1)"

for hap in $HAPLOTYPES; do
  name=$(assembly_name "$hap")
  for f in parts/*.sizes/"$name.chrom.sizes"; do if [ -f "$f" ]; then cat "$f"; fi; done \
    | LC_ALL=C sort -u | sort -k2,2nr -k1,1 > "$name.graph.chrom.sizes"
  rows=$(LC_ALL=C grep -c "^$hap#" hprc_multiway_graph.paf || true)
  echo "   $name: $rows rows on $(wc -l < "$name.graph.chrom.sizes" | tr -d ' ') contigs"
done

if [ -f hprc_multiway_graph.pif.gz ]; then
  echo "== reusing hprc_multiway_graph.pif.gz"
else
  echo "== make-pif (fine + coarse tiers, CSI)"
  started=$SECONDS
  jb make-pif hprc_multiway_graph.paf --csi --out hprc_multiway_graph.pif.gz
  echo "   indexed in $((SECONDS - started))s"
fi
echo "   header: $(gzip -dc hprc_multiway_graph.pif.gz | head -1)"
echo "   coarse seqids: $(tabix -l hprc_multiway_graph.pif.gz | grep -c '^[TQ]')"

[ -f cat_index.csv ] || curl -fsSL -o cat_index.csv "$CAT_INDEX"

fetch_cat_annotation() {
  local hap=$1 name=$2 url=$3
  if [ -f "$name.genes.gff3.gz" ]; then
    echo "   reusing $name.genes.gff3.gz"
  else
    if [ ! -f "$name.cat.gff3.gz" ]; then
      curl -fsS -o "$name.cat.gff3.gz.part" "$url"
      mv "$name.cat.gff3.gz.part" "$name.cat.gff3.gz"
    fi
    gzip -dc "$name.cat.gff3.gz" \
      | awk -F'\t' -v limit="$GENE_LIMIT" '$3=="gene" && $5-$4 > limit {
          n = split($9, kv, ";")
          for (i = 1; i <= n; i++) if (kv[i] ~ /^ID=/) print substr(kv[i], 4)
        }' > "$name.dropped_genes.txt"
    # every CAT row names its gene in gene_id=, so descendants drop on one key
    { echo '##gff-version 3'
      gzip -dc "$name.cat.gff3.gz" \
        | awk -F'\t' -v dropfile="$name.dropped_genes.txt" '
            BEGIN { while ((getline g < dropfile) > 0) drop[g] = 1 }
            /^#/ { next }
            $3=="intron" || $3=="start_codon" || $3=="stop_codon" { next }
            {
              n = split($9, kv, ";"); g = ""
              for (i = 1; i <= n; i++) if (kv[i] ~ /^gene_id=/) g = substr(kv[i], 9)
              if (!(g in drop)) print
            }' \
        | LC_ALL=C sort -S 1G -k1,1 -k4,4n -k5,5n
    } > "$name.genes.gff3.part"
    mv "$name.genes.gff3.part" "$name.genes.gff3"
    bgzip -f "$name.genes.gff3"
    tabix -f -p gff "$name.genes.gff3.gz"
    echo "   $name: $(wc -l < "$name.dropped_genes.txt" | tr -d ' ') gene(s) over $GENE_LIMIT bp dropped, $(gzip -dc "$name.genes.gff3.gz" | awk -F'\t' '$3=="gene"' | wc -l | tr -d ' ') genes kept"
  fi
}
export -f fetch_cat_annotation
export GENE_LIMIT

echo "== CAT annotations, $CAT_JOBS at a time"
for hap in $HAPLOTYPES; do
  sample=${hap%%#*}
  h=${hap##*#}
  s3=$(awk -F, -v s="$sample" -v h="$h" '$1==s && $2==h {print $4}' cat_index.csv)
  [ -n "$s3" ] || { echo "no CAT annotation indexed for $hap" >&2; exit 1; }
  printf '%s\n%s\n%s\n' "$hap" "$(assembly_name "$hap")" \
    "https://s3-us-west-2.amazonaws.com/human-pangenomics/${s3#s3://human-pangenomics/}"
done | xargs -P "$CAT_JOBS" -n 3 bash -c 'fetch_cat_annotation "$@"' _

echo "== config.json"
HAPLOTYPES="$HAPLOTYPES" python3 - <<'PY'
import json
import math
import os

haps = os.environ['HAPLOTYPES'].split()
names = [h.replace('#', '.') for h in haps]
lanes = 1 + len(names)
height = math.ceil(lanes * 22 / 10) * 10


def uri(path):
    return {'uri': path, 'locationType': 'UriLocation'}


config = {
    'assemblies': [{
        'name': 'hg38',
        'aliases': ['GRCh38'],
        'uri': 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        'refNameAliases': {
            'uri': 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
    }] + [{
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {
                'type': 'ChromSizesAdapter',
                'chromSizesLocation': uri(f'{name}.graph.chrom.sizes'),
            },
        },
    } for name in names],
    'tracks': [{
        'type': 'FeatureTrack',
        'trackId': 'hg38_ncbiRefSeq_ucsc',
        'name': 'NCBI RefSeq genes (hg38)',
        'assemblyNames': ['hg38'],
        'adapter': {
            'type': 'Gff3TabixAdapter',
            'uri': 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
            'csi': True,
        },
    }] + [{
        'type': 'FeatureTrack',
        'trackId': f'hprc_genes_{name.replace(".", "_")}',
        'name': f'{name} genes (HPRC release 2 CAT annotation)',
        'assemblyNames': [name],
        'adapter': {
            'type': 'Gff3TabixAdapter',
            'uri': f'{name}.genes.gff3.gz',
        },
    } for name in names] + [{
        'type': 'SyntenyTrack',
        'trackId': 'hprc_multiway',
        'name': f'HPRC haplotypes vs GRCh38 (hg38 + {len(names)} haplotypes, unpacked from the release 2 graph)',
        'assemblyNames': ['hg38', *names],
        'adapter': {
            'type': 'AllVsAllIndexedPAFAdapter',
            'uri': 'hprc_multiway_graph.pif.gz',
            'csi': True,
            'assemblyNames': ['hg38', *names],
            'assemblyNameToPanSN': {'hg38': 'GRCh38#0', **dict(zip(names, haps))},
        },
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'hprc_multiway-MultiWaySyntenyDisplay',
            'height': height,
        }],
    }],
    'defaultSession': {
        'name': 'HPRC haplotypes vs GRCh38',
        'views': [{
            'type': 'LinearGenomeView',
            'assembly': 'hg38',
            'loc': 'chr1:196,700,000-197,000,000',
            'tracks': ['hg38_ncbiRefSeq_ucsc', 'hprc_multiway'],
        }],
    },
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'   {lanes} lanes, display height {height}')
PY

{
  cat <<EOF
HPRC release 2 haplotypes vs GRCh38, unpacked from the graph, indexed for JBrowse 2
==================================================================================

A redistribution of HPRC data, not original data: eight haplotypes' pairwise
alignments to GRCh38 unpacked from the minigraph-cactus graph's own alignment,

  $TAF_URL

the graph projected onto GRCh38 as MAF blocks, each holding the reference row
and a row per haplotype aligned there. Per chromosome, \`taffy view -m\` streams
the blocks and scripts/maf_to_pairwise_paf.py (jbrowse-components) keeps the
rows of

  $HAPLOTYPES

reads an =/X/I/D CIGAR off each row against the reference, and chains
consecutive blocks into one PAF record while the haplotype continues on both
sequences, bridging up to $MAX_GAP unaligned bp on either side as an indel.
The PAF is indexed with \`jbrowse make-pif --csi\`,
and each haplotype's contigs and lengths come from the same rows. Beside it,
each haplotype's CAT gene annotation from the release 2 annotation index

  $CAT_INDEX

with intron, start_codon and stop_codon rows dropped and genes over
$GENE_LIMIT bp removed. HPRC data is released under CC0; see
https://github.com/human-pangenomics/hpp_pangenome_resources for the release
and its terms. Rebuilt by scripts/build_hprc_multiway_synteny.sh in
https://github.com/GMOD/jbrowse-components.

Files
-----

  hprc_multiway_graph.pif.gz{,.csi}    $(wc -l < hprc_multiway_graph.paf | tr -d ' ') PAF rows, fine and coarse tiers
EOF
  for hap in $HAPLOTYPES; do
    name=$(assembly_name "$hap")
    printf '  %-36s %s rows on %s contigs, %s contigs annotated\n' \
      "$name.{graph.chrom.sizes,genes.gff3.gz}" \
      "$(LC_ALL=C grep -c "^$hap#" hprc_multiway_graph.paf || true)" \
      "$(wc -l < "$name.graph.chrom.sizes" | tr -d ' ')" \
      "$(tabix -l "$name.genes.gff3.gz" | wc -l | tr -d ' ')"
  done
} > README.txt

echo
echo "Wrote $(pwd)/hprc_multiway_graph.pif.gz{,.csi}, *.graph.chrom.sizes, *.genes.gff3.gz{,.tbi}, config.json, README.txt"
