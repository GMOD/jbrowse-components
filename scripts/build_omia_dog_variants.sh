#!/usr/bin/env bash
#
# Build the OMIA causal-variant track the dog tutorials annotate their loci with.
#
# OMIA (Online Mendelian Inheritance in Animals, omia.org) curates the published
# causal variants of Mendelian traits in animals, one record per variant with its
# phenotype, mode of inheritance, HGVS coordinates and the assembly those
# coordinates were reported on. It publishes the whole database as a mysqldump,
# which is the only form that carries coordinates, so this script reads the dump
# directly rather than scraping the site.
#
# The dog records are split across four assemblies. The tutorials are on
# UU_Cfam_GSD_1.0 (UCSC canFam4), so the CanFam3.1 majority is lifted with UCSC's
# own chain; records on the other two assemblies are reported and dropped rather
# than silently placed. The script prints how many of each it kept.
#
# Requires: curl, python3, htslib (bgzip, tabix). The UCSC liftOver binary is
#           downloaded into the output directory; nothing is installed.
# Usage:    bash scripts/build_omia_dog_variants.sh [outdir]
set -euo pipefail

OUTDIR="${1:-omia_dog_build}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# fetched on demand so a bare `curl -O` of this one script still works
HELPERS=(omia_sql_to_bed.py omia_bed_to_gff.py)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || curl -fsSL -o "$HERE/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OMIA_DUMP=https://omia.org/static/omia.sql.gz
CHAIN=https://hgdownload.soe.ucsc.edu/goldenPath/canFam3/liftOver/canFam3ToCanFam4.over.chain.gz
LIFTOVER=https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/liftOver

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ~200 MB, every species. Cached: OMIA rebuilds it nightly, so re-running this
# script on a different day is a different file and a different variant count.
[ -f omia.sql.gz ] || curl -fsSL -o omia.sql.gz "$OMIA_DUMP"
[ -f canFam3ToCanFam4.over.chain.gz ] || curl -fsSL -o canFam3ToCanFam4.over.chain.gz "$CHAIN"
if [ ! -x ./liftOver ]; then
  curl -fsSL -o liftOver "$LIFTOVER"
  chmod +x liftOver
fi

# Dump -> two BEDs: one already on canFam4, one on canFam3 to be lifted. The
# name column is a row id, so the lift can be joined back onto the record.
python3 "$HERE/omia_sql_to_bed.py" omia.sql.gz native.bed canFam3.bed variants.tsv

./liftOver canFam3.bed canFam3ToCanFam4.over.chain.gz lifted.bed unmapped.bed
echo "liftOver: $(wc -l < lifted.bed) of $(wc -l < canFam3.bed) CanFam3.1 records reached canFam4"

# Merge the two coordinate sources back onto the records and write GFF3. The
# feature detail popup is where a curated record earns its place -- phenotype,
# gene, inheritance, the HGVS string as OMIA published it, and which assembly it
# was published on -- so every column travels as an attribute.
python3 "$HERE/omia_bed_to_gff.py" variants.tsv native.bed lifted.bed omia_dog_variants.gff3

bgzip -f omia_dog_variants.gff3
tabix -f -p gff omia_dog_variants.gff3.gz

echo
echo "wrote $OUTDIR/omia_dog_variants.gff3.gz ($(gzip -dc omia_dog_variants.gff3.gz | grep -cv '^#') records)"
