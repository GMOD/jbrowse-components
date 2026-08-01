#!/usr/bin/env bash
#
# Reproducibly build the wolfdog local-ancestry track that
# website/docs/tutorials/local_ancestry.md follows along in.
#
# Both the Saarloos Wolfdog and the Czechoslovakian Wolfdog were created in the
# 20th century by crossing German Shepherd Dogs with captive gray wolves, so
# each carries wolf haplotypes on a dog background. This script slices the
# public Dog10K phased reference panel (UU_Cfam_GSD_1.0, the German Shepherd
# assembly UCSC calls canFam4), runs FLARE with a European gray wolf panel and a
# breed-dog panel, and writes one painted BED9 row per haplotype. Two German
# Shepherds ride along as targets: they should paint essentially solid dog,
# which is the control on the whole inference.
#
# Everything is pinned (fixed sample lists, fixed FLARE seed), so re-running
# reproduces the same painting.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (bgzip, tabix),
#           java 8+, python3, curl.
# Usage:    bash scripts/build_dog10k_wolfdog_ancestry.sh [chrom] [outdir]
#           chrom defaults to chr1; pass another (chr1..chr38) to paint it
#           instead.
set -euo pipefail

CHROM="${1:-chr1}"
OUTDIR="${2:-dog10k_wolfdog_build}"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(flare_anc_to_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

SHARE=https://kiddlabshare.med.umich.edu/dog10K
PANEL=$SHARE/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Sample table: breed/category labels for all 1987 sequenced canids ────────
[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# Column 12 is includedInVCF, 17 is SNP.keep — the panel's analysis set.
awk -F'\t' 'NR>1 && $12=="YES" && $17=="TRUE" {print $1"\t"$2"\t"$3}' \
  samples.txt > keep.tsv

# Wolf panel: European gray wolves only, matching the founder populations of
# both wolfdog breeds (Carpathian for the Czechoslovakian, European for the
# Saarloos).
awk -F'\t' '$3=="Wolf" && ($2=="Greece"||$2=="Sweden"||$2=="Russia"||
  $2=="Portugal"||$2=="Europe"||$2=="Eurasia"){print $1}' keep.tsv > wolves.txt

# Targets, chosen before the dog panel so the panel can exclude them. Both
# wolfdog breeds, plus three controls: one German Shepherd Dog (the breed both
# wolfdogs were crossed from), the Shiloh Shepherd (which shares 78% of its F2
# sites with wolves in the Dog10K paper, the highest of any breed dog, though
# D-statistics there find no significant excess over German Shepherds), and the
# Tamaskan (a wolf-lookalike bred from ordinary sled and herding dogs).
awk -F'\t' '$2 ~ /Wolfdog/ {print $1}' keep.tsv > targets.txt
{ echo GRSD000002; echo SHIL000001; echo TMSK000001; } >> targets.txt

# Dog panel: one dog from every breed the collection has, minus the targets and
# the two wolfdog breeds. Breadth is what makes a block read as wolf-versus-dog
# rather than breed-versus-breed, and it has to include the shepherd breeds:
# an alphabetically truncated panel leaves the targets' own dog background
# unrepresented, which pushes ordinary dog haplotypes toward the wolf panel.
awk -F'\t' '$3=="Breed_Dogs" && $2 !~ /Wolfdog|Shiloh|Tamaskan/ {print $1"\t"$2}' \
  keep.tsv | grep -v -F -f targets.txt | sort -t$'\t' -k2,2 -u | cut -f1 > dogs.txt

# Reference rows for the marker figure below, which needs more depth in two
# specific groups than the one-per-breed FLARE panel carries. Not part of FLARE's
# input: these only widen the chromosome slice so the figure can draw them.
#   greek.txt  — every Greek gray wolf, the collection's largest single European
#                wolf population, standing in for "what a wolf looks like here"
#   gsdref.txt — every German Shepherd-lineage dog except the GRSD000002
#                control, i.e. the dog background both wolfdog breeds were
#                crossed back to
awk -F'\t' '$3=="Wolf" && $2=="Greece"{print $1}' keep.tsv > greek.txt
awk -F'\t' '$3=="Breed_Dogs" && $2 ~ /German Shepherd/{print $1}' keep.tsv \
  | grep -v GRSD000002 > gsdref.txt

cat wolves.txt dogs.txt targets.txt greek.txt gsdref.txt | sort -u > all.txt
awk '{print $1"\tWolf"}' wolves.txt > refpanel.txt
awk '{print $1"\tDog"}' dogs.txt >> refpanel.txt

# Row labels for the painted track, in the order the display stacks them.
python3 - <<'PY' > labels.tsv
for prefix, ids in (
    ('Saarloos', ['SAAR00000%d' % i for i in range(1, 5)]),
    ('Czechoslovakian', ['CZEC00000%d' % i for i in range(1, 5)]),
    ('German Shepherd', ['GRSD000002']),
    ('Shiloh Shepherd', ['SHIL000001']),
    ('Tamaskan', ['TMSK000001']),
):
    for n, sample in enumerate(ids, 1):
        print('%s\t%s %d' % (sample, prefix, n))
PY

# ── Slice the phased panel ───────────────────────────────────────────────────
# bcftools reads the remote BCF over HTTP by range request, pulling only this
# chromosome's records, so nothing downloads the full 6 GB panel.
[ -f "$CHROM.subset.vcf.gz" ] || bcftools view -r "$CHROM" -S all.txt \
  --force-samples -Oz -o "$CHROM.subset.vcf.gz" "$PANEL"
bcftools view -S <(cat wolves.txt dogs.txt) --force-samples \
  -Oz -o "$CHROM.ref.vcf.gz" "$CHROM.subset.vcf.gz"
bcftools view -S targets.txt --force-samples \
  -Oz -o "$CHROM.gt.vcf.gz" "$CHROM.subset.vcf.gz"

# ── Genetic map ─────────────────────────────────────────────────────────────
# The published dog genetic maps are on canFam3.1, and Dog10K phased this panel
# on UU_Cfam_GSD_1.0, so this uses a uniform 1 cM/Mb map (close to the dog
# genome-wide average). Block boundaries are therefore approximate.
LAST=$(bcftools query -f '%POS\n' "$CHROM.subset.vcf.gz" | tail -1)
python3 - "$CHROM" "$LAST" > "$CHROM.map" <<'PY'
import sys
chrom, last = sys.argv[1], int(sys.argv[2])
for bp in range(1, last + 1_000_000, 1_000_000):
    print('%s\t.\t%.6f\t%d' % (chrom, bp / 1e6, bp))
PY

# ── FLARE ───────────────────────────────────────────────────────────────────
[ -f flare.jar ] || curl -fsSL -o flare.jar \
  https://faculty.washington.edu/browning/flare.jar
java -Xmx12g -jar flare.jar ref="$CHROM.ref.vcf.gz" ref-panel=refpanel.txt \
  gt="$CHROM.gt.vcf.gz" map="$CHROM.map" out="wolfdog_$CHROM" seed=42

# Per-sample genome-wide-style summary for this chromosome: the wolfdogs carry
# wolf ancestry, the German Shepherds essentially none.
echo
echo "Ancestry fractions on $CHROM:"
zcat "wolfdog_$CHROM.global.anc.gz"

# ── Painted BED ─────────────────────────────────────────────────────────────
python3 "$SCRIPT_DIR/flare_anc_to_bed.py" "wolfdog_$CHROM.anc.vcf.gz" labels.tsv \
  "dog10k_wolfdog_ancestry.$CHROM.bed"
sort -k1,1 -k2,2n "dog10k_wolfdog_ancestry.$CHROM.bed" \
  | bgzip > "dog10k_wolfdog_ancestry.$CHROM.bed.gz"
tabix -f -p bed "dog10k_wolfdog_ancestry.$CHROM.bed.gz"

echo
echo "Wrote $(pwd)/dog10k_wolfdog_ancestry.$CHROM.bed.gz (plus its .tbi)."
echo "Load it with the track JSON in the local ancestry tutorial."

# Wolf-block length distribution per animal. The tutorial's claim that the
# breeds separate on block LENGTH and not only on total wolf fraction rests on
# these numbers, so they are printed rather than measured off the figure: a
# recent cross leaves long founder haplotypes, so a wolf-like dog with only
# short flecks is a different result from one with megabase blocks. Both
# haplotype rows of an animal are pooled, since the label column is
# "<animal> hapN" and the distribution is a property of the animal.
echo
echo "Wolf blocks per animal on $CHROM (count, median kb, longest kb):"
awk -F'\t' '$11=="Wolf" {
    split($10, a, " hap"); len[a[1]] = len[a[1]] " " ($3-$2)
  }
  END {
    for (animal in len) {
      n = split(len[animal], v, " ")
      # split() leaves v[1] empty from the leading separator; compact it
      m = 0; for (i = 1; i <= n; i++) if (v[i] != "") w[++m] = v[i] + 0
      for (i = 2; i <= m; i++) { x = w[i]; j = i - 1
        while (j > 0 && w[j] > x) { w[j+1] = w[j]; j-- }
        w[j+1] = x }
      med = (m % 2) ? w[(m+1)/2] : (w[m/2] + w[m/2+1]) / 2
      printf "  %-28s %4d  %8.0f  %8.0f\n", animal, m, med/1000, w[m]/1000
      delete w; m = 0
    }
  }' "dog10k_wolfdog_ancestry.$CHROM.bed" | sort -k2,2nr

# ── Genotype slice behind the second tutorial figure ────────────────────────
# A 200 kb window at chr1:107.9-108.1 Mb, inside blocks the painting calls Wolf
# on five of the sixteen wolfdog haplotypes and Dog on the other eleven. That
# mix is the point: the figure checks both kinds of call at once.
#
# Rows are the twelve Greek gray wolves, all eleven painted animals, and the
# seven German Shepherd-lineage dogs. Sample IDs stay as they are; the figure
# relabels the rows in its display config rather than rewriting the data.
#
# Each site carries the alt-allele frequency in each FLARE reference panel, so
# the figure can filter itself down to the ancestry-informative markers instead
# of drawing two thousand mostly uninformative columns. The frequencies are
# computed over the full panels (36 European wolves, 318 one-per-breed dogs)
# *before* the sample subset, so they stay panel-wide estimates and do not
# describe the thirty samples the file ends up holding — which is why AC/AF/AN
# are dropped rather than left to be read as the same thing.
if [ "$CHROM" = chr1 ]; then
  { cat greek.txt; cat targets.txt; cat gsdref.txt; } > block.samples
  { awk '{print $1"\twolf"}' wolves.txt
    awk '{print $1"\tdog"}' dogs.txt; } > afgroups.txt
  tabix -f -p vcf "$CHROM.subset.vcf.gz"
  bcftools view -r chr1:107900000-108100000 -Ou "$CHROM.subset.vcf.gz" \
    | bcftools +fill-tags -Ou -- -S afgroups.txt -t AF \
    | bcftools view -S block.samples --force-samples -Ou \
    | bcftools annotate -x INFO/AC,INFO/AF,INFO/AN,INFO/NS \
      -Oz -o dog10k_wolfdog_chr1_block.vcf.gz
  tabix -f -p vcf dog10k_wolfdog_chr1_block.vcf.gz
  echo
  echo "Wrote $(pwd)/dog10k_wolfdog_chr1_block.vcf.gz (the marker figure's window)."
  echo "Markers the figure keeps (AF_wolf >= 0.8 and AF_dog <= 0.15):"
  bcftools query -f '%POS\t%INFO/AF_wolf\t%INFO/AF_dog\n' \
    dog10k_wolfdog_chr1_block.vcf.gz \
    | awk '$2>=0.8 && $3<=0.15 {n++; print "  "$0} END {print "  "n" markers"}'
fi
