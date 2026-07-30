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
# Requires: plink (1.9, NOT plink2 - see below), htslib (bgzip, tabix),
#           samtools, curl, awk, python3.
#           Debian/Ubuntu ship 1.9 as the `plink1.9` binary (the `plink`
#           package is 1.07), so there: PLINK=plink1.9 bash scripts/...
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

# plink 1.9 is required rather than plink2, for two reasons worth knowing:
#   * plink2 removed --r2. It splits into --r2-phased / --r2-unphased and
#     refuses to guess which you meant.
#   * plink 1.9's `--r2 dprime` does not just add a column. The modifier
#     switches r2 itself from a dosage correlation to the haplotype-frequency
#     estimate (this is documented only in plink2's help text, describing 1.9).
#     That is the statistic we want, and it is what the DP column pairs with.
# The .ld column layout below is also what PlinkLDTabixAdapter parses.
LD_FLAGS=(--r2 dprime --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0)

PLINK="${PLINK:-plink}"
for tool in "$PLINK" bgzip tabix samtools curl python3; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done
if "$PLINK" --version 2>&1 | grep -q "PLINK v2"; then
  echo "error: '$PLINK' resolves to plink2, which has no --r2. Need plink 1.9." >&2
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
fetch "$AR1/samples/samples.kdr.txt" samples.kdr.txt
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
  "$PLINK" --vcf common.vcf --double-id --allow-extra-chr --keep-allele-order \
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
    "probe.$1.$4.ld"
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
    --extract "grid.$4.snplist" --keep-allele-order "${LD_FLAGS[@]}" \
    --out "$4" >/dev/null 2>&1
  # tabix needs the A-side sorted; the header row is kept and skipped with -S 1
  { head -1 "$4.ld" | awk '{$1=$1}1' OFS='\t'
    tail -n +2 "$4.ld" | awk '{$1=$1}1' OFS='\t' | sort -k1,1 -k2,2n
  } | bgzip > "$4.ld.gz"
  tabix -s 1 -b 2 -e 2 -S 1 -f "$4.ld.gz"
  echo "  $4: $(wc -l < "grid.$4.snplist") SNPs, $(( $(zcat "$4.ld.gz" | wc -l) - 1 )) pairs, $(du -h "$4.ld.gz" | cut -f1)"
}

echo
echo "building LD tracks..."
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

# ── Assembly and JBrowse ────────────────────────────────────────────────────
zcat AgamP4.fa.gz | bgzip > AgamP4.fa.bgz
samtools faidx AgamP4.fa.bgz

if command -v jbrowse >/dev/null; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi
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

# The CLI has no LDTrack workflow (and would not recognize a .ld.gz), so the LD
# tracks are written straight into the config. D' rather than r2 is the whole
# reason this figure is legible - see the probe table above.
python3 - jbrowse2/config.json <<'PY'
import json, sys

path = sys.argv[1]
cfg = json.load(open(path))
names = {
    'ld_cmgam': "Cameroon (CMgam)",
    'ld_gagam': "Gabon (GAgam)",
}
cfg['tracks'] = [t for t in cfg['tracks'] if t['trackId'] not in names]
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
cfg['defaultSession'] = {
    'name': 'Ag1000G 2La inversion',
    'views': [{
        'id': 'ld_lgv',
        'type': 'LinearGenomeView',
        'init': {
            'assembly': 'AgamP4',
            'loc': '2L:18,000,000-45,000,000',
            'tracks': ['ld_cmgam', 'ld_gagam'],
        },
    }],
}
json.dump(cfg, open(path, 'w'), indent=2)
PY

echo
echo "Built $(pwd)/jbrowse2/config.json, opening on 2L:18,000,000-45,000,000."
echo "The top panel (Cameroon) is one block from ~20.5 to ~42.2 Mb and white"
echo "outside it; the bottom panel (Gabon) is blank, because that population is"
echo "fixed for one arrangement. Switch either track to D' via its track menu to"
echo "see the tradeoff: brighter cells, but a tinted background that blurs the"
echo "block's edges. Serve it, e.g.:"
echo "  npx --yes serve $(pwd)/jbrowse2"
