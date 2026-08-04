#!/usr/bin/env bash
#
# Reproducibly build the LCT linkage-disequilibrium slice that
# website/docs/tutorials/ld_human.md and the ld/lct_lactase figure read. Unlike
# the mosquito page's precomputed PLINK tracks, no LD is precomputed here: the
# slice is genotypes, and LDDisplay computes exact haplotypic r² from them in the
# browser. This script only decides WHICH genotypes.
#
# Two choices, both of which the script measures and prints rather than asserts:
#
#   * WHICH SAMPLES - r² is a within-population quantity. Pooling panels that
#     carry a haplotype at different frequencies averages the correlation away,
#     so the slice is one panel. The script prints mean pairwise r² over the
#     block for the single panel and for the whole release, which is the
#     difference between a block and a pink smear.
#
#   * HOW WIDE A WINDOW - the figure's claim is that the swept haplotype is a
#     BOUNDED block, so the slice has to extend past both of its edges. The
#     script prints mean r² against the causal window in 200 kb bins along
#     chr2, which is where the window below comes from. An earlier slice started
#     at 135.75 Mb, i.e. exactly at the block's left edge, and no view of it
#     could distinguish "LD ends here" from "the file ends here".
#
# Data: 1000 Genomes phase 3 (20130502), the phased integrated callset, sliced
# over the region below rather than downloaded whole. Cite the release:
#
#   1000 Genomes Project Consortium. A global reference for human genetic
#   variation. Nature 2015;526:68-74.
#
# hg19/GRCh37 coordinates, which is what that release is on. The VCF names the
# contig "2"; the hosted UCSC hg19 hub's chromAlias reconciles "chr2" at query
# time, so the figure can ask for chr2 against a file that has never heard of it.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl, awk,
#           vcftools + bedGraphToBigWig (UCSC), for the Fst track.
#           plink (1.9, for the printed r² tables only. Debian/Ubuntu ship it as
#           `plink1.9`, so there: PLINK=plink1.9 bash scripts/...)
# Usage:    bash scripts/build_lct_ld.sh [outdir]
set -euo pipefail

OUTDIR="${1:-lct_ld_build}"
PLINK="${PLINK:-plink}"
RELEASE=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502
CHR2=$RELEASE/ALL.chr2.phase3_shapeit2_mvncall_integrated_v5b.20130502.genotypes.vcf.gz
PANEL=$RELEASE/integrated_call_samples_v3.20130502.ALL.panel

# The slice. LCT is chr2:136,545,410-136,594,750 and the causal enhancer variant
# rs4988235 sits upstream of it in an MCM6 intron at chr2:136,608,646. The block
# runs about 135.75-136.75 Mb (see the r² profile this script prints), so the
# window carries ~1.15 Mb of unlinked sequence on each side of it.
REGION=2:134600000-137900000
# The panel: r² is per-population, and this is the one the sweep is in.
PANEL_CODE=EUR
# Anchor for the r² profile: rs4988235 itself, chr2:136,608,646 on hg19, named
# chr:pos because the release has no rs IDs here.
CAUSAL=2:136608646
# The block, as the profile below resolves it. Used for the pooled-vs-panel table.
BLOCK=135800000-136750000
# The figure's own MAF floor, applied here only to the printed tables. The FILE
# is not MAF-filtered: the filter is a display setting a reader can move.
MAF=0.35

mkdir -p "$OUTDIR"
cd "$OUTDIR"

OUT=lct_1kg_chr2_${PANEL_CODE,,}_wide.vcf.gz

# ── Panel ────────────────────────────────────────────────────────────────────
# From the release's own panel file, so the sample set is derived rather than
# pasted. 503 samples for EUR.
[ -f panel.txt ] || curl -fsSL -o panel.txt "$PANEL"
awk -v p="$PANEL_CODE" '$3==p{print $1}' panel.txt | sort > panel.samples
echo "panel $PANEL_CODE: $(wc -l < panel.samples) samples"

# ── Slice ────────────────────────────────────────────────────────────────────
# One region query against the hosted callset; the whole chr2 file is 1.2 GB and
# is never downloaded. --force-samples so a sample renamed between the panel file
# and the callset is a warning rather than an abort.
if [ ! -f "$OUT" ]; then
  bcftools view -r "$REGION" -S panel.samples --force-samples \
    -Oz -o "$OUT" "$CHR2"
fi
tabix -f -p vcf "$OUT"
echo "wrote $OUT ($(bcftools index -n "$OUT") records, $(du -h "$OUT" | cut -f1))"

# The same window for the whole release, for the pooled-vs-panel table below.
# Genotypes only, no sample subset.
POOLED=lct_1kg_chr2_pooled_wide.vcf.gz
if [ ! -f "$POOLED" ]; then
  bcftools view -r "$REGION" -Oz -o "$POOLED" "$CHR2"
fi
tabix -f -p vcf "$POOLED"

# ── Fst: this panel against the rest of the release ──────────────────────────
# The other half of the sweep signature, and the one an LD triangle cannot draw:
# linkage says the haplotype is long, Fst says its variants are the ones whose
# frequency separates this panel from everyone else. Weir and Cockerham, by
# vcftools, over the same slice the LD lanes use.
#
# PER VARIANT, not windowed. A 10 kb windowed run was built first and says much
# less: the block's windows average barely above the flanks, because a window
# mixes the swept haplotype with every rare variant sharing it. Per site,
# rs4988235 comes out the single most differentiated variant in the frame.
FST_BW=lct_1kg_chr2_fst_${PANEL_CODE,,}_vs_rest.bw
if [ ! -f "$FST_BW" ]; then
  awk -v p="$PANEL_CODE" 'NR>1 && $3!=p {print $1}' panel.txt | sort > rest.samples
  echo "rest: $(wc -l < rest.samples) samples"
  vcftools --gzvcf "$POOLED" --weir-fst-pop panel.samples --weir-fst-pop rest.samples \
    --out fst_site
  # 1-based site -> bedGraph interval; drop the sites vcftools reports as nan
  awk 'NR>1 && $3!="-nan" && $3!="nan" {printf "chr%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$3}' \
    fst_site.weir.fst | sort -k1,1 -k2,2n | awk '!seen[$2]++' > fst_site.bedgraph
  printf 'chr2\t243199373\n' > hg19.chrom.sizes
  bedGraphToBigWig fst_site.bedgraph hg19.chrom.sizes "$FST_BW"
fi
echo "wrote $FST_BW"

# The most differentiated variants in the frame, which is the figure's claim.
if [ -f fst_site.weir.fst ]; then
  echo
  echo "top per-site Fst ($PANEL_CODE vs rest); rs4988235 is chr2:136,608,646:"
  sort -k3,3gr fst_site.weir.fst | head -5 | awk '{printf "  chr%s:%s  %.3f\n",$1,$2,$3}'
fi

# ── Evidence ─────────────────────────────────────────────────────────────────
# plink --r2 for both tables, on the same MAF floor the figure uses. This is
# plink's genotypic r², while the display computes the exact haplotypic one off
# the phase; the two agree closely here and the tables are for choosing the
# window, not for reproducing the picture cell by cell.
#
# The release carries no rs IDs in this region, so --set-missing-var-ids names
# every variant chr:pos and the anchor is given as a position. That naming needs
# one record per position, so each slice is first reduced to biallelic SNVs with
# duplicate positions dropped, which is also the only thing an r² of allele
# indicators is defined on.
snvs() {
  local out="${1%.vcf.gz}.snvs.vcf.gz"
  [ -f "$out" ] || bcftools view -m2 -M2 -v snps "$1" \
    | bcftools norm -d both -Oz -o "$out"
  echo "$out"
}

# Built up front so bcftools' own progress lines don't land in the middle of a
# table; the calls below are then cache hits that only echo the path.
snvs "$OUT" > /dev/null
snvs "$POOLED" > /dev/null

PLINK_ARGS=(--double-id --allow-extra-chr --set-missing-var-ids @:#
  --maf "$MAF" --r2 --ld-window 999999 --ld-window-r2 0)

# WHERE THE BLOCK ENDS: r² of every common variant against the causal one,
# averaged in 200 kb bins. The slice has to show near-zero bins at BOTH ends or
# the figure cannot claim the block is bounded.
"$PLINK" --vcf "$(snvs "$OUT")" "${PLINK_ARGS[@]}" \
  --ld-snp "$CAUSAL" --ld-window-kb 4000 --out anchor > /dev/null
echo
echo "mean r² against $CAUSAL (rs4988235), 200 kb bins:"
awk 'NR > 1 {b = int($5 / 200000) * 200000; s[b] += $7; n[b]++}
     END {for (b in s) printf "  %7.1f Mb  n=%4d  %.3f\n", b/1e6, n[b], s[b]/n[b]}' \
  anchor.ld | sort -n

# WHY ONE PANEL: mean pairwise r² inside the block, this panel against the whole
# release, on an identical window and MAF floor.
echo
echo "mean pairwise r² within $BLOCK, one panel vs the pooled release:"
for vcf in "$OUT" "$POOLED"; do
  "$PLINK" --vcf "$(snvs "$vcf")" "${PLINK_ARGS[@]}" --chr 2 \
    --from-bp "${BLOCK%-*}" --to-bp "${BLOCK#*-}" \
    --ld-window-kb 1000 --out block > /dev/null
  awk -v f="$vcf" 'NR > 1 {s += $7; n++}
       END {printf "  %-32s %.3f  (%d pairs)\n", f, s/n, n}' block.ld
done

cat <<EOF

Done. The figure reads $OUT; upload it and its .tbi beside the other popgen
demo assets:

  aws s3 cp $OUT s3://jbrowse.org/demos/popgen/
  aws s3 cp $OUT.tbi s3://jbrowse.org/demos/popgen/

$POOLED is built for the pooled-vs-panel table above and is not uploaded. The
pooled figure reads the narrower lct_1kg_chr2.vcf.gz that is already hosted.
EOF
