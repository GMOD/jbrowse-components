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

cat wolves.txt dogs.txt targets.txt | sort -u > all.txt
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

# ── Genotype slice behind the second tutorial figure ────────────────────────
# A 200 kb window inside the 7.9 Mb block that Saarloos 1 (SAAR000001) carries
# as Wolf on hap1 and Dog on hap2, holding the eight wolves and eight dogs the
# figure stacks around it. Wider than the figure's own 40 kb frame so the view
# still has data when you pan off it. Sample IDs stay as they are; the figure
# relabels the rows in its display config rather than rewriting the data.
if [ "$CHROM" = chr1 ]; then
  { head -8 wolves.txt; echo SAAR000001; echo GRSD000002; head -8 dogs.txt; } \
    > block.samples
  tabix -f -p vcf "$CHROM.subset.vcf.gz"
  bcftools view -r chr1:107900000-108100000 -S block.samples --force-samples \
    -Oz -o dog10k_wolfdog_chr1_block.vcf.gz "$CHROM.subset.vcf.gz"
  tabix -f -p vcf dog10k_wolfdog_chr1_block.vcf.gz
  echo "Wrote $(pwd)/dog10k_wolfdog_chr1_block.vcf.gz (the genotype figure's window)."
fi
