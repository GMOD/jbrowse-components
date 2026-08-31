#!/usr/bin/env bash
#
# Build the primate selection-pressure view: human against rhesus macaque, every
# ortholog pair coloured by dN/dS.
#
# dN/dS is a property of a PAIR of genes rather than of a position on one
# genome, which is why it belongs on a synteny link. Below 1 amino acid changes
# were removed faster than silent ones, which is purifying selection and is
# where most genes sit; above 1 they fixed faster, which takes positive
# selection to explain.
#
# Rhesus macaque rather than chimpanzee: dS has to be large enough to estimate
# and small enough not to saturate, and human against chimpanzee is too close,
# leaving a denominator near zero on most genes.
#
# The session opens the lysozyme neighbourhood on human chromosome 12. That
# locus is collinear between the two species, so the ribbons run parallel and
# colour is the only thing that varies, and LYZ comes out above 1 while YEATS4
# eleven kilobases away comes out at the bottom of the ramp. Adaptive evolution
# of primate lysozyme is one of the older results in molecular evolution.
#
# The control is that pair of neighbours: same locus, same divergence time, and
# opposite ends of the ramp. Anything that moved both together, an alignment
# artefact or a mis-set divergence, would not produce that.
#
# Requires: jcvi (it builds C extensions and does not install against every
#           python; `uv venv --python 3.12 && uv pip install jcvi biopython`
#           gets one it does), diamond, python3 with biopython, htslib
#           (bgzip/tabix), wget, and node (JBrowse CLI, via npx unless
#           `jbrowse` is on PATH). Downloads ~180 MB.
# Usage:    bash scripts/build_primate_selection.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(kaks_from_pairs.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-primate_selection_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Every file lands under a .part name and is renamed only once its producer
# returns clean, which is what makes the `[ -f ]` guards sound: an interrupted
# run leaves nothing that looks finished.
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
REL=116
BASE=https://ftp.ensembl.org/pub/release-$REL
CPUS=$(getconf _NPROCESSORS_ONLN)

fetch human.gff3.gz "$BASE/gff3/homo_sapiens/Homo_sapiens.GRCh38.$REL.gff3.gz"
fetch human.cds.fa.gz \
  "$BASE/fasta/homo_sapiens/cds/Homo_sapiens.GRCh38.cds.all.fa.gz"
fetch rhesus.gff3.gz \
  "$BASE/gff3/macaca_mulatta/Macaca_mulatta.Mmul_10.$REL.gff3.gz"
fetch rhesus.cds.fa.gz \
  "$BASE/fasta/macaca_mulatta/cds/Macaca_mulatta.Mmul_10.cds.all.fa.gz"

# ── Per species: chrom.sizes, a BED, and a proteome keyed the same way ───────
for sp in human rhesus; do
  # chrom.sizes from the GFF3's own header, so no genome FASTA is needed. Read
  # in python rather than piped through awk: stopping at the first feature line
  # closes the pipe on gunzip, and under `set -o pipefail` that SIGPIPE fails
  # the script. Only the assembled chromosomes are kept, since an ortholog on a
  # patch or an alt haplotype places nowhere useful.
  if [ ! -f "$sp.chrom.sizes" ]; then
    python3 - "$sp.gff3.gz" <<'PY' > "$sp.chrom.sizes.part"
import gzip
import re
import sys

chromosome = re.compile(r"^([0-9]+|X|Y)$")
with gzip.open(sys.argv[1], "rt") as fh:
    for line in fh:
        if line.startswith("##sequence-region"):
            f = line.split()
            if chromosome.match(f[1]):
                print(f"{f[1]}\t{f[3]}")
        elif not line.startswith("#"):
            break
PY
    mv "$sp.chrom.sizes.part" "$sp.chrom.sizes"
  fi

  if [ ! -f "$sp.bed" ]; then
    python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
      --primary_only "$sp.gff3.gz" -o "$sp.all.bed"
    awk -F'\t' '$1 ~ /^([0-9]+|X|Y)$/' "$sp.all.bed" > "$sp.bed.part"
    mv "$sp.bed.part" "$sp.bed"
  fi

  # The proteome is translated from the CDS rather than downloaded, and it is
  # cut to the transcripts the BED names. Two reasons, both of which cost a run
  # to learn: Ensembl's protein FASTA is keyed on PROTEIN ids where every other
  # id here is a transcript id, and the CDS FASTA carries every isoform, which
  # is an order of magnitude more sequence than the primary set jcvi chains.
  #
  # The version suffix comes off. Ensembl VERSIONS transcript ids in its FASTA
  # (`ENST00000641515.7`) and not in its GFF3, so without this the proteome and
  # the BED share no id at all and the run ends with zero anchors.
  if [ ! -f "$sp.pep" ]; then
    python3 - "$sp.cds.fa.gz" "$sp.bed" <<'PY' > "$sp.pep.part"
import gzip
import sys

from Bio.Seq import Seq

keep = {line.split("\t")[3] for line in open(sys.argv[2])}
name = None
seq = []


def flush():
    if not name or name not in keep:
        return
    cds = "".join(seq)
    if len(cds) < 6 or len(cds) % 3:
        return
    protein = str(Seq(cds).translate()).rstrip("*")
    # an internal stop means the model and the reading frame disagree, and a
    # protein with one aligns to nothing useful
    if protein and "*" not in protein:
        print(f">{name}\n{protein}")


with gzip.open(sys.argv[1], "rt") as fh:
    for line in fh:
        if line.startswith(">"):
            flush()
            name = line[1:].split()[0].rsplit(".", 1)[0]
            seq = []
        else:
            seq.append(line.strip())
flush()
PY
    mv "$sp.pep.part" "$sp.pep"
  fi
done

# ── Orthologs ────────────────────────────────────────────────────────────────
# The alignment is run here rather than left to jcvi, which would call diamond
# `--ultra-sensitive --max-target-seqs 1000`. Those settings are for orthologs
# across a hundred million years; these two share an ancestor around 25 million
# years back and default sensitivity finds every pair.
#
# QUERY IS THE FIRST SPECIES AND SUBJECT THE SECOND, which is the order jcvi
# would have used had it run the aligner itself. Reversed, every id is looked up
# in the wrong BED and the run ends with `A total of 0 anchor was found`.
if [ ! -f human.rhesus.last ]; then
  diamond makedb --in rhesus.pep -d rhesus.pep --quiet
  diamond blastp --threads "$CPUS" --query human.pep --db rhesus.pep \
    --out human.rhesus.last.part --max-target-seqs 20 --evalue 1e-10 \
    --outfmt 6 --quiet
  mv human.rhesus.last.part human.rhesus.last
fi
if [ ! -f human.rhesus.anchors ]; then
  python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
    --align_soft diamond_blastp --no_dotplot --cpus "$CPUS" human rhesus
fi

# `human.rhesus.anchors` and not the `.lifted.anchors` written beside it.
# Liftover recruits extra pairs near an established block rather than by
# chaining, and the pairs it adds have a median dS several times that of the
# chained ones: they are paralogs, not orthologs. Invisible in a count, fatal in
# a figure whose colour IS divergence.
if [ ! -f pairs.tsv ]; then
  awk '!/^#/ && NF >= 2 {print $1 "\t" $2}' human.rhesus.anchors > pairs.tsv.part
  mv pairs.tsv.part pairs.tsv
fi

# ── dN and dS per pair ───────────────────────────────────────────────────────
# One CDS file for both species: the pairs cross them, and the id namespaces
# (ENST..., ENSMMUT...) do not collide.
[ -f both.cds.fa.gz ] || cat human.cds.fa.gz rhesus.cds.fa.gz > both.cds.fa.gz
#
# Both ends of the dS range are cut, and a run prints the quartiles these were
# picked from.
#
# `--max-ds 0.3` is an orthology check here rather than a saturation one. Two
# species diverged once, so their orthologs share a divergence time and their dS
# clusters; a pair well above that cluster is a paralog the aligner preferred.
#
# `--min-syn-subs 3` is the guard that matters for a figure, and it counts
# substitutions rather than thresholding a rate. Sorting an unfiltered table by
# dN/dS returns the pairs with nothing to divide by rather than the selected
# ones: HBA1, about as strongly conserved as a gene gets, came out at 2.29 off a
# SINGLE synonymous difference, as did CAST at 3.27 and COX20 at 2.76. Every
# credible pair here clears three - YEATS4 has 3, LYZ 4, ACTB 30 - so the floor
# separates them, and unlike a floor on dS it does not punish a short gene for
# being short.
if [ ! -f primate.blocks ]; then
  python3 "$SCRIPT_DIR/kaks_from_pairs.py" pairs.tsv both.cds.fa.gz \
    --key record --strip-version --min-syn-subs 3 --max-ds 0.3 \
    -o primate.blocks.part
  mv primate.blocks.part primate.blocks
fi

gzip -kf primate.blocks human.bed rhesus.bed

# ── Gene tracks, so a ribbon's colour has a gene name beside it ──────────────
# Cut to the same primary transcripts as the BED, which is what keeps a 100 MB
# annotation down to a few MB and makes the track name exactly what the ribbons
# connect.
for sp in human rhesus; do
  if [ ! -f "$sp.genes.gff3.gz.tbi" ]; then
    python3 - "$sp.gff3.gz" "$sp.bed" <<'PY' > "$sp.genes.gff3.part"
import gzip
import sys

keep = {line.split("\t")[3] for line in open(sys.argv[2])}
chromosomes = {str(i) for i in range(1, 40)} | {"X", "Y"}
rows = []
with gzip.open(sys.argv[1], "rt") as fh:
    for line in fh:
        if line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) < 9 or f[0] not in chromosomes:
            continue
        if f[2] == "gene":
            rows.append((f[0], int(f[3]), line))
        elif f[2] == "mRNA":
            tid = [a for a in f[8].split(";") if a.startswith("transcript_id=")]
            if tid and tid[0][14:].strip() in keep:
                rows.append((f[0], int(f[3]), line))
        elif f[2] in ("exon", "CDS"):
            par = [a for a in f[8].split(";")
                   if a.startswith("Parent=transcript:")]
            if par and par[0][18:].strip() in keep:
                rows.append((f[0], int(f[3]), line))
rows.sort(key=lambda r: (r[0], r[1]))
for _, _, line in rows:
    sys.stdout.write(line)
PY
    mv "$sp.genes.gff3.part" "$sp.genes.gff3"
    bgzip -f "$sp.genes.gff3"
    tabix -f -p gff "$sp.genes.gff3.gz"
  fi
done

# ── What the table says, printed rather than asserted ────────────────────────
python3 - human.bed primate.blocks human.cds.fa.gz <<'PY'
import gzip
import statistics
import sys

symbol = {}
with gzip.open(sys.argv[3], "rt") as fh:
    for line in fh:
        if not line.startswith(">"):
            continue
        f = line.split()
        tag = [x for x in f if x.startswith("gene_symbol:")]
        if tag:
            symbol[f[0][1:].rsplit(".", 1)[0]] = tag[0][12:]

placed = {}
with open(sys.argv[1]) as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        placed[f[3]] = (f[0], int(f[1]))

ratios = []
locus = []
with open(sys.argv[2]) as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        dn, ds = float(f[2]), float(f[3])
        ratios.append(dn / ds)
        chrom, start = placed.get(f[0], ("", 0))
        if chrom == "12" and 68_790_000 <= start <= 69_880_000:
            locus.append((start, symbol.get(f[0], f[0]), dn / ds, ds))

ratios.sort()
above = sum(1 for r in ratios if r > 1)
print(f"\n{len(ratios)} ortholog pairs, dN and dS measured on each")
print(f"  dN/dS median {statistics.median(ratios):.3f}, "
      f"quartiles {ratios[len(ratios) // 4]:.3f} and "
      f"{ratios[3 * len(ratios) // 4]:.3f}")
print(f"  {above} pairs ({above * 100 / len(ratios):.2f}%) above 1, which is "
      f"the ramp's pivot")
print("\nthe locus the session opens, human chromosome 12:")
print("     position     gene           dN/dS       dS")
for start, gene, ratio, ds in sorted(locus):
    print(f"  {start:>11,}   {gene:14s} {ratio:6.3f}   {ds:.4f}")
PY

# ── Set up JBrowse ───────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
cp primate.blocks.gz human.bed.gz rhesus.bed.gz "$APP"/
cp human.genes.gff3.gz human.genes.gff3.gz.tbi "$APP"/
cp rhesus.genes.gff3.gz rhesus.genes.gff3.gz.tbi "$APP"/
jb add-assembly human.chrom.sizes --name human --load copy --force --out "$APP"
jb add-assembly rhesus.chrom.sizes --name rhesus --load copy --force --out "$APP"

cat > tracks.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "primate_orthologs",
  "name": "Human / rhesus orthologs (dN/dS)",
  "assemblyNames": ["human", "rhesus"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "primate.blocks.gz",
    "blockAssemblies": ["human", "rhesus"],
    "bedLocations": [{ "uri": "human.bed.gz" }, { "uri": "rhesus.bed.gz" }],
    "assemblyNames": ["human", "rhesus"],
    "attributeColumns": ["dn", "ds"]
  }
}
JSON
cat > human_genes.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "human_genes",
  "name": "Human genes (GRCh38, Ensembl 116)",
  "assemblyNames": ["human"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "human.genes.gff3.gz" }
}
JSON
cat > rhesus_genes.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "rhesus_genes",
  "name": "Rhesus macaque genes (Mmul_10, Ensembl 116)",
  "assemblyNames": ["rhesus"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "rhesus.genes.gff3.gz" }
}
JSON
jb add-track-json human_genes.json --update --out "$APP"
jb add-track-json rhesus_genes.json --update --out "$APP"
jb add-track-json tracks.json --update --out "$APP"

# `alpha` defaults to 0.2, which is tuned for whole-genome views where thousands
# of ribbons overlap; a dozen of them at that opacity is nearly invisible.
cat > session.json <<'JSON'
{
  "name": "Selection pressure across a primate gene neighbourhood",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Human vs rhesus macaque orthologs, coloured by dN/dS",
      "showColorLegend": true,
      "views": [
        {
          "assembly": "human",
          "loc": "12:68,790,000-69,880,000",
          "tracks": ["human_genes"]
        },
        {
          "assembly": "rhesus",
          "loc": "11:68,330,000-69,390,000",
          "tracks": ["rhesus_genes"]
        }
      ],
      "tracks": [["primate_orthologs"]],
      "colorBy": "dnds",
      "alpha": 0.95,
      "drawCurves": true
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json: both assemblies, both gene tracks, the ortholog"
echo "track and a session on the lysozyme neighbourhood."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
