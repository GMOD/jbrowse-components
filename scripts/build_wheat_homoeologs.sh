#!/usr/bin/env bash
#
# Build the wheat homoeolog view: a diploid grass over hexaploid bread wheat over
# one of wheat's own diploid donors, from Ensembl Compara ortholog tables.
#
# Bread wheat is an allohexaploid carrying three subgenomes (A, B, D) from three
# diploid grasses. A gene a diploid outgroup has once, bread wheat has three
# times, once per subgenome. Stacked, that draws as every sorghum gene fanning
# into three wheat homoeologs, then collapsing back to one in Aegilops tauschii,
# the diploid that donated the D subgenome alone.
#
# The converter counts a `copies` column - how many orthologs the reference gene
# has in the partner - so the fan-out is a number on every link rather than only
# a density. Coloring by it separates the genes that kept all three homoeologs
# from the ones that lost one.
#
# The tauschii band is the control: same pipeline, same file, and it has to come
# out at one copy per gene. If it does not, the count is measuring the pipeline
# rather than the ploidy.
#
# No genome FASTA is downloaded: each assembly is a ChromSizesAdapter built from
# the `##sequence-region` header of that species' GFF3, which is all a gene-level
# synteny view needs. Bread wheat as sequence is over 10 GB; as names and lengths
# it is a few hundred bytes.
#
# Requires: python3, wget, and node (JBrowse CLI, via npx unless `jbrowse` is on
#           PATH). Downloads ~350 MB.
# Usage:    bash scripts/build_wheat_homoeologs.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(compara_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-wheat_homoeologs_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Every file this script writes lands under a .part name and is renamed only once
# its producer returns clean, which is what makes the `[ -f ]` guards sound: an
# interrupted run leaves nothing that looks finished.
#
# Guarding on the final name alone does not survive a run being killed, and both
# halves of that bit while this was being written. A partial download is accepted
# on the re-run and surfaces much later as `gzip: unexpected end of file`; worse,
# a `>` redirect CREATES its output before the producer has written a byte, so a
# step that dies leaves a zero-length file the next run treats as done and
# everything downstream reads as empty.
fetch() {
  local dest=$1 url=$2
  if [ ! -f "$dest" ]; then
    wget -c -O "$dest.part" "$url"
    mv "$dest.part" "$dest"
  fi
}

jb() {
  if command -v jbrowse >/dev/null 2>&1; then
    jbrowse "$@"
  else
    npx -y @jbrowse/cli "$@"
  fi
}

APP=jbrowse2
REL=63
BASE=https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-$REL
# Compara's release number advances separately from the plants one.
COMPARA_REL=116
# Sequence regions to keep, by length. Ensembl lists every unplaced scaffold in
# the GFF3 header and a synteny row carrying thousands of them is unreadable;
# every real chromosome in all three assemblies clears this and nothing else
# comes close, so it selects them without naming any.
MINSEQ=10000000

# Heredoc columns: short name (= the JBrowse assembly name), Compara species key
# (= the Ensembl directory name), Ensembl file prefix, assembly version. Row
# order is the row order of the stacked view.
#
# Both ortholog tables come from SORGHUM's Compara file, because an export covers
# a fixed set of partners rather than every species in the division: sorghum's
# file carries bread wheat and Aegilops tauschii, while bread wheat's own file
# carries neither. So sorghum anchors both bands, and sits in the middle.
SPECIES=$(cat <<'EOF'
tauschii aegilops_tauschii Aegilops_tauschii Aet_v4.0
sorghum sorghum_bicolor Sorghum_bicolor Sorghum_bicolor_NCBIv3
wheat triticum_aestivum Triticum_aestivum IWGSC
EOF
)
NAMES=$(echo "$SPECIES" | awk '{print $1}')

# ── Per species: annotation, then chrom.sizes and a gene BED ─────────────────
echo "$SPECIES" | while read -r name species prefix asm; do
  fetch "$name.gff3.gz" "$BASE/gff3/$species/$prefix.$asm.$REL.gff3.gz"

  # chrom.sizes from the GFF3's own header, so no genome FASTA is needed. Read
  # in python rather than piped through awk: stopping at the first feature line
  # closes the pipe on gunzip, and under `set -o pipefail` that SIGPIPE fails
  # the script. Written in the GFF3's own order, which is the order a row is
  # drawn in wherever nothing overrides it - and for wheat that is 1A 1B 1D 2A
  # 2B 2D ..., which puts each homoeologous group's three chromosomes together
  # and is what makes a three-way fan read as one bundle rather than three.
  if [ ! -f "$name.chrom.sizes" ]; then
    python3 - "$name.gff3.gz" "$MINSEQ" <<'PY' > "$name.chrom.sizes.part"
import gzip
import sys

src, floor = sys.argv[1], int(sys.argv[2])
with gzip.open(src, "rt") as fh:
    for line in fh:
        if line.startswith("##sequence-region"):
            fields = line.split()
            if int(fields[3]) >= floor:
                print(f"{fields[1]}\t{fields[3]}")
        elif not line.startswith("#"):
            break
PY
    mv "$name.chrom.sizes.part" "$name.chrom.sizes"
  fi

  # One BED row per gene, named by the bare Ensembl gene id. Compara keys on
  # gene stable ids, and Ensembl namespaces the same id in its GFF3 as
  # `ID=gene:...`, so the prefix comes off here or nothing resolves.
  if [ ! -f "$name.bed" ]; then
    gunzip -c "$name.gff3.gz" \
      | awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=gene:[^;]+/) {
          print $1, $4 - 1, $5, substr($9, RSTART + 8, RLENGTH - 8), 0, $7
        }' > "$name.bed.part"
    mv "$name.bed.part" "$name.bed"
  fi
done

# ── Compara homologies -> one ortholog table per band ────────────────────────
HOMOLOGIES=Compara.$COMPARA_REL.protein_default.homologies.tsv.gz
fetch "$HOMOLOGIES" \
  "$BASE/tsv/ensembl-compara/homologies/sorghum_bicolor/$HOMOLOGIES"

if [ ! -f sorghum.wheat.blocks ]; then
  python3 "$SCRIPT_DIR/compara_to_blocks.py" "$HOMOLOGIES" \
    --reference sorghum_bicolor=sorghum \
    --species triticum_aestivum=wheat \
    --species aegilops_tauschii=tauschii \
    --bed sorghum=sorghum.bed --bed wheat=wheat.bed \
    --bed tauschii=tauschii.bed --outdir part
  mv part/sorghum.wheat.blocks part/sorghum.tauschii.blocks .
  rmdir part
fi

gzip -kf sorghum.wheat.blocks sorghum.tauschii.blocks
for name in $NAMES; do gzip -kf "$name.bed"; done

# ── Orthologs per gene, per band ─────────────────────────────────────────────
# The number the view is about, printed rather than asserted: bread wheat should
# peak at three and the diploid control at one.
python3 - sorghum.wheat.blocks sorghum.tauschii.blocks <<'PY'
import collections
import sys

for table in sys.argv[1:]:
    per_gene = {}
    for line in open(table):
        fields = line.rstrip("\n").split("\t")
        per_gene[fields[0]] = int(fields[-1])
    hist = collections.Counter(min(n, 4) for n in per_gene.values())
    total = sum(hist.values())
    print(f"\n{table}: {total} reference genes")
    for copies in sorted(hist):
        label = "4 or more" if copies == 4 else str(copies)
        print(f"  {label} ortholog(s): {hist[copies]} "
              f"({hist[copies] * 100 / total:.0f}%)")
PY

# ── Set up JBrowse ───────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"

cp sorghum.wheat.blocks.gz sorghum.tauschii.blocks.gz "$APP"/
for name in $NAMES; do cp "$name.bed.gz" "$APP"/; done

for name in $NAMES; do
  jb add-assembly "$name.chrom.sizes" --name "$name" --load copy --force --out "$APP"
done

# ── One track per band ───────────────────────────────────────────────────────
# A band is one pair and a measurement column describes one row, so each band
# gets its own pairwise table. `copies` is the count the converter derived; the
# rest are Compara's own.
cat > tauschii_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "sorghum_tauschii",
  "name": "Sorghum / Aegilops tauschii orthologs",
  "assemblyNames": ["tauschii", "sorghum"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "sorghum.tauschii.blocks.gz",
    "blockAssemblies": ["sorghum", "tauschii"],
    "bedLocations": [{ "uri": "sorghum.bed.gz" }, { "uri": "tauschii.bed.gz" }],
    "assemblyNames": ["tauschii", "sorghum"],
    "attributeColumns": [
      "identity",
      "homology_identity",
      "dn",
      "ds",
      "goc_score",
      "wga_coverage",
      "copies"
    ]
  }
}
JSON
cat > wheat_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "sorghum_wheat",
  "name": "Sorghum / bread wheat orthologs",
  "assemblyNames": ["sorghum", "wheat"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "sorghum.wheat.blocks.gz",
    "blockAssemblies": ["sorghum", "wheat"],
    "bedLocations": [{ "uri": "sorghum.bed.gz" }, { "uri": "wheat.bed.gz" }],
    "assemblyNames": ["sorghum", "wheat"],
    "attributeColumns": [
      "identity",
      "homology_identity",
      "dn",
      "ds",
      "goc_score",
      "wga_coverage",
      "copies"
    ]
  }
}
JSON
jb add-track-json tauschii_track.json --update --out "$APP"
jb add-track-json wheat_track.json --update --out "$APP"

# ── The stack ────────────────────────────────────────────────────────────────
# tauschii - sorghum - wheat. The lower band fans each sorghum gene into three
# wheat homoeologs; the upper one is the same pipeline against a diploid and has
# to stay at one.
cat > session.json <<'JSON'
{
  "name": "Bread wheat homoeologs against a diploid grass",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Aegilops tauschii - sorghum - bread wheat",
      "showColorLegend": true,
      "views": [
        { "assembly": "tauschii" },
        { "assembly": "sorghum" },
        { "assembly": "wheat" }
      ],
      "tracks": [["sorghum_tauschii"], ["sorghum_wheat"]],
      "colorBy": "attribute:copies",
      "autoDiagonalize": true
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json: three assemblies, an ortholog track per band, and"
echo "a session stacking Aegilops tauschii - sorghum - bread wheat."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
