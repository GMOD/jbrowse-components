#!/usr/bin/env bash
#
# Reproducibly build the Anopheles 2La linkage-disequilibrium tracks that
# website/docs/tutorials/linkage_disequilibrium.md follows along in.
#
# The 2La inversion spans ~22 Mb of chromosome arm 2L. Inverted and standard
# arrangements cannot recombine in a heterozygote, so in a population carrying
# both, the whole segment is inherited as one unit and shows up as a single
# block in an LD heatmap. 22 Mb is far past what can be computed live from a
# VCF, so the LD is precomputed with PLINK and read back through
# PlinkLDTabixAdapter.
#
# Nothing here is hardcoded from a paper. The script measures, and prints, the
# evidence for every judgment call it makes:
#
#   * which population to use    - long-range D' inside a candidate span vs
#                                  outside it, per population
#   * which metric to use        - r2 and D' side by side on identical pairs
#   * where the block ends       - a D' profile along the arm, which recovers
#                                  the inversion breakpoints on its own
#   * who carries the inversion  - a per-sample karyotype from published tag
#                                  SNPs, printed as a score histogram (it has to
#                                  come out trimodal) and a per-population table
#
# Read the printed tables before trusting the picture. A population fixed for
# either arrangement can never show a block, and r2 barely shows this one at
# all (see the tutorial's "Pick the metric before you blame the data").
#
# Data: Ag1000G phase 2 AR1, 1142 wild-caught mosquitoes phased by the project.
# Downloads ~550 MB. Cite the release when you use it:
#
#   Anopheles gambiae 1000 Genomes Consortium. Genome variation and population
#   structure among 1142 mosquitoes of the African malaria vector species
#   Anopheles gambiae and Anopheles coluzzii. Genome Research 2020;30:1533-1548.
#   Data: Ag1000G phase 2 AR1.  https://www.malariagen.net/project/ag1000g/
#
# WHY PHASE 2 AND NOT THE CURRENT RELEASE. Two independent reasons, the second
# being the one that actually decides it:
#
#  - Ag3's own download guide lists URLs that return HTTP 403 to anonymous
#    callers (as do the sibling Af1/Amin buckets), so it is not reachable
#    without credentials.
#  - Phase 1 and 2 terms of use were lifted in March 2022 and are fully open
#    access, whereas phase 3 remains under terms that reserve the first global
#    analyses to the Consortium. For public demo assets, phase 2 is the correct
#    release rather than a fallback.
#    https://www.malariagen.net/data/our-approach-sharing-data/ag1000g-terms-of-use/
#
# Requires: plink2, htslib (bgzip, tabix), samtools, curl, awk, python3.
#           PLINK 1.9 also works, with LD_FLAGS=(--r2 dprime ...) instead.
# Usage:    bash scripts/build_ag1000g_ld.sh [outdir]
set -euo pipefail

OUTDIR="${1:-ag1000g_ld_build}"
AR1=https://ngs.sanger.ac.uk/production/ag1000g/phase2/AR1
GENOME=https://ngs.sanger.ac.uk/production/ag1000g/phase3/genome
CHROM=2L

# Candidate span to test, from the literature, used ONLY as the probe window.
# The breakpoints the script reports back are derived from the data.
PROBE_FROM=20524058
PROBE_TO=42165532

# --r2-phased is the haplotype-frequency estimate rather than a correlation
# between dosages, which is the statistic the display draws and the one D'
# pairs with; PLINK 1.9 spelled this pair `--r2 dprime`, one flag for both.
# dprimeabs rather than dprime: the pre-computed path reads every cell as a
# magnitude, having no genotypes to recover a sign against.
#
# The column layout that comes out, #CHROM_A POS_A ID_A CHROM_B POS_B ID_B
# PHASED_R2 ABS_DPRIME, is what PlinkLDTabixAdapter parses, and sits at the same
# eight offsets 1.9 used, so every awk below counts columns the same way.
LD_FLAGS=(--r2-phased cols=chrom,pos,id,dprimeabs
  --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0)

PLINK="${PLINK:-plink2}"

# The CLI, used for `sort-bed` in build_track below as well as for the instance
# at the end, so it is resolved before either.
if command -v jbrowse >/dev/null; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
for tool in "$PLINK" bgzip tabix samtools curl python3; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done
if ! "$PLINK" --version 2>&1 | grep -q "PLINK v2"; then
  echo "error: '$PLINK' is not plink2, which LD_FLAGS above is written for." >&2
  exit 1
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Inputs ──────────────────────────────────────────────────────────────────
# The haplotypes are SHAPEIT .haps/.sample, already phased by the project. The
# reference and gene set sit on the same server, so the assembly needs no
# outside source.
fetch() { [ -f "$2" ] || curl -fsSL --retry 3 -o "$2" "$1"; }

fetch "$AR1/samples/samples.meta.txt" samples.meta.txt
fetch "$AR1/haplotypes/main/shapeit/ag1000g.phase2.ar1.samples.$CHROM.gz" "samples.$CHROM.gz"
echo "fetching phased haplotypes for $CHROM (~470 MB, one time)..."
fetch "$AR1/haplotypes/main/shapeit/ag1000g.phase2.ar1.haplotypes.$CHROM.gz" "haplotypes.$CHROM.gz"
fetch "$GENOME/Anopheles-gambiae-PEST_CHROMOSOMES_AgamP4.fa.gz" AgamP4.fa.gz
fetch "$GENOME/Anopheles-gambiae-PEST_BASEFEATURES_AgamP4.12.gff3.gz" AgamP4.gff3.gz

zcat "samples.$CHROM.gz" > "samples.$CHROM.txt"
NHAP=$(( $(wc -l < "samples.$CHROM.txt") - 2 ))
echo "$NHAP phased individuals ($(( NHAP * 2 )) haplotypes)"

# ── haps -> VCF ─────────────────────────────────────────────────────────────
# Two things this has to get right. The .haps chromosome column is a bare '2'
# for arm 2L, so it is rewritten (positions are already 2L coordinates). And
# thinning happens to a bp grid with a MAF floor applied first: grid-then-filter
# lands mostly on rare variants, because rare variants are the numerous ones.
cat > haps2vcf.awk <<'AWK'
BEGIN {
  FS = " "; OFS = "\t"
  nc = split(COLS, col, ","); ns = split(NAMES, nm, ",")
  print "##fileformat=VCFv4.2"
  print "##contig=<ID=" CHROM ">"
  line = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT"
  for (s = 1; s <= ns; s++) line = line "\t" nm[s]
  print line
  nextpos = FROM
}
{
  pos = $3 + 0
  if (pos < FROM || pos > TO || pos < nextpos) next
  alt = 0
  for (i = 1; i <= nc; i++) alt += $(5 + col[i])
  af = alt / nc
  maf = af < 0.5 ? af : 1 - af
  if (maf < MINMAF) next
  gt = ""
  for (s = 1; s <= ns; s++) gt = gt "\t" $(5 + col[2 * s - 1]) "|" $(5 + col[2 * s])
  print CHROM, pos, CHROM "_" pos, $4, $5, ".", "PASS", ".", "GT" gt
  nextpos = pos + STEP
}
AWK

# haplotype column pairs for a set of sample ids, in .haps column order
cols_for() {
  awk -v f="$1" 'BEGIN{while ((getline l < f) > 0) want[l] = 1}
    NR > 2 && want[$1] {print NR-2"\t"$1}' "samples.$CHROM.txt"
}

# Panels are one population each. r2 is a correlation across whatever samples
# you hand it, so pooling populations - or species - invents LD that no
# individual population has. The m_s column is the species call (S = gambiae,
# M = coluzzii); every panel below is single-population and single-species.
for pop in $(awk -F'\t' 'NR>1{print $3}' samples.meta.txt | sort -u); do
  awk -F'\t' -v p="$pop" 'NR>1 && $3==p{print $1}' samples.meta.txt | sort -u > "ids.$pop"
  cols_for "ids.$pop" > "cols.$pop"
  awk '{print $2"\t"$2}' "cols.$pop" > "keep.$pop.txt"
done

emit_vcf() { # ids-file from to step minmaf out
  local cols names
  cols=$(awk '{printf "%s%d,%d", (NR>1 ? "," : ""), 2*$1-1, 2*$1} END{print ""}' "$1")
  names=$(awk '{printf "%s%s", (NR>1 ? "," : ""), $2} END{print ""}' "$1")
  zcat "haplotypes.$CHROM.gz" | awk -v COLS="$cols" -v NAMES="$names" \
    -v CHROM=$CHROM -v STEP="$4" -v MINMAF="$5" -v FROM="$2" -v TO="$3" \
    -f haps2vcf.awk > "$6"
}

# One pass over the 470 MB file gives a common-variant grid for every panel;
# per-population MAF and thinning are applied afterwards from the plink set.
if [ ! -f common.bim ]; then
  echo "building common-variant grid over $CHROM (one pass, a few minutes)..."
  cols_for <(awk 'NR>2{print $1}' "samples.$CHROM.txt") > cols.all
  emit_vcf cols.all 1 300000000 4000 0.1 common.vcf
  "$PLINK" --vcf common.vcf --double-id --allow-extra-chr \
    --make-bed --out common >/dev/null
  rm -f common.vcf
fi
echo "grid: $(wc -l < common.bim) common sites on $CHROM"

# ── Which population? ───────────────────────────────────────────────────────
# An inversion only shows a block where both arrangements segregate. Probe it:
# mean D' between SNPs >5 Mb apart, inside the candidate span vs outside it.
# Read the ratio AND the absolute background - a panel whose background is
# already high is bottlenecked, and its whole arm will render red.
probe() { # pop from to tag -> "meanDp n"
  "$PLINK" --bfile common --allow-extra-chr --keep "keep.$1.txt" --maf 0.2 \
    --chr $CHROM --from-bp "$2" --to-bp "$3" --thin-count 400 --seed 1 \
    "${LD_FLAGS[@]}" --out "probe.$1.$4" >/dev/null 2>&1 || { echo "na na 0"; return; }
  # the trailing newline matters: `read` returns non-zero on EOF without one,
  # which under `set -e` would kill the script after the first panel
  awk 'NR>1{d=($5>$2?$5-$2:$2-$5); if(d>5e6){s+=$8; r+=$7; n++}}
       END{if(n) printf "%.3f %.3f %d\n", s/n, r/n, n; else print "na na 0"}' \
    "probe.$1.$4.vcor"
}

echo
printf '%-8s %5s   %-15s %-15s %9s %9s\n' \
  pop n "inside D'/r2" "outside D'/r2" "D' ratio" "r2 ratio"
PANELS=$(awk -F'\t' 'NR>1{print $3}' samples.meta.txt | sort | uniq -c | sort -rn |
  awk '$1>=40{print $2}')
# Both ratios are shown because they disagree about which metric to prefer, and
# the r2 one is what governs a picture: D' runs higher inside the span but also
# leaks outside it (~0.1-0.2, against r2's ~0.01), so r2 has much the sharper
# contrast against background even though its cells are dimmer. Contrast, not
# cell brightness, is what makes a block legible.
ratio() {
  awk -v a="$1" -v b="$2" \
    'BEGIN{if (b+0 > 0 && a != "na") printf "%.1fx", a/b; else print "-"}'
}
for pop in $PANELS; do
  n=$(wc -l < "keep.$pop.txt")
  read -r din rin _ < <(probe "$pop" "$PROBE_FROM" "$PROBE_TO" inv)
  read -r dout rout _ < <(probe "$pop" 1000000 "$((PROBE_FROM - 500000))" out)
  printf '%-8s %5d   %-15s %-15s %9s %9s\n' "$pop" "$n" \
    "$din / $rin" "$dout / $rout" \
    "$(ratio "$din" "$dout")" "$(ratio "$rin" "$rout")"
done

# ── Tracks ──────────────────────────────────────────────────────────────────
# The SNP count is what the display uploads as n(n-1)/2 cells, so it is capped
# by thinning to a grid rather than left to the callset's density. ~800 SNPs
# across an arm is already at screen resolution; more only adds moire.
build_track() { # pop minmaf grid tag
  "$PLINK" --bfile common --allow-extra-chr --keep "keep.$1.txt" --maf "$2" \
    --chr $CHROM --write-snplist --out "sel.$4" >/dev/null 2>&1
  awk -v g="$3" -F'_' '{p=$2+0; if (p >= nxt) {print $0; nxt = p + g}}' \
    "sel.$4.snplist" > "grid.$4.snplist"
  "$PLINK" --bfile common --allow-extra-chr --keep "keep.$1.txt" \
    --extract "grid.$4.snplist" "${LD_FLAGS[@]}" \
    --out "$4" >/dev/null 2>&1
  # plink2 writes tabs and comments its own header, so the table goes straight
  # into `sort-bed`, which does what it does for a BED and a .ld alike — the `#`
  # line on top and the rest sorted on the same first two columns, under LC_ALL=C.
  # (1.9 needed an `awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t'` first, for a
  # space-padded table with a bare header.)
  #
  # A COMMENTED header rather than one counted with -S 1: both keep it out of the
  # data, but only a commented header is what `tabix -H` prints and what readers
  # ask for first, so an -S 1 header is easy to miss — and missing it drops the
  # ABS_DPRIME column, which is what makes D' available rather than only r².
  # Not -c C, which would make C the meta character and read every chr-prefixed
  # data row as a comment.
  #
  # The .gz keeps the .ld name it has always had, and that the hosted demo files
  # are published under; plink2 calls its own output .vcor.
  jb sort-bed < "$4.vcor" | bgzip > "$4.ld.gz"
  tabix -s 1 -b 2 -e 2 -f "$4.ld.gz"
  echo "  $4: $(wc -l < "grid.$4.snplist") SNPs, $(( $(zcat "$4.ld.gz" | wc -l) - 1 )) pairs, $(du -h "$4.ld.gz" | cut -f1)"
}

echo
echo "building LD tracks..."
# One panel that segregates both arrangements and one that is near-fixed, chosen
# off the probe table above. The karyotype track further down covers these same
# two populations, so the two pictures are about the same mosquitoes.
PANEL_POPS="CMgam GAgam"
build_track CMgam 0.2 50000 ld_cmgam
build_track GAgam 0.2 50000 ld_gagam

# ── Where does the block actually end? ──────────────────────────────────────
# Mean D' to partners >5 Mb away, per 1 Mb bin. The step up and the step down
# are the inversion breakpoints, recovered without being told them.
echo
echo "long-range D' along $CHROM in CMgam (the block edges are the breakpoints):"
zcat ld_cmgam.ld.gz | awk 'NR>1{d=($5>$2?$5-$2:$2-$5); if(d<5e6) next;
    b=int($2/1000000); s[b]+=$8; n[b]++; c=int($5/1000000); s[c]+=$8; n[c]++}
  END{for(i=0;i<=60;i++) if(n[i]>50){v=s[i]/n[i]; bar="";
    for(j=0;j<int(v*50);j++) bar=bar"#"; printf "  %2d Mb  %.3f  %s\n", i, v, bar}}'

# ── The arrangement itself, genotyped per mosquito ──────────────────────────
# Everything above measures a CONSEQUENCE of the inversion: heterozygotes cannot
# recombine across it, so the span travels as one block. This section genotypes
# the arrangement itself, as one <INV> call per mosquito, which is what a
# multi-sample variant display can show per row.
#
# The inversion is not something this script discovers. 2La is a cytologically
# defined arrangement, both of its breakpoints were cloned and sequenced
# (Sharakhov et al. 2006, PNAS 103:6258-6262), and a PCR across the junctions
# karyotypes single mosquitoes, validated against polytene cytology on 765 field
# specimens (White et al. 2007, Am J Trop Med Hyg 76:334-339). What is inferred
# here is each sample's karyotype, from the tag SNPs of Love et al. 2019 (G3
# 9:3249-3262), the same in-silico method MalariaGEN ships for Ag3; that paper
# ascertained the tags on held-out Ag1000G samples and checked them against
# cytologically karyotyped specimens sequenced outside the project.
#
# The score is compkaryo's: mean number of ALT alleles across the tag SNPs. It
# is only meaningful if it comes out trimodal, so the histogram below is printed
# rather than asserted. Read it before trusting the calls: three peaks at 0, 1
# and 2 with empty space between them is the method working.
COMPKARYO=https://raw.githubusercontent.com/rrlove/compkaryo/master/compkaryo/targets
fetch "$COMPKARYO/2La_targets.txt" 2La_targets.txt

# Phased haplotypes rather than the pass VCF, for two reasons: it is the file
# already downloaded, and phased output has no missing genotypes, so compkaryo's
# advice to mask GQ<20 first has nothing to act on. That advice exists because
# low-quality genotypes skew the mean, so the shortcut was checked rather than
# assumed: scoring the tags straight out of variation/main/vcf/pass, unphased and
# with GQ<20 masked, gives the identical karyotype for all 1142 samples. The
# calls are not an artifact of the phasing.
#
# grep before awk. Only ~200 of the file's millions of rows are wanted, and each
# row carries 2328 haplotype columns, so letting awk split every record costs
# minutes; a fixed-string prefilter on "<chrom> . <pos> " does the same job in
# well under one. The .haps chromosome column is a bare '2' for arm 2L (the same
# quirk haps2vcf.awk handles above), which is what the pattern matches.
awk -v C=2 '{print C " . " $1 " "}' 2La_targets.txt > tagpat.txt
zcat "haplotypes.$CHROM.gz" | grep -F -f tagpat.txt > tagrows.txt
awk -v SAMP="samples.$CHROM.txt" -v NTAG="$(wc -l < 2La_targets.txt)" '
BEGIN { while ((getline l < SAMP) > 0) { if (++nl > 2) { split(l, f, " "); name[++ns] = f[1] } } }
{ sites++; for (s = 1; s <= ns; s++) sum[s] += $(4 + 2 * s) + $(5 + 2 * s) }
END {
  if (sites < 100) { print "only " sites " tag SNPs matched, refusing to karyotype" > "/dev/stderr"; exit 1 }
  print sites " of " NTAG " 2La tag SNPs found in the haplotypes" > "/dev/stderr"
  for (s = 1; s <= ns; s++) printf "%s\t%.4f\t%d\n", name[s], sum[s] / sites, int(sum[s] / sites + 0.5)
}' tagrows.txt > karyotype.2La.txt

# The phased haplotypes carry 22 colony-cross samples beside the 1142 wild-caught
# ones, and those have no row in samples.meta.txt (they are in
# cross.samples.meta.txt instead). Drop them: every panel in this script is a
# wild-caught population, and a lab cross has no population to be grouped under.
awk -F'\t' 'NR==FNR {wild[$1] = 1; next} $1 in wild' \
  samples.meta.txt karyotype.2La.txt > karyotype.2La.wild.txt
echo "karyotyped $(wc -l < karyotype.2La.wild.txt) wild-caught samples \
($(( $(wc -l < karyotype.2La.txt) - $(wc -l < karyotype.2La.wild.txt) )) cross samples dropped)"

echo
echo "2La score distribution (mean ALT dosage over the tag SNPs, 0.1 bins):"
awk -F'\t' '{b = int($2 * 10); n[b]++}
  END {for (i = 0; i <= 20; i++) {bar = ""; for (j = 0; j < n[i]; j++) bar = bar "#"
    printf "  %.1f  %4d  %s\n", i / 10, n[i] + 0, bar}}' karyotype.2La.wild.txt

# Karyotype by population. This is the same claim the two LD panels make, read
# off the arrangement instead of off the correlation: the panel that shows a
# block should be the one segregating both arrangements, and the flat one should
# be near-fixed. If those disagree, the LD figure is the thing that is wrong.
echo
echo "2La karyotype by population (+/+ standard, a/+ het, a/a inverted):"
awk -F'\t' 'NR==FNR {pop[$1] = $3; next}
  {k[pop[$1] "\t" $3]++; tot[pop[$1]]++; carr[pop[$1]] += $3}
  END {printf "  %-8s %5s %6s %6s %6s %8s\n", "pop", "n", "+/+", "a/+", "a/a", "freq(a)"
    for (p in tot) printf "  %-8s %5d %6d %6d %6d %8.2f\n", p, tot[p],
      k[p "\t0"] + 0, k[p "\t1"] + 0, k[p "\t2"] + 0, carr[p] / (2 * tot[p])}' \
  samples.meta.txt karyotype.2La.wild.txt | (read -r h; echo "$h"; sort -k6,6gr)

# One file per LD panel rather than one file holding every sample. The display
# draws one row per sample in the VCF and has no sample filter, so the file IS
# the row set, and the row set is what has to be named: at 3 px a row is far too
# short for the sidebar to render a text label, which leaves the track header as
# the only place a population name can go. One track per population also puts
# this picture in the same lane structure as the two heatmaps above.
#
# (karyotype.2La.wild.txt keeps the whole release for anyone who wants it, and
# the per-population table above is that whole-release result in text.)
emit_karyotype_track() { # pop
  local pop="$1" calls="karyotype.2La.$1.txt"
  awk -F'\t' -v POP="$pop" 'NR==FNR {if ($3 == POP) keep[$1] = 1; next} $1 in keep' \
    samples.meta.txt karyotype.2La.wild.txt > "$calls"

  # One <INV> record at the published breakpoints, genotyped across the panel.
  # The breakpoints are White et al. 2007's; the D' profile printed above is the
  # independent check that the block really does start and end near them.
  {
    printf '##fileformat=VCFv4.2\n'
    printf '##contig=<ID=%s>\n' "$CHROM"
    printf '##ALT=<ID=INV,Description="Inversion">\n'
    printf '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">\n'
    printf '##INFO=<ID=END,Number=1,Type=Integer,Description="End position">\n'
    printf '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n'
    awk -F'\t' -v CHROM=$CHROM -v FROM=$PROBE_FROM -v TO=$PROBE_TO '
      BEGIN {OFS = "\t"; hdr = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT"}
      {hdr = hdr "\t" $1; gt = gt "\t" ($3 == 0 ? "0/0" : ($3 == 1 ? "0/1" : "1/1"))}
      END {print hdr
        print CHROM, FROM, "2La", "N", "<INV>", ".", "PASS",
          "SVTYPE=INV;END=" TO, "GT" gt}' "$calls"
  } | bgzip > "ag1000g_2La_$pop.vcf.gz"
  tabix -f -p vcf "ag1000g_2La_$pop.vcf.gz"

  # The sample attribute table the display orders and colors rows by. Within one
  # population the karyotype is the only useful key, and it sorts standard, het,
  # inverted on its own, so the three classes come out as contiguous blocks in
  # dosage order without needing a sort column of their own.
  { printf 'name\tpopulation\tcountry\tkaryotype\n'
    awk -F'\t' 'NR==FNR {p[$1] = $3; c[$1] = $4; next}
      {print $1, p[$1], c[$1],
        ($3 == 0 ? "2L+a/2L+a" : ($3 == 1 ? "2La/2L+a" : "2La/2La"))}' OFS='\t' \
      samples.meta.txt "$calls"
  } > "ag1000g_2La_${pop}_samples.tsv"

  echo "  $pop: $(wc -l < "$calls") mosquitoes -> ag1000g_2La_$pop.vcf.gz"
}

echo
echo "building per-mosquito karyotype tracks..."
for pop in $PANEL_POPS; do emit_karyotype_track "$pop"; done

# ── Assembly and JBrowse ────────────────────────────────────────────────────
zcat AgamP4.fa.gz | bgzip > AgamP4.fa.bgz
samtools faidx AgamP4.fa.bgz

[ -f jbrowse2/index.html ] || jb create jbrowse2

# --type is required: the CLI infers the sequence type from the extension, and
# does not recognize .bgz (it wants .fa.gz), so it cannot guess this one
jb add-assembly AgamP4.fa.bgz --type bgzipFasta --name AgamP4 \
  --load copy --force --out jbrowse2
zcat AgamP4.gff3.gz > AgamP4.gff3
jb sort-gff AgamP4.gff3 | bgzip > AgamP4.sorted.gff3.gz
tabix -f -p gff AgamP4.sorted.gff3.gz
jb add-track AgamP4.sorted.gff3.gz --name "AgamP4.12 genes" --trackId agamp4_genes \
  --load copy --force --out jbrowse2
cp ld_cmgam.ld.gz ld_cmgam.ld.gz.tbi ld_gagam.ld.gz ld_gagam.ld.gz.tbi jbrowse2/
for pop in $PANEL_POPS; do
  cp "ag1000g_2La_$pop.vcf.gz" "ag1000g_2La_$pop.vcf.gz.tbi" \
     "ag1000g_2La_${pop}_samples.tsv" jbrowse2/
done

# The CLI has no LDTrack workflow (and would not recognize a .ld.gz), so the LD
# tracks are written straight into the config. D' rather than r2 is the whole
# reason this figure is legible - see the probe table above.
python3 - jbrowse2/config.json "$PANEL_POPS" <<'PY'
import json, sys

path, pops = sys.argv[1], sys.argv[2].split()
cfg = json.load(open(path))
names = {
    'ld_cmgam': "Cameroon (CMgam)",
    'ld_gagam': "Gabon (GAgam)",
}
# The karyotype lanes are driven off PANEL_POPS, same as the files above, so
# changing which populations the script builds does not need an edit here too.
COUNTRY = {'CMgam': 'Cameroon', 'GAgam': 'Gabon'}
karyo = {
    pop: (f'ag1000g_2La_{pop}',
          f"{COUNTRY.get(pop, pop)} 2La karyotype, one row per mosquito")
    for pop in pops
}
karyo_ids = {t for t, _ in karyo.values()}
cfg['tracks'] = [t for t in cfg['tracks']
                 if t['trackId'] not in names and t['trackId'] not in karyo_ids]
for trackId, name in names.items():
    cfg['tracks'].append({
        'type': 'LDTrack',
        'trackId': trackId,
        'name': name,
        'assemblyNames': ['AgamP4'],
        'adapter': {
            'type': 'PlinkLDTabixAdapter',
            'uri': f'{trackId}.ld.gz',
        },
        'displays': [{
            'type': 'LDTrackDisplay',
            'displayId': f'{trackId}-LDTrackDisplay',
            # r2 rather than D': see the r2-vs-D' ratio columns in the probe
            # table. D' is brighter inside the span but also tints the
            # background, so r2 delineates the block far more sharply.
            'ldMetric': 'r2',
            'useGenomicPositions': True,
            'showLegend': True,
            'height': 360,
        }],
    })

# The arrangement itself, one row per mosquito. The regular multi-sample display
# rather than its matrix mode: matrix spaces one evenly sized column per variant,
# which throws away the one thing this call has, its genomic extent. Here the
# genotype cells start and end at the breakpoints, directly under the LD block.
for pop, (trackId, name) in karyo.items():
    cfg['tracks'].append({
        'type': 'VariantTrack',
        'trackId': trackId,
        'name': name,
        'assemblyNames': ['AgamP4'],
        'adapter': {
            'type': 'VcfTabixAdapter',
            'uri': f'{trackId}.vcf.gz',
            'samplesTsvLocation': {'uri': f'ag1000g_2La_{pop}_samples.tsv'},
        },
        'displays': [{
            'type': 'LinearMultiSampleVariantDisplay',
            'displayId': f'{trackId}-LinearMultiSampleVariantDisplay',
            # karyotype sorts standard, het, inverted on its own, so the three
            # classes come out as contiguous blocks in dosage order
            'groupBy': 'karyotype',
            'colorBy': 'karyotype',
            # 'draw', not the default 'skip'. Skip mode fills the whole track
            # background with REFERENCE_COLOR and paints only ALT, so a
            # standard-arrangement mosquito is indistinguishable from empty
            # canvas - which is the entire distinction this figure exists to make
            # for the near-fixed population. Drawing reference puts a grey cell at
            # the call's span for those rows, so every mosquito shows a block over
            # the inversion and its shade is its karyotype.
            'referenceDrawingMode': 'draw',
            # No featureColor. The default alt shade is keyed to allele dosage, so
            # a heterozygote paints lighter than a homozygote and the three
            # classes read apart; an override flattens het and hom-alt to one flat
            # color and throws that away.
            'rowHeight': 3,
        }],
    })
cfg['defaultSession'] = {
    'name': 'Ag1000G 2La inversion',
    'views': [{
        'id': 'ld_lgv',
        'type': 'LinearGenomeView',
        'init': {
            'assembly': 'AgamP4',
            'loc': '2L:18,000,000-45,000,000',
            'tracks': [t for t, _ in karyo.values()] + ['ld_cmgam', 'ld_gagam'],
        },
    }],
}
json.dump(cfg, open(path, 'w'), indent=2)
PY

echo
echo "Built $(pwd)/jbrowse2/config.json, opening on 2L:18,000,000-45,000,000."
echo "The top track is the arrangement itself, one row per mosquito, grouped by"
echo "population and karyotype. Below it the Cameroon LD panel is one block from"
echo "~20.5 to ~42.2 Mb and white outside it, and the Gabon panel is blank there,"
echo "because that population is near-fixed for the standard arrangement - which"
echo "is the same thing the karyotype table above says, read off the correlation"
echo "instead of off the calls. Switch either LD track to D' via its track menu to"
echo "see the tradeoff: brighter cells, but a tinted background that blurs the"
echo "block's edges. Serve it, e.g.:"
echo "  npx --yes serve $(pwd)/jbrowse2"
