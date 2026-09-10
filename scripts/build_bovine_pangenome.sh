#!/usr/bin/env bash
#
# Reproducibly rebuild the bovine super-pangenome demo hosted at
# https://jbrowse.org/demos/bovine_pangenome/ — the five tabix-indexed BED
# projections that let JBrowse query a locus of the graph without downloading
# it, plus the rGFA they are derived from.
#
# This is a REDISTRIBUTION WITH MODIFICATIONS, not original data. The graphs are
# published with:
#
#   Leonard AS, Crysnanto D, Mapel XM, Bhati M, Pausch H. "Graph construction
#   method impacts variation representation and analyses in a bovine
#   super-pangenome." Genome Biology 24, 128 (2023).
#   https://doi.org/10.1186/s13059-023-02969-y
#   Data: Zenodo 7737904, https://doi.org/10.5281/zenodo.7737904, CC-BY 4.0
#
# Twelve assemblies over the 29 autosomes, ARS-UCD1.2 (= UCSC bosTau9) as the
# backbone: Hereford (HER, the reference), Angus, Bison, Brahman, Brown Swiss,
# Gaur, Highland, Nellore, Original Braunvieh, Piedmontese, Simmental, Yak. The
# archive carries three graph sets built by three methods from the same twelve;
# only `minigraph` is projected here (2.6 GB of the 12 GB). `pggb` (23.7 GB) and
# `cactus` (26.1 GB) are base-level and state their coordinates in P/W lines
# rather than rGFA tags, so build_pggb_tabix.sh is what would read them — see
# "Going base-level" at the foot of this file, which is also the route to
# carriage.
#
# THE ONE THING TO KNOW: the published minigraph graphs are not rGFA. Their
# header says VN:Z:1.1, their S lines are `S <id> <seq>` with no SN/SO/SR
# anywhere (`grep -c SN:Z:` is 0 on all 29), and what they carry instead is 12 P
# lines. gfa_paths_to_rgfa.py walks those paths to recover the tags, which is
# exact for the backbone and CHECKED rather than assumed: the HER path of every
# chromosome must sum to bosTau9's own length for that chromosome or the script
# refuses. Rank above 0 is a CONVENTION here, not a measurement — see CAVEAT 1
# in that helper. `discoveryRank`/`firstSeenIn` in the allele file therefore mean
# "first of the twelve in the order below that carries this segment", and never
# carriage.
#
# Requires: curl, tar, md5sum, python3, gfatools, gawk (as `awk`), sort,
#           bgzip/tabix (htslib)
# Usage:    bash scripts/build_bovine_pangenome.sh [outdir]
#
# Roughly 30 min after the download, most of it the rGFA reconstruction and the
# bubble pass. Every stage is skipped when its output is already present, so a
# re-run resumes.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Sibling helpers, fetched next to this one when absent, so a bare `curl -fO` of
# this single file behaves the same as a repo checkout.
HELPERS=(gfa_paths_to_rgfa.py build_rgfa_tabix.sh build_rgfa_alleles.sh
  build_bubble_tier.sh bubbles_to_tier_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-bovine_pangenome_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

export LC_ALL=C
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR"

THREADS="${THREADS:-8}"
PREFIX=bovine-arsucd12-minigraph

# The reference FIRST; this order is what SR reflects, and it is the order the P
# lines appear in, which is the only ordering the published graphs state.
PATHS=HER,ANG,BIS,BRA,BSW,GAU,HIG,NEL,OBV,PIE,SIM,YAK

TARBALL=Zenodo_pangenomes.tar.gz
TARBALL_SIZE=12851169131
TARBALL_MD5=976516a67d572d95afae63f4bdd2bb7b
ZENODO=https://zenodo.org/records/7737904/files

echo "=== bosTau9 chrom.sizes (the reconstruction is checked against it) ==="
[ -s bosTau9.chrom.sizes ] || curl -fsSL --retry 5 -o bosTau9.chrom.sizes \
  https://hgdownload.soe.ucsc.edu/goldenPath/bosTau9/bigZips/bosTau9.chrom.sizes

echo "=== source archive ==="
# Zenodo throttles a single stream hard enough that a 12 GB download times out
# more often than it finishes, so this is ranged and resumable. Verify the md5:
# a truncated tarball extracts a plausible subset of chromosomes, and every
# check downstream would pass on it.
if [ ! -s "$TARBALL" ] || [ "$(stat -c%s "$TARBALL")" -ne "$TARBALL_SIZE" ]; then
  echo "downloading $TARBALL ($TARBALL_SIZE bytes, resumable)"
  curl -fL --retry 40 --retry-delay 3 -C - -o "$TARBALL" "$ZENODO/$TARBALL?download=1"
fi
# Stamped, because md5summing 12 GB is a minute and a half and the answer
# cannot change for a file this script refuses to modify.
if [ ! -s "$TARBALL.md5ok" ]; then
  got=$(md5sum "$TARBALL" | cut -d' ' -f1)
  [ "$got" = "$TARBALL_MD5" ] || {
    echo "md5 mismatch: got $got want $TARBALL_MD5" >&2
    exit 1
  }
  echo "$got" > "$TARBALL.md5ok"
fi
echo "md5 verified: $(cat "$TARBALL.md5ok")"

# NOT a gene annotation despite the name: a four-column classification of
# ARS-UCD1.2 into Normal / Repetitive / Tandem repeat / Low mappability /
# Satellite (6,089,641 rows, chromosomes named 1..29), which is what the paper
# stratifies its analyses by. Fetched for provenance; nothing below reads it,
# and gene names in the demo come from bosTau9's NCBI RefSeq annotation.
[ -s genome_annotation.bed.gz ] || curl -fsSL --retry 5 \
  -o genome_annotation.bed.gz "$ZENODO/genome_annotation.bed.gz?download=1"

echo "=== extract the minigraph set ==="
[ -d Zenodo/minigraph ] || tar xzf "$TARBALL" Zenodo/minigraph
echo "per-chromosome graphs: $(find Zenodo/minigraph -name '*.gfa' | wc -l)"

echo "=== reconstruct rGFA tags from the P lines ==="
# Ids are renumbered chrom*10,000,000 so the 29 files, whose ids each restart at
# 1, can be concatenated: the link index joins the segment index by id.
if [ ! -s "$PREFIX.rgfa.gz" ]; then
  python3 "$SCRIPT_DIR/gfa_paths_to_rgfa.py" \
    --chrom-sizes bosTau9.chrom.sizes \
    --indir Zenodo/minigraph \
    --chroms "$(seq -s, 1 29)" \
    --paths "$PATHS" \
    --reference-name bosTau9 \
    2> "$PREFIX.rgfa.log" | bgzip -@ 8 > "$PREFIX.rgfa.gz.tmp"
  mv "$PREFIX.rgfa.gz.tmp" "$PREFIX.rgfa.gz"
fi
# Only written by the stage above, so a warm tree that already has the rGFA has
# no log to summarize. An unconditional tail here aborts the whole run under
# `set -e`, which is how this was found.
if [ -s "$PREFIX.rgfa.log" ]; then
  tail -1 "$PREFIX.rgfa.log"
fi

echo "=== gfatools stat ==="
# rank-0 total must be the sum of bosTau9 chr1..chr29 (2,489,385,779 bp). That
# is the whole-graph version of the per-chromosome check the helper already
# made, and it is what says the reference thread survived concatenation.
gfatools stat "$PREFIX.rgfa.gz" | tee "$PREFIX.stat.txt"
# ASSERTED, not printed beside the number for a human to compare. The first
# version of this selected the chromosomes with `head -29`, and
# bosTau9.chrom.sizes is sorted by SIZE, so it took chrX and dropped chr25 and
# reported 2,586,044,488 against the graph's correct 2,489,385,779 — a mismatch
# on every run, in a line nothing checked. Select by name, and compare.
want_rank0=$(awk '
  BEGIN { for (i = 1; i <= 29; i++) want["chr" i] = 1 }
  want[$1] { s += $2; n++ }
  END { if (n != 29) { print "found " n " of 29 chromosomes" > "/dev/stderr"; exit 2 } print s }
' bosTau9.chrom.sizes)
got_rank0=$(awk '/^Sum of rank-0 segment lengths:/ {print $NF}' "$PREFIX.stat.txt")
if [ "$got_rank0" != "$want_rank0" ]; then
  echo "rank-0 total $got_rank0 != sum of bosTau9 chr1..chr29 $want_rank0" >&2
  echo "the reference thread did not survive reconstruction or concatenation" >&2
  exit 1
fi
echo "  rank-0 total $got_rank0 bp == sum of bosTau9 chr1..chr29"

echo "=== segments + links (RgfaTabixAdapter reads this pair by shared prefix) ==="
[ -s "$PREFIX.segs.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_rgfa_tabix.sh" "$PREFIX.rgfa.gz" "$PREFIX"

echo "=== allele inventory ==="
[ -s "$PREFIX.alleles.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_rgfa_alleles.sh" "$PREFIX"

echo "=== bubbles (feature track and the segments-per-bubble curve) ==="
# gfatools counts paths through a bubble combinatorially and CLAMPS at
# 2147483647 rather than overflowing; 22 of the 153,719 bubbles sit at that
# value, where it means "more than I can count", not a measurement.
if [ ! -s "$PREFIX.bubbles.bed.gz" ]; then
  gzip -dc "$PREFIX.rgfa.gz" | gfatools bubble - | sort -k1,1 -k2,2n |
    bgzip > "$PREFIX.bubbles.bed.gz.tmp"
  mv "$PREFIX.bubbles.bed.gz.tmp" "$PREFIX.bubbles.bed.gz"
  tabix -f -p bed "$PREFIX.bubbles.bed.gz"
fi

echo "=== coarse tier: one node per bubble holding >=10 kb ==="
# What makes a whole chromosome drawable. The graph view's layout scales to a
# target node size, so ten times the nodes is the same ink at a tenth the size;
# 29 autosomes at segment resolution draw as a thread.
[ -s "$PREFIX.tier10000.segs.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_bubble_tier.sh" "$PREFIX.bubbles.bed.gz" \
    "$PREFIX.tier10000" 10000

echo "=== variant route: vg deconstruct per chromosome ==="
# The graph route above and this are the two halves the HPRC tutorial names:
# "the sv.gfa is the graph route; the VCF is the variant route". The graph
# cannot state carriage -- rGFA has nowhere to put it -- so allele frequency and
# per-sample burden come from here, and this is the only file in the set with a
# GT column per assembly.
#
# It is cheap because it is SV-resolution, which is the resolution the whole
# demo is at: measured on chr25, `vg convert` 1.6 s and `vg deconstruct` 0.42 s
# for 2,593 records. HPRC's base-level equivalent is a 2.3 GB download.
#
# The INFO vocabulary comes out AC/AF/AN/AT/NS/LV, which is what
# generatePangenomeData.ts in GMOD/jb2hubs already parses, and LV means the
# site's own `INFO.LV[0]==0 && alleleLength>=50` filter applies unchanged.
REF_PATH="${PATHS%%,*}"
if [ ! -s "$PREFIX.vcf.gz" ]; then
  mkdir -p vcf
  for k in $(seq 1 29); do
    [ -s "vcf/chr$k.vcf" ] && continue
    # deconstruct names CHROM after the path it is given, so rename the
    # reference P line to the UCSC chromosome first rather than rewriting CHROM
    # afterwards -- one naming rule produces both this file and the rGFA.
    awk -F'\t' -v ref="$REF_PATH" -v c="chr$k" \
      'BEGIN { OFS = "\t" } $1 == "P" && $2 == ref { $2 = c } { print }' \
      "Zenodo/minigraph/$k.gfa" > "$TMPDIR/$k.renamed.gfa"
    vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
    vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
    mv "vcf/chr$k.vcf.tmp" "vcf/chr$k.vcf"
    rm -f "$TMPDIR/$k.renamed.gfa" "$TMPDIR/$k.vg"
    echo "  chr$k: $(awk '!/^#/' "vcf/chr$k.vcf" | wc -l) records"
  done

  # Sample columns must be identical across the 29 before they can be
  # concatenated; a differing set would silently shift every genotype. The rGFA
  # stage already refuses a chromosome whose path list differs, but that is a
  # different producer and this is cheap.
  want=$(grep -m1 '^#CHROM' vcf/chr1.vcf)
  for k in $(seq 2 29); do
    [ "$(grep -m1 '^#CHROM' "vcf/chr$k.vcf")" = "$want" ] || {
      echo "chr$k has a different sample set from chr1; refusing to concatenate" >&2
      exit 1
    }
  done
  echo "  sample set identical across 29 chromosomes"

  # One header carrying all 29 contigs in chromosome order, then the bodies in
  # that same order, so the result is sorted without a sort pass. awk rather
  # than grep throughout: grep exits 1 on no match, which under pipefail would
  # turn an empty chromosome into a failed build.
  {
    awk '/^##fileformat/' vcf/chr1.vcf
    awk '/^##/ && !/^##fileformat/ && !/^##contig/' vcf/chr1.vcf
    for k in $(seq 1 29); do awk '/^##contig/' "vcf/chr$k.vcf"; done
    awk '/^#CHROM/' vcf/chr1.vcf
    for k in $(seq 1 29); do awk '!/^#/' "vcf/chr$k.vcf"; done
  } | bgzip -@ 8 > "$PREFIX.vcf.gz.tmp"
  mv "$PREFIX.vcf.gz.tmp" "$PREFIX.vcf.gz"
  tabix -f -p vcf "$PREFIX.vcf.gz"
fi
echo "  $(tabix -l "$PREFIX.vcf.gz" | wc -l) chromosomes indexed"

echo
echo "Built in $PWD:"
find . -maxdepth 1 -name "$PREFIX.*" -printf '  %f\n' | sort
cat <<'NOTES'

Publish with scripts/deploy-demo.sh, never a bare `aws s3 cp` — the bucket has
no versioning. Target prefix demos/bovine_pangenome/. A README.txt carrying this
provenance ships beside the data; see agent-docs/reference/HOSTING.md.

Serving it: website/pangenome-config/bovine-arsucd12.json in GMOD/jb2hubs is the
config that names these files. RgfaTabixAdapter takes the shared PREFIX with no
suffix and appends .segs/.links itself; MinigraphBubbleAdapter takes the bubbles
file directly; the alleles file is a plain BedTabixAdapter uri on an
AlignmentsTrack. Stable names are PanSN, so a track on an ordinary bosTau9
assembly needs assemblyNameToPanSN: { "bosTau9": "bosTau9" } — the alleles file
is the exception, its rows sitting on bosTau9's own refNames.

Windows worth opening (firstSeenIn in parentheses, which is the convention
above and not carriage):
  chr8:70,277,073-70,365,819    RHOBTB2          726 kb insertion (BSW)
  chr9:87,066,686-87,166,962    RAET1L           251 kb insertion (BRA)
  chr23:25,844,769-25,968,809   BTNL2 (BoLA)     157 kb insertion (BIS)
  chr17:14,003,965-14,060,481   GYPA             108 kb insertion (BSW)
  chr3:8,543,335-8,644,701      ITLN2             54 kb deletion  (HIG)

GOING BASE-LEVEL, which is also the only route to carriage. The tarball's
`pggb` and `cactus` sets state per-assembly walks, so build_pggb_tabix.sh emits
the same five files WITH the SM:Z: carriage tag that rGFA cannot express, and
`vg deconstruct` over one of them yields the reference-projected VCF this demo
has none of. That is what would make the bovine set a peer of demos/hprc rather
than a structural-resolution sibling, and it needs no new download:
  tar xzf Zenodo_pangenomes.tar.gz Zenodo/cactus
NOTES
