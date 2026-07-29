#!/usr/bin/env bash
#
# Reproducibly build the structural-variant track that
# website/docs/tutorials/dog10k_svs.md follows along in.
#
# Schall & Kidd (2025) genotyped long-read-discovered structural variants across
# the Dog10K collection and found 283 SVs with a signature of selection within
# breed clades. One of them is a 7.8 kb deletion inside an intron of NHEJ1, the
# variant associated with Collie eye anomaly. This script slices that locus out
# of their public genotype VCF for a set of Collie-clade breeds, three
# unaffected breeds, and four gray wolves.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl,
#           python3.
# Usage:    bash scripts/build_dog10k_nhej1_sv.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_sv_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
ZEN=https://zenodo.org/api/records/14968874/files
SV=$ZEN/Dog10k_manta_paragraph.vcf.gz/content
SVI=$ZEN/Dog10k_manta_paragraph.vcf.gz.tbi/content
# NHEJ1 on UU_Cfam_GSD_1.0 (UCSC canFam4), plus flanks; the deletion itself is
# chr37:25,574,005-25,581,806.
REGION=chr37:25500000-25620000

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# Breeds in the order the figure stacks them: the Collie-clade breeds that carry
# the deletion, three breeds that do not, and gray wolves as the outgroup. Only
# the first N of the larger breeds are taken, to keep the figure legible.
python3 - <<'PY' > sv.samples
# columns 12 and 17 are includedInVCF and SNP.keep: the analysis set, which is
# what the SV genotyping ran on
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
rows = [r for r in rows if r[11] == 'YES' and r[16] == 'TRUE']
groups = [('Collie', None), ('Shetland Sheepdog', None),
          ('Lancashire Heeler', 4), ('Silken Windhound', None),
          ('Australian Shepherd', 3), ('German Shepherd Dog', 2),
          ('Labrador Retriever', 4)]
out = []
for breed, n in groups:
    ids = [r[0] for r in rows if r[1] == breed]
    out += ids[:n] if n else ids
# Greek gray wolves, the same population the local-ancestry tutorial's panel uses
out += [r[0] for r in rows if r[2] == 'Wolf' and r[1] == 'Greece'][:4]
print('\n'.join(out))
PY

# The genotype VCF is 5.9 GB; bcftools reads only this locus over HTTP. Zenodo
# serves the file and its index from separate content URLs, so the index is
# named explicitly with ##idx## rather than guessed from the data URL.
bcftools view -r "$REGION" -S sv.samples --force-samples \
  -Oz -o dog10k_nhej1_svs.vcf.gz "$SV##idx##$SVI"
tabix -f -p vcf dog10k_nhej1_svs.vcf.gz

echo
echo "Genotypes of the Collie eye anomaly deletion (chr37:25,574,005):"
bcftools query -r chr37:25574005-25574006 -f '[%SAMPLE=%GT ]\n' \
  dog10k_nhej1_svs.vcf.gz | tr ' ' '\n' | grep -v '=0/0' || true

echo
echo "Wrote $(pwd)/dog10k_nhej1_svs.vcf.gz (plus its .tbi)."
echo "Load it with the track JSON in the structural-variant tutorial."
