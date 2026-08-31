#!/usr/bin/env bash
#
# Build the oat homoeolog dotplot: hexaploid oat against itself, every link
# coloured by the selection pressure between the two copies.
#
# Oat (Avena sativa) is an allohexaploid carrying three subgenomes, A, C and D,
# so nearly every gene exists three times. The copies of one ancestral gene
# across those subgenomes are homoeologs, and a table of them draws the genome
# against itself: three segments per homoeologous group, one per pair of
# subgenomes.
#
# What separates oat from the same view of bread wheat is where those segments
# go. Wheat's subgenomes are almost perfectly collinear apart from the 4A
# translocations; oat's are not, and the script prints the matrix that says so -
# links between chromosomes of DIFFERENT homoeologous groups, which in wheat is
# a handful of chromosome pairs and in oat is dozens. That is the mosaic
# karyotype the assembly paper describes, recovered from the gene order.
#
# Nothing is taken from a homology database. Ensembl Compara curates homoeolog
# calls, but only for the assemblies it hosts, which for oat is one and not the
# newest; running jcvi here means the same figure can be built on whatever
# assembly is current. The assembly used is the most contiguous oat available:
# Williams v1.0 has a contig N50 of 200 Mb against chromosomes of ~500 Mb, where
# the Compara-covered Sang assembly is two orders of magnitude more fragmented.
# No oat assembly is telomere-to-telomere, and no annotated one is newer.
#
# dN/dS is computed too. Ensembl declares `dn` and `ds` in every homology export
# and fills neither, in any division, so `kaks_from_pairs.py` aligns each pair
# in codon space and runs Nei-Gojobori. Pairs are anchors, which are TRANSCRIPT
# ids, so each rate is measured on the exact pair the synteny was called on.
#
# The control is dS, printed per subgenome pair. Oat's A and D subgenomes come
# from closely related diploids and its C subgenome from a more distant one, so
# A-D pairs have to come out at a lower synonymous divergence than A-C or C-D.
# If all three land together, the numbers are measuring the pipeline rather than
# the polyploidy.
#
# No genome FASTA is downloaded: the assembly is a ChromSizesAdapter built from
# the `##sequence-region` header of the GFF3, which is all a gene-level view
# needs. Oat as sequence is over 11 GB; as names and lengths it is a few hundred
# bytes.
#
# Requires: jcvi (it builds C extensions and does not install against every
#           python; `uv venv --python 3.12 && uv pip install jcvi biopython`
#           gets one it does), diamond, python3 with biopython, wget, and node
#           (JBrowse CLI, via npx unless `jbrowse` is on PATH). Downloads
#           ~120 MB. Budget over an hour for the self-alignment: Ensembl's
#           annotation of this assembly calls ~189k transcripts, and a proteome
#           that size against itself is a long job even on every core.
# Usage:    bash scripts/build_oat_homoeologs.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(kaks_from_pairs.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-oat_homoeologs_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Every file lands under a .part name and is renamed only once its producer
# returns clean, which is what makes the `[ -f ]` guards sound: an interrupted
# run leaves nothing that looks finished. A `>` redirect CREATES its output
# before the producer has written a byte, so a step that dies otherwise leaves a
# zero-length file the next run treats as done.
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
SPECIES=avena_sativa_gca951802345v1cm
PREFIX=Avena_sativa_gca951802345v1cm.Asativa_cv_Williams_v1.0

fetch oat.gff3.gz "$BASE/gff3/$SPECIES/$PREFIX.$REL.gff3.gz"
fetch oat.cds.fa.gz "$BASE/fasta/$SPECIES/cds/$PREFIX.cds.all.fa.gz"

# ── chrom.sizes from the GFF3's own header, so no genome FASTA is needed ──────
# Read in python rather than piped through awk: stopping at the first feature
# line closes the pipe on gunzip, and under `set -o pipefail` that SIGPIPE fails
# the script. Only the 21 chromosomes are kept - the assembly carries ~2700
# unplaced contigs besides, and an anchor with one end on one of those places
# nowhere on the plot.
if [ ! -f oat.chrom.sizes ]; then
  python3 - oat.gff3.gz <<'PY' > oat.chrom.sizes.part
import gzip
import re
import sys

chromosome = re.compile(r"^[1-7][ACD]$")
with gzip.open(sys.argv[1], "rt") as fh:
    for line in fh:
        if line.startswith("##sequence-region"):
            fields = line.split()
            if chromosome.match(fields[1]):
                print(f"{fields[1]}\t{fields[3]}")
        elif not line.startswith("#"):
            break
PY
  mv oat.chrom.sizes.part oat.chrom.sizes
fi

# ── jcvi: GFF3 -> BED (one primary isoform per gene) + a matching proteome ────
# The BED names TRANSCRIPTS, and so do the anchors and the proteome, which is
# what lets the dN/dS step align the exact pair the synteny was called on
# instead of the longest isoform of each end.
if [ ! -f oat.bed ]; then
  python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
    --primary_only oat.gff3.gz -o oat.all.bed
  awk -F'\t' '$1 ~ /^[1-7][ACD]$/' oat.all.bed > oat.bed.part
  mv oat.bed.part oat.bed
fi

# The proteome is translated from the CDS rather than downloaded, which is not
# a shortcut: Ensembl's protein FASTA is keyed on PROTEIN ids, and every id in
# this pipeline - the BED, the anchors, the CDS the rates are measured on - is a
# transcript id. Translating keeps one namespace throughout.
if [ ! -f oat.pep ]; then
  python3 - oat.cds.fa.gz <<'PY' > oat.pep.part
import gzip
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


with gzip.open(sys.argv[1], "rt") as fh:
    for line in fh:
        if line.startswith(">"):
            flush()
            name = line[1:].split()[0]
            seq = []
        else:
            seq.append(line.strip())
flush()
PY
  mv oat.pep.part oat.pep
fi

# ── jcvi: the genome against itself ──────────────────────────────────────────
# One prefix twice is a self-comparison, which jcvi handles: it drops the
# gene-against-itself diagonal and then chains what is left into syntenic
# blocks. `--self_remove 100` is the part worth setting - it defaults to 98 and
# discards every hit at or above that identity, which is meant for finding
# ancient duplications and would throw away most of oat's A-D homoeologs, which
# are recent enough to sit above it. At 100 only a perfectly identical protein
# pair is dropped.
#
# Chaining is the reason to run an aligner pipeline rather than take reciprocal
# best hits: a gene family's best hit lands wherever the family's closest member
# is, and off-diagonal noise from that is indistinguishable from the
# translocated segments this figure is about. An anchor is only kept where its
# neighbours agree.
#
# The alignment is run here rather than left to jcvi, which would call diamond
# `--ultra-sensitive --max-target-seqs 1000`. Those settings are for finding
# orthologs across a hundred million years; homoeologs are over 90% identical,
# default sensitivity finds every one of them, and on a proteome this size the
# difference is hours against minutes. jcvi picks the file up by name and skips
# its own alignment step.
CPUS=$(getconf _NPROCESSORS_ONLN)
if [ ! -f oat.oat.last ]; then
  diamond makedb --in oat.pep -d oat.pep --quiet
  diamond blastp --threads "$CPUS" --query oat.pep --db oat.pep \
    --out oat.oat.last.part --max-target-seqs 20 --evalue 1e-10 --outfmt 6 \
    --quiet
  mv oat.oat.last.part oat.oat.last
fi
if [ ! -f oat.oat.anchors ]; then
  python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
    --align_soft diamond_blastp --self_remove 100 --no_dotplot \
    --cpus "$CPUS" oat oat
fi

# ── Anchors -> cross-subgenome pairs ─────────────────────────────────────────
# `oat.oat.anchors` and not the `.lifted.anchors` written beside it. Liftover
# recruits extra pairs near an established block rather than by chaining, and on
# this genome the pairs it adds are a different population: their median dS is
# several times that of the chained ones, which is the ancient grass duplication
# and gene families rather than the subgenomes. Mixing the two would be
# invisible in a count and fatal in a figure whose COLOUR is divergence.
#
# A self-comparison also chains each subgenome's own tandem and segmental
# duplicates, which are paralogs rather than homoeologs. A homoeolog pair is one
# whose two ends sit on different subgenomes, which the chromosome name says.
if [ ! -f oat.pairs.tsv ]; then
  python3 - oat.bed oat.oat.anchors <<'PY' > oat.pairs.tsv.part
import sys

chrom = {}
with open(sys.argv[1]) as fh:
    for line in fh:
        fields = line.split("\t")
        chrom[fields[3]] = fields[0]

kept = same = unplaced = 0
with open(sys.argv[2]) as fh:
    for line in fh:
        if line.startswith("#"):
            continue
        fields = line.rstrip("\n").split("\t")
        a, b = fields[0], fields[1]
        if a not in chrom or b not in chrom:
            unplaced += 1
        elif chrom[a][-1] == chrom[b][-1]:
            same += 1
        else:
            print(f"{a}\t{b}")
            kept += 1
print(f"{kept} cross-subgenome anchors kept, {same} within one subgenome "
      f"(paralogs, not homoeologs), {unplaced} off the 21 chromosomes",
      file=sys.stderr)
PY
  mv oat.pairs.tsv.part oat.pairs.tsv
fi

# ── dN and dS per pair ───────────────────────────────────────────────────────
#
# `--min-syn-subs 3` is the guard the ratio needs, and it counts substitutions
# rather than thresholding a rate. A pair under it has almost nothing to divide
# by, and a high ratio there is arithmetic rather than selection: unfiltered,
# the largest ratios in this table came off dS values near 0.002. Counting is
# the right unit because dS is per site, so the same rate means very different
# evidence in a short gene and a long one.
if [ ! -f oat.kaks.tsv ]; then
  python3 "$SCRIPT_DIR/kaks_from_pairs.py" oat.pairs.tsv oat.cds.fa.gz \
    --key record --min-syn-subs 3 -o oat.kaks.tsv.part
  mv oat.kaks.tsv.part oat.kaks.tsv
fi

# The pair table the adapter loads: the two transcript ids, then the two rates.
# A pair with no measurement is dropped rather than written, since it would
# otherwise draw with no colour, indistinguishable from one whose ratio happens
# to sit at the ramp's bottom.
if [ ! -f oat.homoeologs.blocks ]; then
  cp oat.kaks.tsv oat.homoeologs.blocks.part
  mv oat.homoeologs.blocks.part oat.homoeologs.blocks
fi

gzip -kf oat.homoeologs.blocks oat.bed

# ── What the table says, printed rather than asserted ────────────────────────
python3 - oat.bed oat.homoeologs.blocks <<'PY'
import collections
import statistics
import sys

chrom = {}
with open(sys.argv[1]) as fh:
    for line in fh:
        f = line.split("\t")
        chrom[f[3]] = f[0]

pairs = []
with open(sys.argv[2]) as fh:
    for line in fh:
        f = line.rstrip("\n").split("\t")
        pairs.append((chrom[f[0]], chrom[f[1]], float(f[2]), float(f[3])))

# dS by subgenome pair: the control. A and D descend from closely related
# diploids, C from a more distant one, so A-D has to come out lowest.
by_subgenome = collections.defaultdict(list)
for ca, cb, dn, ds in pairs:
    by_subgenome[tuple(sorted((ca[-1], cb[-1])))].append((dn / ds, ds))
print(f"\n{len(pairs)} homoeolog pairs, dN and dS measured on each\n")
print("  subgenomes     pairs   median dS   median dN/dS")
for key in sorted(by_subgenome):
    values = by_subgenome[key]
    print(f"  {key[0]} vs {key[1]}      {len(values):6d}      "
          f"{statistics.median(ds for _, ds in values):.4f}       "
          f"{statistics.median(r for r, _ in values):.3f}")

ratios = sorted(r for _, _, dn, ds in pairs for r in [dn / ds])
above = sum(1 for r in ratios if r > 1)
print(f"\n  dN/dS median {statistics.median(ratios):.3f}, "
      f"quartiles {ratios[len(ratios) // 4]:.3f} and "
      f"{ratios[3 * len(ratios) // 4]:.3f}")
print(f"  {above} pairs ({above * 100 / len(ratios):.2f}%) above 1, "
      f"which is the ramp's pivot and the only warm colour in the plot")

# The mosaic. A link between two chromosomes of the same homoeologous group
# (1A-1C, 1A-1D, 1C-1D) is the collinear case; anything else is a segment that
# moved.
counts = collections.Counter()
for ca, cb, _, _ in pairs:
    counts[tuple(sorted((ca, cb)))] += 1
between = {k: v for k, v in counts.items() if k[0][0] != k[1][0]}
inside = sum(v for k, v in counts.items() if k[0][0] == k[1][0])
blocks = sorted(((v, k) for k, v in between.items()), reverse=True)
noise = sorted(v for v, _ in blocks if v <= 100)
print(f"\n  {inside} links inside a homoeologous group, "
      f"{sum(between.values())} between "
      f"({sum(between.values()) * 100 / len(pairs):.0f}%)")
print(f"  {sum(1 for v, _ in blocks if v > 100)} chromosome pairs from "
      f"different groups carry more than 100 links, against a median of "
      f"{noise[len(noise) // 2] if noise else 0} for the rest:")
for v, k in blocks[:10]:
    print(f"    {k[0]} - {k[1]}: {v}")
PY

# ── Set up JBrowse ───────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
cp oat.homoeologs.blocks.gz oat.bed.gz "$APP"/
jb add-assembly oat.chrom.sizes --name oat --load copy --force --out "$APP"

# The same assembly in both columns of `blockAssemblies`, and in both entries of
# `bedLocations`: a self-comparison names one genome twice rather than naming
# two.
cat > track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "oat_homoeologs",
  "name": "Oat homoeologs (dN/dS)",
  "assemblyNames": ["oat", "oat"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "oat.homoeologs.blocks.gz",
    "blockAssemblies": ["oat", "oat"],
    "bedLocations": [{ "uri": "oat.bed.gz" }, { "uri": "oat.bed.gz" }],
    "assemblyNames": ["oat", "oat"],
    "attributeColumns": ["dn", "ds"]
  }
}
JSON
jb add-track-json track.json --update --out "$APP"

# A dotplot rather than two stacked rows. Both axes are the same genome in the
# same order, so as linear rows every link is near-vertical and tens of
# thousands of them read as a barcode; on two axes they resolve into the 21x21
# grid the subgenomes make.
cat > session.json <<'JSON'
{
  "name": "Oat homoeologs by selection pressure",
  "views": [
    {
      "type": "DotplotView",
      "displayName": "Hexaploid oat against itself, coloured by dN/dS",
      "showColorLegend": true,
      "views": [{ "assembly": "oat" }, { "assembly": "oat" }],
      "tracks": ["oat_homoeologs"],
      "colorBy": "dnds"
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json: the oat assembly, one homoeolog track, and a"
echo "dotplot session coloured by dN/dS."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
