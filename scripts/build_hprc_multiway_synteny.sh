#!/usr/bin/env bash
#
# Whole-genome HPRC haplotypes against GRCh38 as one indexed all-vs-all PIF, for
# a MultiWaySyntenyDisplay lane stack: the eight haplotypes demos/hprc's gbz-base
# lanes track names, taken genome-wide, each with its whole CAT annotation.
#
# The alignment is unpacked from the minigraph-cactus GFA. Every haplotype is a
# walk through the graph's nodes, and two walks through one node carry identical
# sequence, so a haplotype's pairwise alignment to GRCh38 is the nodes the two
# walks share, chained in reference order. gfa_to_pairwise_paf.py
# (github.com/cmdcolin/gfa-to-pairwise-paf, fetched at a pinned tag) streams
# the GFA once (pigz -dc ahead of it), keeps only the reference walks and the
# eight haplotypes', and writes PAF records with =/X/I/D CIGARs: each shared node
# is `=`, the private bp between two shared nodes pair as X with the remainder I
# or D, and a chain breaks where more than MAX_GAP private bp sit on either side.
# No HAL, MAF or projection; any path can be the reference, so this route also
# gives mate-vs-mate alignments directly (--reference HG01109#1 --queries
# HG01123#1).
#
# This replaces filtering HPRC's separately published impg PAF
# (hprc465vsgrch38.aln.paf.gz), which is a different alignment of the same
# assemblies rather than the graph's own; what is drawn is the graph. The PAF
# is a star (every row is one haplotype against GRCh38), which is exactly the
# shape a lane stack anchored on hg38 reads; a band between two haplotypes is
# empty by construction.
#
# Requires: curl, awk, sort, python3, bgzip, tabix, and the JBrowse CLI
#           (`jbrowse`, or JBROWSE_CLI="node products/jbrowse-cli/src/bin.ts"
#           for the in-repo one, which is where `make-pif --coarse` lives);
#           pigz (gzip -dc works, slower)
# Usage:    bash scripts/build_hprc_multiway_synteny.sh [outdir]
#           CAT_JOBS=4 bash scripts/build_hprc_multiway_synteny.sh
#           GFA=/data/hprc-v2.1-mc-grch38.gfa.gz bash scripts/build_hprc_multiway_synteny.sh
#           UPLOAD=1 bash scripts/build_hprc_multiway_synteny.sh   # copy the
#             PIF and chrom.sizes to s3://jbrowse.org/demos/hprc_multiway/,
#             skipping any key already there; config.json and the READMEs go
#             through scripts/deploy-demo.sh from the checked-in demos/ copies
#
# Measured 2026-09-05 on 16 cores: the 63 GB GFA downloads in 38 min (27 MB/s)
# and the converter streams its 376 GB of text in 1665 s (226 MB/s, pigz-bound:
# 79-86% of a core against python's 41-49%) at 1.49 GB peak RSS, one process;
# make-pif takes 8 s on the 176 MB PAF.
#
# Writes into ./hprc_multiway_build/:
#   hprc-v2.1-mc-grch38.gfa.gz         the graph (64 GB, reused; or GFA=..., GFA_URL=...)
#   hprc_multiway_gfa.paf              the PAF, PanSN names
#   hprc_multiway_gfa.pif.gz{,.csi}    make-pif's two-tier index of it
#   contig_lengths.fai                 the eight assemblies' .fai, joined
#   <sample>.<hap>.gfa.chrom.sizes     every contig walked, .fai length
#   <sample>.<hap>.genes.gff3.gz{,.tbi}  HPRC's CAT annotation, whole assembly
#   config.json                        the demo config, relative URIs; the
#                                      checked-in copy is demos/hprc_multiway/
#   README_gfa.txt                     provenance, to host beside the data
set -euo pipefail

OUTDIR="${1:-hprc_multiway_build}"
CAT_JOBS="${CAT_JOBS:-4}"
MAX_GAP="${MAX_GAP:-10000}"
GFA_TO_PAF_VERSION=v1.0.0
mkdir -p "$OUTDIR"
cd "$OUTDIR"
GFA_TO_PAF=gfa-to-pairwise-paf-$GFA_TO_PAF_VERSION/gfa_to_pairwise_paf.py
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR" parts

if [ -n "${JBROWSE_CLI:-}" ]; then jb() { $JBROWSE_CLI "$@"; }
elif command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
if command -v pigz >/dev/null 2>&1; then gunzip_stream() { pigz -dc "$@"; }; else gunzip_stream() { gzip -dc "$@"; }; fi
PAF=hprc_multiway_gfa.paf
PIF=hprc_multiway_gfa.pif.gz
SIZES=gfa.chrom.sizes
README=README_gfa.txt

REL=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2
GFA_URL="${GFA_URL:-$REL/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz}"
GFA="${GFA:-$(basename "$GFA_URL")}"
CAT_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
ASM_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
REFERENCE=GRCh38
HAPLOTYPES="HG01109#1 HG01123#1 HG01960#1 HG02055#1 HG00097#1 HG00099#1 HG00128#1 HG00133#1"
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

echo "== graph"
fetch "$GFA_URL" "$GFA"
mkdir -p "$(dirname "$GFA_TO_PAF")"
fetch "https://raw.githubusercontent.com/cmdcolin/gfa-to-pairwise-paf/$GFA_TO_PAF_VERSION/gfa_to_pairwise_paf.py" "$GFA_TO_PAF"

# The whole graph in one stream, one chromosome's S, L and W lines after
# another's; only GRCh38's walks and the eight requested haplotypes' are
# parsed. A contig's length off the walks alone is its largest W end, short by
# the telomere minigraph-cactus clipped (CM092085.1 walks to 242,284,449 of
# 242,287,352), so the assemblies' own .fai from the release 2 index supplies
# the exact lengths, PanSN-named as the converter expects.
fetch_contig_lengths() {
  [ -f asm_index.csv ] || curl -fsSL -o asm_index.csv "$ASM_INDEX"
  for hap in $HAPLOTYPES; do
    sample=${hap%%#*}
    h=${hap##*#}
    fai=$(awk -F, -v s="$sample" -v h="$h" '$1==s && $2==h {print $11}' asm_index.csv)
    [ -n "$fai" ] || { echo "no assembly .fai indexed for $hap" >&2; exit 1; }
    curl -fsSL "https://s3-us-west-2.amazonaws.com/${fai#s3://}"
  done > contig_lengths.fai.part
  mv contig_lengths.fai.part contig_lengths.fai
}
unpack_gfa() {
  [ -f contig_lengths.fai ] || fetch_contig_lengths
  gunzip_stream "$GFA" \
    | python3 "$GFA_TO_PAF" --reference "$REFERENCE#0" \
        --queries "$(echo "$HAPLOTYPES" | tr ' ' ,)" --max-gap "$MAX_GAP" \
        --contig-lengths contig_lengths.fai \
        --chrom-sizes-dir parts/gfa.sizes > "$PAF.part" 2>parts/gfa.log
}

if [ -f "$PAF" ]; then
  echo "== reusing $PAF"
else
  echo "== unpacking $REFERENCE vs $HAPLOTYPES from the GFA"
  started=$SECONDS
  unpack_gfa
  [ -s "$PAF.part" ] || { echo "   NO RECORDS: $(tail -c 400 parts/gfa.log)" >&2; exit 1; }
  mv "$PAF.part" "$PAF"
  sed 's/^/   /' parts/gfa.log
  echo "   unpacked in $((SECONDS - started))s"
fi
echo "   $(wc -l < "$PAF" | tr -d ' ') rows, $(du -h "$PAF" | cut -f1)"

for hap in $HAPLOTYPES; do
  name=$(assembly_name "$hap")
  for f in parts/*.sizes/"$name.chrom.sizes"; do if [ -f "$f" ]; then cat "$f"; fi; done \
    | LC_ALL=C sort -u | sort -k2,2nr -k1,1 > "$name.$SIZES"
  rows=$(LC_ALL=C grep -c "^$hap#" "$PAF" || true)
  echo "   $name: $rows rows on $(wc -l < "$name.$SIZES" | tr -d ' ') contigs"
done

if [ -f "$PIF" ]; then
  echo "== reusing $PIF"
else
  echo "== make-pif (fine + coarse tiers, CSI)"
  started=$SECONDS
  jb make-pif "$PAF" --csi --out "$PIF"
  echo "   indexed in $((SECONDS - started))s"
fi
echo "   header: $(gzip -dc "$PIF" | head -1)"
echo "   coarse seqids: $(tabix -l "$PIF" | grep -c '^[TQ]')"

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
HAPLOTYPES="$HAPLOTYPES" PIF="$PIF" SIZES="$SIZES" python3 - <<'PY'
import json
import math
import os

haps = os.environ['HAPLOTYPES'].split()
pif, sizes = os.environ['PIF'], os.environ['SIZES']
names = [h.replace('#', '.') for h in haps]
lanes = 1 + len(names)
height = math.ceil(lanes * 34 / 10) * 10


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
        'geneticCodes': {'chrM': 2},
    }] + [{
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {
                'type': 'ChromSizesAdapter',
                'chromSizesLocation': uri(f'{name}.{sizes}'),
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
        'name': f'HPRC haplotypes vs GRCh38 (hg38 + {len(names)} haplotypes, unpacked from the release 2 graph GFA)',
        'assemblyNames': ['hg38', *names],
        'adapter': {
            'type': 'MultiGenomeIndexedPAFAdapter',
            'uri': pif,
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
            'loc': 'chr1:196,640,000-196,900,000',
            'tracks': ['hg38_ncbiRefSeq_ucsc', 'hprc_multiway'],
        }],
    },
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'   {lanes} lanes, display height {height}')
PY

HOW="the minigraph-cactus graph itself,

  $GFA_URL

in which every haplotype is a walk through the graph's nodes and two walks
through one node carry identical sequence. gfa_to_pairwise_paf.py $GFA_TO_PAF_VERSION
(github.com/cmdcolin/gfa-to-pairwise-paf) streams the GFA once, keeps the
GRCh38 walks and those of

  $HAPLOTYPES

and writes one PAF record per chain of shared nodes: each shared node is an
\`=\` run, the private bp between two shared nodes pair as X with the remainder
I or D, and a chain breaks where more than $MAX_GAP private bp sit on either
side. Contig lengths are the assemblies' own, from the release 2 .fai files."
{
  cat <<EOF
HPRC release 2 haplotypes vs GRCh38, unpacked from the graph, indexed for JBrowse 2
==================================================================================

A redistribution of HPRC data, not original data: eight haplotypes' pairwise
alignments to GRCh38 unpacked from $HOW
The PAF is indexed with \`jbrowse make-pif --csi\`,
and each haplotype's contigs and lengths come from the same source. Beside it,
each haplotype's CAT gene annotation from the release 2 annotation index

  $CAT_INDEX

with intron, start_codon and stop_codon rows dropped and genes over
$GENE_LIMIT bp removed. HPRC data is released under CC0; see
https://github.com/human-pangenomics/hpp_pangenome_resources for the release
and its terms. Rebuilt by scripts/build_hprc_multiway_synteny.sh
in https://github.com/GMOD/jbrowse-components.

Files
-----

  $PIF{,.csi}    $(wc -l < "$PAF" | tr -d ' ') PAF rows, fine and coarse tiers
EOF
  for hap in $HAPLOTYPES; do
    name=$(assembly_name "$hap")
    printf '  %-36s %s rows on %s contigs, %s contigs annotated\n' \
      "$name.{$SIZES,genes.gff3.gz}" \
      "$(LC_ALL=C grep -c "^$hap#" "$PAF" || true)" \
      "$(wc -l < "$name.$SIZES" | tr -d ' ')" \
      "$(tabix -l "$name.genes.gff3.gz" | wc -l | tr -d ' ')"
  done
} > "$README"

# The bucket has no versioning, so a key that exists is left alone; the READMEs
# and config.json go through scripts/deploy-demo.sh from their demos/ copies.
if [ "${UPLOAD:-}" = 1 ]; then
  echo "== uploading new objects to s3://jbrowse.org/demos/hprc_multiway/"
  for f in "$PIF" "$PIF.csi" ./*."$SIZES"; do
    key="demos/hprc_multiway/${f#./}"
    if aws s3api head-object --bucket jbrowse.org --key "$key" >/dev/null 2>&1; then
      echo "   $key exists, left alone"
    else
      aws s3 cp --no-progress "$f" "s3://jbrowse.org/$key"
    fi
  done
  echo "   copy $README into demos/hprc_multiway/ and deploy it with scripts/deploy-demo.sh"
fi

echo
echo "Wrote $(pwd)/$PIF{,.csi}, *.$SIZES, *.genes.gff3.gz{,.tbi}, config.json, $README"
