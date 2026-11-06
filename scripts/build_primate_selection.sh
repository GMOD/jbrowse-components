#!/usr/bin/env bash
#
# Build the primate selection-pressure view: human against rhesus macaque, every
# ortholog pair colored by dN/dS.
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
# color is the only thing that varies, and LYZ comes out above 1 while YEATS4
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
#           (bgzip/tabix), the NCBI datasets CLI, curl, awk, gzip, and node
#           (JBrowse CLI, via npx unless `jbrowse` is on PATH). Downloads
#           ~170 MB; the reshape holds a whole RefSeq annotation, ~3 GB of
#           memory.
# Usage:    bash scripts/build_primate_selection.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for tool in curl datasets python python3 diamond awk gzip bgzip tabix node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

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

if [ -n "${JBROWSE_CLI:-}" ]; then
  jb() { $JBROWSE_CLI "$@"; }
elif [[ "$(jbrowse --version 2>/dev/null)" == *"version "[5-9].* ]]; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli@next "$@"; }
fi

APP=jbrowse2
CPUS=$(getconf _NPROCESSORS_ONLN)

# name, RefSeq accession: GRCh38.p14 and the T2T macaque, each with a current
# RefSeq annotation
SPECIES=$(cat <<'EOF'
human GCF_000001405.40
rhesus GCF_049350105.2
EOF
)

# ── Per species: one NCBI download, reshaped into four files ─────────────────
# GFF3, CDS and sequence report come from one `datasets` call, so the assembly
# and the annotation are one build. The reshape writes, per species:
#
#   NAME.chrom.sizes   the assembled chromosomes, under the report's chrName
#   NAME.bed           one row per protein-coding gene: its longest-CDS mRNA
#   NAME.cds.fa        that mRNA's coding sequence
#   NAME.genes.gff3    the gene, that mRNA and its exons and CDS, for the track
#
# Every row is keyed on the mRNA's RefSeq accession (NM_/XM_), which is unique
# across species, so the two CDS files concatenate into one with no collision.
# NCBI's CDS FASTA is keyed on the PROTEIN accession instead; the GFF3's CDS rows
# carry both, and that is the join. Only assembled chromosomes are kept, since
# an ortholog on a patch or an alt haplotype places nowhere useful.
echo "$SPECIES" | while read -r name acc; do
  if [ ! -f "$name.ncbi.zip" ]; then
    datasets download genome accession "$acc" --include gff3,cds,seq-report \
      --filename "$name.ncbi.zip.part" --no-progressbar
    mv "$name.ncbi.zip.part" "$name.ncbi.zip"
  fi

  [ -f "$name.genes.gff3" ] || python3 - "$name.ncbi.zip" "$acc" "$name" <<'PY'
import json
import os
import re
import sys
import zipfile

src, acc, name = sys.argv[1:]
data = f"ncbi_dataset/data/{acc}"
chromosome = re.compile(r"^([0-9]+|X|Y)$")


def attrs(col9):
    return dict(kv.split("=", 1) for kv in col9.split(";") if "=" in kv)


with zipfile.ZipFile(src) as z:
    with z.open(f"{data}/sequence_report.jsonl") as raw:
        report = [json.loads(b) for b in raw if b.strip()]
    report = [
        r for r in report
        if r.get("role") == "assembled-molecule"
        and chromosome.match(r.get("chrName", ""))
    ]
    report.sort(key=lambda r: r["sortOrder"])
    rename = {r["refseqAccession"]: r["chrName"] for r in report}

    # keyed on (sequence, protein): a pseudoautosomal gene is annotated on X
    # and on Y under one protein accession
    cds = {}
    with z.open(f"{data}/cds_from_genomic.fna") as raw:
        key = None
        for line in (b.decode() for b in raw):
            if line.startswith(">"):
                protein = re.search(r"\[protein_id=([^\]]+)\]", line)
                seqid = line[5:].split("_cds_")[0]
                key = (seqid, protein.group(1)) if protein else None
                if key:
                    cds[key] = []
            elif key:
                cds[key].append(line.strip())

    genes, mrnas, children, coding = {}, {}, {}, {}
    with z.open(f"{data}/genomic.gff") as raw:
        for line in (b.decode() for b in raw):
            f = line.rstrip("\n").split("\t")
            if len(f) == 9 and f[0] in rename:
                a = attrs(f[8])
                if f[2] == "gene" and a.get("gene_biotype") == "protein_coding":
                    genes[a["ID"]] = f
                elif f[2] == "mRNA":
                    mrnas[a["ID"]] = (f, a)
                elif f[2] in ("exon", "CDS") and "Parent" in a:
                    children.setdefault(a["Parent"], []).append(f)
                    if f[2] == "CDS" and "protein_id" in a:
                        coding[a["Parent"]] = (f[0], a["protein_id"])

longest = {}
for mrna_id, (f, a) in mrnas.items():
    gene = a.get("Parent")
    seq = "".join(cds.get(coding.get(mrna_id), []))
    if gene in genes and len(seq) > len(longest.get(gene, ("", ""))[1]):
        longest[gene] = (mrna_id, seq)

with open(f"{name}.chrom.sizes.part", "w") as out:
    for r in report:
        out.write(f"{r['chrName']}\t{r['length']}\n")

rows = []
# a pseudoautosomal gene's Y copy repeats its X copy's transcript accession, and
# the BED and the CDS need each name once; X comes first in report order
written = set()
with open(f"{name}.bed.part", "w") as bed, open(f"{name}.cds.fa.part", "w") as fa:
    for gene, (mrna_id, seq) in longest.items():
        f, a = mrnas[mrna_id]
        tx = a["transcript_id"]
        if tx in written:
            continue
        written.add(tx)
        chrom = rename[f[0]]
        bed.write(f"{chrom}\t{int(f[3]) - 1}\t{f[4]}\t{tx}\t0\t{f[6]}\n")
        fa.write(f">{tx} gene_symbol:{a.get('gene', tx)}\n{seq}\n")
        for row in [genes[gene], f, *children[mrna_id]]:
            rows.append((chrom, int(row[3]), [chrom, *row[1:]]))
rows.sort(key=lambda r: (r[0], r[1]))
with open(f"{name}.genes.gff3.part", "w") as out:
    out.write("##gff-version 3\n")
    for _, _, row in rows:
        out.write("\t".join(row) + "\n")

for part in ("chrom.sizes", "bed", "cds.fa", "genes.gff3"):
    os.rename(f"{name}.{part}.part", f"{name}.{part}")
print(f"{name} ({acc}): {len(written)} of {len(genes)} protein-coding genes "
      f"kept, on {len(report)} chromosomes", file=sys.stderr)
PY

  # The proteome is translated from the same CDS, so it shares every id with
  # the BED and with the rates step.
  if [ ! -f "$name.pep" ]; then
    python3 - "$name.cds.fa" <<'PY' > "$name.pep.part"
import sys

from Bio.Seq import Seq

name = None
seq = []


def flush():
    if not name:
        return
    cds = "".join(seq)
    if len(cds) < 6 or len(cds) % 3:
        return
    protein = str(Seq(cds).translate()).rstrip("*")
    # an internal stop means the model and the reading frame disagree, and a
    # protein with one aligns to nothing useful
    if protein and "*" not in protein:
        print(f">{name}\n{protein}")


for line in open(sys.argv[1]):
    if line.startswith(">"):
        flush()
        name = line[1:].split()[0]
        seq = []
    else:
        seq.append(line.strip())
flush()
PY
    mv "$name.pep.part" "$name.pep"
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
# a figure whose color IS divergence.
if [ ! -f pairs.tsv ]; then
  awk '!/^#/ && NF >= 2 {print $1 "\t" $2}' human.rhesus.anchors > pairs.tsv.part
  mv pairs.tsv.part pairs.tsv
fi

# ── dN and dS per pair ───────────────────────────────────────────────────────
# One CDS file for both species: the pairs cross them, and RefSeq accessions do
# not collide between genomes.
[ -f both.cds.fa ] || cat human.cds.fa rhesus.cds.fa > both.cds.fa
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
# ones: FDCSP came out at 4.18 and COX20 at 2.76, each off a SINGLE synonymous
# difference, and 20 of the top 50 have fewer than three. Every credible pair
# here clears three - YEATS4 has 3, LYZ 3.5, ACTB 27 - so the floor separates
# them, and unlike a floor on dS it does not punish a short gene for being
# short.
if [ ! -f primate.blocks ]; then
  python3 "$SCRIPT_DIR/kaks_from_pairs.py" pairs.tsv both.cds.fa \
    --key record --min-syn-subs 3 --max-ds 0.3 -o primate.blocks.part
  mv primate.blocks.part primate.blocks
fi

gzip -kf primate.blocks human.bed rhesus.bed

# ── Gene tracks, so a ribbon's color has a gene name beside it ──────────────
# Cut to the same mRNAs as the BED, which keeps a 1.6 GB annotation down to a
# few MB and makes the track name exactly what the ribbons connect.
for sp in human rhesus; do
  if [ ! -f "$sp.genes.gff3.gz.csi" ]; then
    bgzip -kf "$sp.genes.gff3"
    tabix -f -C -p gff "$sp.genes.gff3.gz"
  fi
done

# ── What the table says, printed rather than asserted ────────────────────────
python3 - human.bed primate.blocks human.cds.fa <<'PY'
import statistics
import sys

symbol = {}
for line in open(sys.argv[3]):
    if line.startswith(">"):
        f = line[1:].split()
        symbol[f[0]] = f[1].removeprefix("gene_symbol:")

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
[ -f "$APP/index.html" ] || jb create "$APP" --branch main
cp primate.blocks.gz human.bed.gz rhesus.bed.gz "$APP"/
cp human.genes.gff3.gz human.genes.gff3.gz.csi "$APP"/
cp rhesus.genes.gff3.gz rhesus.genes.gff3.gz.csi "$APP"/
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
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
JSON
cat > human_genes.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "human_genes",
  "name": "Human genes (GRCh38.p14, NCBI RefSeq)",
  "assemblyNames": ["human"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "human.genes.gff3.gz",
    "csi": true
  }
}
JSON
cat > rhesus_genes.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "rhesus_genes",
  "name": "Rhesus macaque genes (T2T-MMU8v2.0, NCBI RefSeq)",
  "assemblyNames": ["rhesus"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "rhesus.genes.gff3.gz",
    "csi": true
  }
}
JSON
jb add-track-json human_genes.json --update --out "$APP"
jb add-track-json rhesus_genes.json --update --out "$APP"
jb add-track-json tracks.json --update --out "$APP"

# `opacity` defaults to 0.25, which is tuned for whole-genome views where thousands
# of ribbons overlap; a dozen of them at that opacity is nearly invisible.
cat > session.json <<'JSON'
{
  "name": "Selection pressure across a primate gene neighbourhood",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Human vs rhesus macaque orthologs, colored by dN/dS",
      "views": [
        {
          "assembly": "human",
          "loc": "12:68,790,000-69,880,000",
          "tracks": ["human_genes"]
        },
        {
          "assembly": "rhesus",
          "loc": "11:75,927,000-77,010,000",
          "tracks": ["rhesus_genes"]
        }
      ],
      "tracks": [["primate_orthologs"]],
      "encoding": { "color": "dnds", "opacity": 0.95 },
      "mark": { "interpolate": "bump" }
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
