#!/usr/bin/env bash
#
# Build the OMIA causal-variant track the cattle pangenome tutorial annotates its
# loci with: every OMIA cattle record published on ARS-UCD1.2 or ARS-UCD1.3,
# as GFF3 on bosTau9.
#
# The dog version, build_omia_dog_variants.sh, lifts most of its records from an
# older assembly. Cattle needs no chain: ARS-UCD1.3 carries every ARS-UCD1.2
# chromosome under the same accession, version and length, so both place
# directly. Records on UMD3.1 or ARS-UCD2.0 are reported and dropped.
#
# Requires: curl, python3, htslib (bgzip, tabix)
# Usage:    bash scripts/build_omia_cattle_variants.sh [outdir]
set -euo pipefail

OUTDIR="${1:-omia_cattle_build}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HELPERS=(omia_sql_to_bed.py omia_bed_to_gff.py)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || curl -fsSL -o "$HERE/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ~200 MB, every species, rebuilt nightly, so a later run is a different file.
[ -f omia.sql.gz ] || curl -fsSL -o omia.sql.gz https://omia.org/static/omia.sql.gz

python3 "$HERE/omia_sql_to_bed.py" cattle omia.sql.gz native.bed lift.bed variants.tsv
python3 "$HERE/omia_bed_to_gff.py" variants.tsv native.bed lift.bed omia_cattle_variants.gff3

bgzip -f omia_cattle_variants.gff3
tabix -f -p gff omia_cattle_variants.gff3.gz

echo
echo "wrote $OUTDIR/omia_cattle_variants.gff3.gz ($(gzip -dc omia_cattle_variants.gff3.gz | grep -cv '^#') records)"
