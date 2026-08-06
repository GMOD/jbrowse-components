#!/usr/bin/env bash
#
# Build the human/mouse ortholog track shown in the "From Ensembl Compara"
# section of website/docs/tutorials/multiway_synteny.md, then wire up a runnable
# JBrowse.
#
# Compara publishes, per species, every homology it inferred against every other
# species, already curated. So unlike the OrthoFinder and jcvi pipelines this
# needs no protein search at all: the ortholog table is a download. What it adds
# over those is that each row carries what the inference MEASURED — percent
# identity either way, dN, dS, a gene-order-conservation score — which is what
# makes `Color by -> dN/dS` say anything.
#
# dN/dS is the ratio of non-synonymous to synonymous substitution rate. Below 1 a
# gene is under purifying selection (most genes, most of the time); above 1 it is
# under positive selection. An aligner has no view on this, which is the point:
# it is a property of the orthology, not of the sequence alignment.
#
# No genome FASTA is downloaded: each assembly is a ChromSizesAdapter built from
# the `##sequence-region` header of that species' GFF3, which is all a gene-level
# synteny view needs.
#
# This is the cheapest of the ortholog tutorials to run: python3, wget and node,
# with no aligner, no OrthoFinder and no jcvi, because the orthology is already
# inferred. What it costs instead is one 623 MB download, which every step below
# is guarded on, so an interrupted run resumes rather than starting over.
#
# Requires: python3, wget, and node (JBrowse CLI, via npx unless `jbrowse` is on
#           PATH). Downloads ~750 MB and writes ~1 GB.
# Usage:    bash scripts/build_compara_dnds.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(compara_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-compara_dnds_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Every file this script writes lands under a .part name and is renamed only once
# its producer returns clean, which is what makes the `[ -f ]` guards sound: an
# interrupted run leaves nothing that looks finished.
#
# Guarding on the final name alone does not survive a run being killed, and both
# halves of that bit within a minute of each other while this was being written.
# A partial download is accepted on the re-run and surfaces much later as `gzip:
# unexpected end of file`; worse, a `>` redirect CREATES its output before the
# producer has written a byte, so a step that dies leaves a zero-length file the
# next run treats as done and everything downstream reads as empty. On a script
# whose whole point is that a reader can run it, neither is acceptable.
#
# `-c` resumes a .part download rather than restarting it, which on the 623 MB
# homology file is the difference between a retry being free and costing the
# whole download again.
fetch() {
  local dest=$1 url=$2
  if [ ! -f "$dest" ]; then
    wget -c -O "$dest.part" "$url"
    mv "$dest.part" "$dest"
  fi
}

APP=jbrowse2
REL=113
BASE=https://ftp.ensembl.org/pub/release-$REL
# Sequence regions to keep, by length. Ensembl lists every scaffold and patch in
# the GFF3 header; both assemblies' real chromosomes clear this and nothing else
# comes close, so it selects them without naming any.
MINSEQ=10000000

# Heredoc columns: short name (= the JBrowse assembly name), Compara species key
# (= the Ensembl directory name), Ensembl file prefix, assembly version.
SPECIES=$(cat <<'EOF'
human homo_sapiens Homo_sapiens GRCh38
mouse mus_musculus Mus_musculus GRCm39
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
  # drawn in wherever nothing overrides it.
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
  # `ID=gene:ENSG...`, so the prefix comes off here or nothing resolves.
  if [ ! -f "$name.bed" ]; then
    gunzip -c "$name.gff3.gz" \
      | awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=gene:[^;]+/) {
          print $1, $4 - 1, $5, substr($9, RSTART + 8, RLENGTH - 8), 0, $7
        }' > "$name.bed.part"
    mv "$name.bed.part" "$name.bed"
  fi
done

# ── Compara homologies -> a pairwise ortholog table with its measurements ────
# The 623 MB file is human against every species Compara covers; the converter
# keeps the mouse rows.
#
# One table per pair, not one table for N genomes: an attribute column describes
# the ROW, and a row is one link only in a two-column table.
HOMOLOGIES=Compara.$REL.protein_default.homologies.tsv
fetch "$HOMOLOGIES" \
  "$BASE/tsv/ensembl-compara/homologies/homo_sapiens/$HOMOLOGIES"

if [ ! -f human.mouse.blocks ]; then
  python3 "$SCRIPT_DIR/compara_to_blocks.py" "$HOMOLOGIES" \
    --reference homo_sapiens=human --species mus_musculus=mouse \
    --bed human=human.bed --bed mouse=mouse.bed --outdir part
  mv part/human.mouse.blocks human.mouse.blocks
  rmdir part
fi

gzip -kf human.mouse.blocks
for name in $NAMES; do gzip -kf "$name.bed"; done

# ── What the table says about selection ──────────────────────────────────────
# Printed rather than asserted in prose: the tutorial's figure caption has to be
# a number this run produced. Reports how the dN/dS distribution falls either
# side of 1, and which chromosome carries the most genes above it.
python3 - human.mouse.blocks human.bed <<'PY'
import collections
import sys

table, bed = sys.argv[1], sys.argv[2]
chrom = {}
for line in open(bed):
    f = line.rstrip("\n").split("\t")
    chrom[f[3]] = f[0]

total = above = 0
by_chrom = collections.Counter()
for line in open(table):
    f = line.rstrip("\n").split("\t")
    # columns after the two gene columns: identity, homology_identity, dn, ds, ...
    dn, ds = f[4], f[5]
    if dn == "." or ds == "." or float(ds) <= 0:
        continue
    total += 1
    if float(dn) / float(ds) > 1:
        above += 1
        by_chrom[chrom.get(f[0], "?")] += 1

print()
print(f"dN/dS resolved for {total} of the table's links")
print(f"  {above} ({above * 100 / total:.1f}%) are above 1, the rest below")
print("  most above 1, by human chromosome: "
      + ", ".join(f"{c} {n}" for c, n in by_chrom.most_common(5)))
PY

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ───────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

[ -f "$APP/index.html" ] || jb create "$APP"

# The table + BEDs must sit beside config.json (add-track-json won't copy them)
cp human.mouse.blocks.gz "$APP"/
for name in $NAMES; do cp "$name.bed.gz" "$APP"/; done

for name in $NAMES; do
  jb add-assembly "$name.chrom.sizes" --name "$name" --load copy --force --out "$APP"
done

# ── The ortholog track, carrying Compara's own measurements ──────────────────
# attributeColumns names the numeric columns after the two gene columns, in the
# order compara_to_blocks.py wrote them. Each becomes a feature attribute, so it
# shows in the detail panel; `dn` and `ds` are what Color by -> dN/dS divides,
# and the rest are offered under their own names.
cat > blocks_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "human_mouse_compara",
  "name": "Human / mouse orthologs (Ensembl Compara)",
  "assemblyNames": ["human", "mouse"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "human.mouse.blocks.gz",
    "blockAssemblies": ["human", "mouse"],
    "bedLocations": [{ "uri": "human.bed.gz" }, { "uri": "mouse.bed.gz" }],
    "assemblyNames": ["human", "mouse"],
    "attributeColumns": [
      "identity",
      "homology_identity",
      "dn",
      "ds",
      "goc_score",
      "wga_coverage"
    ]
  }
}
JSON
jb add-track-json blocks_track.json --update --out "$APP"

cat > session.json <<'JSON'
{
  "name": "Human / mouse orthologs colored by dN/dS",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Human - mouse (Ensembl Compara orthologs)",
      "showColorLegend": true,
      "init": {
        "views": [{ "assembly": "human" }, { "assembly": "mouse" }],
        "tracks": [["human_mouse_compara"]],
        "colorBy": "dnds",
        "autoDiagonalize": true
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the human and mouse assemblies, the Compara"
echo "ortholog track, and a session coloring its ribbons by dN/dS."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
