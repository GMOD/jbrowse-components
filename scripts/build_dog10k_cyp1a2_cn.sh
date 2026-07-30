#!/usr/bin/env bash
#
# Reproducibly build the CYP1A2 copy-number tracks that
# website/docs/tutorials/dog10k_lof.md reads alongside its nonsense allele.
#
# The Dog10K paper reports that half the collection carries three or more copies
# of CYP1A2 (Meadows et al. 2023, Fig 10a). Those QuicK-mer2 estimates were
# never released, and QuicK-mer2 itself needs a genome-wide k-mer index and
# every read of a sample (see scripts/build_dog10k_quickmer2_cn.sh). Read depth
# over one locus gets to the same place for a fraction of the cost, because the
# Dog10K share publishes 15 CRAMs with their indexes: only the reads over this
# gene have to be fetched.
#
# Three things decide whether the result reads as copy number rather than as
# noise, and all three are measured rather than assumed:
#
#   - Window size. Depth in a window is a read count, so its spread is counting
#     noise: 500 bp windows came out at 21-24% CV (+-0.5 copies at CN 2, which
#     looks like wobble rather than an integer), 2 kb at 13%, 5 kb at 7-10%. At
#     5 kb every window of a copy-number-two dog rounds to 2, which is what
#     lets the output be an integer copy number rather than a trace.
#   - Repeat positions. Depth is counted only over positions RepeatMasker did
#     not call, the same restriction QuicK-mer2's unique k-mers make.
#   - The denominator. Normalizing against the sample table's mean autosomal
#     coverage puts the flanks at 2.5, not 2, because that mean is measured over
#     every position while this depth is measured over unique positions, where
#     coverage runs higher. The window's own flanks are copy number two in every
#     dog here, so they are the denominator instead. A flank window that comes
#     out off two across the whole collection is measuring the reference and is
#     dropped, which is the only cross-sample step in the script.
#
# The output is the paper's own presentation: each window rounded to an integer
# copy number and colored by it, adjacent equal windows merged. That is a BED9
# painting, one row per dog. The palette is NOT QuicK-mer2's
# make-colortrack-fordisplay.py one (2 black, 3 dark blue, 4 blue, 5 cyan, 6
# green): see CN_COLOR below for why a filled block wants a light baseline where
# a line plot wants black, and why the ramp saturates rather than running to the
# highest call.
#
# Fifteen dogs is every CRAM the share publishes, but not every dog it has depth
# for. The SNV callset carries a per-sample DP at every site for all 1,987
# canids, and the same ratio -- depth over the element against that dog's own
# flank depth -- can be taken from it. That is a different measurement (only at
# variant sites, and only where a variant was called) so the script checks it
# against the fifteen rather than assuming: per 5 kb window it comes out at
# r = 0.97 with no bias, which is what earns the second painting over the whole
# collection.
#
# Requires: samtools (>= 1.10, with libcurl support), bcftools (with libcurl),
#           htslib (bgzip, tabix), curl, python3, awk.
# Usage:    bash scripts/build_dog10k_cyp1a2_cn.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_cyp1a2_cn_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
CRAMS=$SHARE/cram-share
SNVS=$SHARE/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
UCSC_API=https://api.genome.ucsc.edu
# CYP1A2 is chr30:38,258,389-38,264,108 on UU_Cfam_GSD_1.0 (UCSC canFam4). The
# window is wide enough that the copy-number element's edges and 30 kb of
# copy-number-two flanking sequence are both in frame.
CHROM=chr30
START=38220000
END=38300000
BIN=5000
# Everything outside these is flanking sequence, which is where each sample's
# own normalization comes from.
FLANK_LEFT_END=38245000
FLANK_RIGHT_START=38275000
# A window with less unique sequence than this says more about the repeat
# annotation than about the dog, so it is dropped rather than drawn as a dip.
MINUNIQUE=1000

# The published CRAMs, in the order the figure stacks them: the breed with no
# expansion first, then the breeds that carry one. Paths are relative to
# cram-share/, which sorts them into dated release directories.
CRAM_PATHS="
GREE000003	2022-09-08/GREE000003.st.cram	Greenland Dog
ESSP000001	2022-10-10/ESSP000001.st.cram	Springer Spaniel 1
ESSP000002	2022-10-10/ESSP000002.st.cram	Springer Spaniel 2
ESSP000003	2022-10-10/ESSP000003.st.cram	Springer Spaniel 3
BOPD000001	2022-09-08/BOPD000001.st.cram	Pointing Dog 1
BOPD000002	2022-09-08/BOPD000002.st.cram	Pointing Dog 2
BOPD000003	2022-09-08/BOPD000003.st.cram	Pointing Dog 3
BOPD000004	2022-09-08/BOPD000004.st.cram	Pointing Dog 4
BOPD000005	2022-09-08/BOPD000005.st.cram	Pointing Dog 5
BOPD000006	2022-09-08/BOPD000006.st.cram	Pointing Dog 6
BOPD000007	2022-09-08/BOPD000007.st.cram	Pointing Dog 7
BOPD000008	2022-09-08/BOPD000008.st.cram	Pointing Dog 8
CHIH000005	CHIH000005.st.cram	Chihuahua 1
CHIH000006	CHIH000006.st.cram	Chihuahua 2
VILLAZ000004	VILLAZ000004.st.cram	Village dog (Azerbaijan)
"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# CRAM decode needs no reference download: the @SQ lines carry M5 checksums, so
# samtools pulls just the chromosome it touches from the ENA registry and caches
# it here.
export REF_PATH="https://www.ebi.ac.uk/ena/cram/md5/%s"
export REF_CACHE="$PWD/refcache/%2s/%2s/%s"
mkdir -p refcache

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# Chromosome sizes for bedGraphToBigWig come out of a CRAM header, so nothing
# else has to be downloaded to write a bigWig.
[ -f chrom.sizes ] || samtools view -H "$CRAMS/CHIH000005.st.cram" \
  | awk -F'\t' '$1=="@SQ"{n="";l="";for(i=2;i<=NF;i++){if($i~/^SN:/)n=substr($i,4);
    if($i~/^LN:/)l=substr($i,4)} print n"\t"l}' > chrom.sizes

# One bit per position: 1 where RepeatMasker left the reference alone. Taken
# from the UCSC API rather than from a soft-masked reference, so this script
# never downloads a genome.
if [ ! -f mask.txt ]; then
  curl -fsSL "$UCSC_API/getData/track?genome=canFam4;track=rmsk;chrom=$CHROM;start=$START;end=$END" \
    > rmsk.json
  python3 - "$START" "$END" <<'PY'
import json, sys
start, end = int(sys.argv[1]), int(sys.argv[2])
data = json.load(open('rmsk.json'))
items = data.get('rmsk', data.get(data['chrom'], []))
mask = bytearray(b'1') * (end - start)
for it in items:
    lo = max(it['genoStart'], start) - start
    hi = min(it['genoEnd'], end) - start
    for i in range(lo, hi):
        mask[i] = ord('0')
open('mask.txt', 'w').write(mask.decode() + '\n')
kept = mask.count(ord('1'))
print(f'{kept} of {end - start} positions unique ({100 * kept / (end - start):.1f}%)',
      file=sys.stderr)
PY
fi

echo "sample	breed	CN over the element	flank sd"
while IFS=$'\t' read -r SAMPLE PATH_ LABEL; do
  BREED=$(awk -F'\t' -v s="$SAMPLE" 'NR>1 && $1==s {print $2}' samples.txt)

  samtools depth -a -r "$CHROM:$START-$END" "$CRAMS/$PATH_" \
    | awk -v chrom="$CHROM" -v start="$START" -v end="$END" -v bin="$BIN" \
          -v minuniq="$MINUNIQUE" -v flankl="$FLANK_LEFT_END" \
          -v flankr="$FLANK_RIGHT_START" '
      BEGIN { getline mask < "mask.txt" }
      # depth only over positions RepeatMasker left alone
      substr(mask, $2 - start + 1, 1) == "1" {
        b = int(($2 - start) / bin)
        sum[b] += $3
        uniq[b]++
      }
      END {
        nb = 0
        for (b = 0; b * bin < end - start; b++) {
          if (uniq[b] >= minuniq) {
            pos[nb] = start + b * bin
            rate[nb] = sum[b] / uniq[b]
            nb++
          }
        }
        nf = 0
        for (i = 0; i < nb; i++) {
          if (pos[i] < flankl || pos[i] >= flankr) {
            flank[nf++] = rate[i]
          }
        }
        if (nf == 0) {
          print "no flank windows, cannot normalize" > "/dev/stderr"
          exit 1
        }
        # median, so one duplicated window in a flank cannot move it
        for (i = 1; i < nf; i++) {
          v = flank[i]
          for (j = i - 1; j >= 0 && flank[j] > v; j--) {
            flank[j + 1] = flank[j]
          }
          flank[j + 1] = v
        }
        mid = nf % 2 ? flank[int(nf / 2)] : (flank[nf / 2 - 1] + flank[nf / 2]) / 2
        for (i = 0; i < nb; i++) {
          printf "%s\t%d\t%d\t%.3f\n", chrom, pos[i], pos[i] + bin,
            2 * rate[i] / mid
        }
      }' > "cn.$SAMPLE.bedGraph"

  printf '%s\n' "$LABEL" > "label.$SAMPLE"

  if [ ! -s "cn.$SAMPLE.bedGraph" ]; then
    echo "$SAMPLE: no depth over the locus, the CRAM path is wrong" >&2
    exit 1
  fi

  # The element's copy number, and the spread of the flanks around two, which is
  # this estimate's own noise floor: any step smaller than it is not a call.
  awk -v s="$SAMPLE" -v b="$BREED" -v l="$FLANK_LEFT_END" -v r="$FLANK_RIGHT_START" '
    $2 >= 38250000 && $3 <= 38272000 { e += $4; en++ }
    $3 <= l || $2 >= r { f += $4; ff += $4 * $4; fn++ }
    END {
      m = f / fn
      printf "%s\t%s\t%.1f\t%.2f\n", s, b, e / en, sqrt(ff / fn - m * m)
    }' "cn.$SAMPLE.bedGraph"
done <<< "$(printf '%s\n' "$CRAM_PATHS" | grep -v '^$')"

# ── The painting ────────────────────────────────────────────────────────────
# Each window rounded to an integer copy number and colored by it, adjacent
# equal windows merged: QuicK-mer2's own display convention, taken from its
# make-colortrack-fordisplay.py. The trailing sample column is what the
# multi-row display partitions rows on.
#
# One last window filter belongs here rather than in the per-sample pass,
# because it takes the whole collection to state. The flanks are copy number
# two in every dog, which is the assumption that lets them be the denominator.
# A flank window whose median across the collection is not two contradicts it,
# so that window is measuring the reference rather than any dog and is dropped
# from every row. Over this locus it catches one, which sits 15% low in all
# fifteen dogs: rounding absorbs that in fourteen of them and turns it into a
# copy-number-one call in the fifteenth.
python3 - "$FLANK_LEFT_END" "$FLANK_RIGHT_START" <<'PY'
import glob, os, statistics, sys

flank_left_end, flank_right_start = int(sys.argv[1]), int(sys.argv[2])
# How far a flank window's median may sit from two before it is read as an
# artifact: well inside rounding's half copy, well outside the 7-10% spread a
# single window carries.
FLANK_TOLERANCE = 0.2

# ColorBrewer RdBu diverging about copy number two: blue for loss, a light grey
# baseline, red for gain. Same direction and the same two anchor colors as the
# 1000 Genomes copy-number figure's palette (negColor #2166ac at the low end,
# posColor #b2182b), so the two cohort paintings read the same way. Copy number
# two is ~78% of the painted area, so giving the baseline the least ink is what
# lets the expansion read; QuicK-mer2's own black-at-two palette is built for a
# line plot, where two is a thin trace rather than a filled block. Grey rather
# than white, so the baseline stays distinct from a window dropped as
# unmeasurable, which paints nothing.
#
# The ramp saturates at CN_CAP rather than running to the highest call. A ramp
# long enough to give copy number ten its own color has to leave red, and the
# violets it reaches for come back around to the loss end -- a ten and a zero
# read as neighbours. Copy number six and up is 18 canids with no group to them,
# so they share the ramp's last color and keep their measured value in the
# feature name and the copyNumber column. Five stays its own step because that
# is where the tail has structure: 52% of the 63 CLUP wolves reach it against
# 13% of breed dogs, and three of the fifteen CRAM dogs reach it from read depth
# rather than from this callset proxy.
CN_CAP = 6
CN_COLOR_CAP = '103,0,31'
CN_COLOR = {0: '33,102,172', 1: '146,197,222', 2: '224,224,224',
            3: '244,165,130', 4: '214,96,77', 5: '178,24,43'}

def cn_color(cn):
    return CN_COLOR_CAP if cn >= CN_CAP else CN_COLOR[cn]

def cn_label(cn):
    return 'CN %d+' % CN_CAP if cn >= CN_CAP else 'CN %d' % cn

paths = sorted(glob.glob('cn.*.bedGraph'))
cohort = {}
for path in paths:
    for line in open(path):
        chrom, start, end, cn = line.split()
        cohort.setdefault((chrom, int(start), int(end)), []).append(float(cn))

dropped = set()
for window, values in sorted(cohort.items()):
    chrom, start, end = window
    median = statistics.median(values)
    if (end <= flank_left_end or start >= flank_right_start) \
            and abs(median - 2) > FLANK_TOLERANCE:
        dropped.add(window)
        print('dropped %s:%d-%d: median %.2f across the collection, not two'
              % (chrom, start, end, median), file=sys.stderr)

rows = []
for path in paths:
    sample = os.path.basename(path)[3:-9]
    label = open('label.' + sample).read().strip()
    prev = None
    for line in open(path):
        chrom, start, end, cn = line.split()
        start, end = int(start), int(end)
        if (chrom, start, end) not in dropped:
            cn = min(10, max(0, int(round(float(cn)))))
            if prev and prev[2] == start and prev[3] == cn:
                prev[2] = end
            else:
                if prev:
                    rows.append(prev + [label])
                prev = [chrom, start, end, cn]
    if prev:
        rows.append(prev + [label])

rows.sort(key=lambda r: (r[0], r[1]))
with open('dog10k_cyp1a2_cn.bed', 'w') as fh:
    for chrom, start, end, cn, label in rows:
        fh.write('\t'.join([chrom, str(start), str(end), 'CN %d' % cn, '0', '.',
                            str(start), str(end), cn_color(cn), label,
                            str(cn)]) + '\n')
print('%d painted segments across %d dogs' % (len(rows), len(paths)))
PY

bgzip -f dog10k_cyp1a2_cn.bed
tabix -f -p bed dog10k_cyp1a2_cn.bed.gz

# ── The whole collection ────────────────────────────────────────────────────
# The same estimate from the callset's own per-sample DP, which exists for all
# 1,987 canids rather than the fifteen with published reads. One tabix slice of
# a 397 GB VCF, stripped to the depth field.
[ -f dp.vcf.gz ] || {
  bcftools view -r "$CHROM:$START-$END" -Ou "$SNVS" \
    | bcftools annotate -x 'INFO,^FORMAT/DP' -Oz -o dp.vcf.gz.tmp
  mv dp.vcf.gz.tmp dp.vcf.gz
}
bcftools query -l dp.vcf.gz > cohort.samples
bcftools query -f '%POS[\t%DP]\n' dp.vcf.gz > cohort.dp

python3 - "$CHROM" "$BIN" "$FLANK_LEFT_END" "$FLANK_RIGHT_START" <<'PY'
import glob, json, os, statistics, sys

chrom, BIN = sys.argv[1], int(sys.argv[2])
flank_left_end, flank_right_start = int(sys.argv[3]), int(sys.argv[4])
FLANK_TOLERANCE = 0.2
# A window needs this many called sites in a dog before its median depth is a
# measurement rather than a coincidence.
MINSITES = 10

# ColorBrewer RdBu diverging about copy number two: blue for loss, a light grey
# baseline, red for gain. Same direction and the same two anchor colors as the
# 1000 Genomes copy-number figure's palette (negColor #2166ac at the low end,
# posColor #b2182b), so the two cohort paintings read the same way. Copy number
# two is ~78% of the painted area, so giving the baseline the least ink is what
# lets the expansion read; QuicK-mer2's own black-at-two palette is built for a
# line plot, where two is a thin trace rather than a filled block. Grey rather
# than white, so the baseline stays distinct from a window dropped as
# unmeasurable, which paints nothing.
#
# The ramp saturates at CN_CAP rather than running to the highest call. A ramp
# long enough to give copy number ten its own color has to leave red, and the
# violets it reaches for come back around to the loss end -- a ten and a zero
# read as neighbours. Copy number six and up is 18 canids with no group to them,
# so they share the ramp's last color and keep their measured value in the
# feature name and the copyNumber column. Five stays its own step because that
# is where the tail has structure: 52% of the 63 CLUP wolves reach it against
# 13% of breed dogs, and three of the fifteen CRAM dogs reach it from read depth
# rather than from this callset proxy.
CN_CAP = 6
CN_COLOR_CAP = '103,0,31'
CN_COLOR = {0: '33,102,172', 1: '146,197,222', 2: '224,224,224',
            3: '244,165,130', 4: '214,96,77', 5: '178,24,43'}

def cn_color(cn):
    return CN_COLOR_CAP if cn >= CN_CAP else CN_COLOR[cn]

def cn_label(cn):
    return 'CN %d+' % CN_CAP if cn >= CN_CAP else 'CN %d' % cn

samples = [line.strip() for line in open('cohort.samples')]
depths = [{} for _ in samples]
for line in open('cohort.dp'):
    fields = line.rstrip('\n').split('\t')
    window = int(fields[0]) // BIN * BIN
    for i, value in enumerate(fields[1:]):
        if value != '.':
            depths[i].setdefault(window, []).append(int(value))

def is_flank(window):
    return window + BIN <= flank_left_end or window >= flank_right_start

# Each dog is normalized by its own flank depth, exactly as in the CRAM pass, so
# nothing depends on a coverage figure from the sample table.
cn = []
for per_window in depths:
    denominator = statistics.median(
        [d for w, ds in per_window.items() if is_flank(w) for d in ds])
    cn.append({w: 2 * statistics.median(ds) / denominator
               for w, ds in per_window.items() if len(ds) >= MINSITES})

windows = sorted({w for c in cn for w in c})
cohort_median = {w: statistics.median([c[w] for c in cn if w in c])
                 for w in windows}
dropped = {w for w in windows
           if is_flank(w) and abs(cohort_median[w] - 2) > FLANK_TOLERANCE}
for w in sorted(dropped):
    print('dropped %s:%d-%d: median %.2f across the collection, not two'
          % (chrom, w, w + BIN, cohort_median[w]), file=sys.stderr)

# The check that decides whether this second measurement is worth drawing: the
# same windows in the same dogs, read from CRAM depth above.
index = {s: i for i, s in enumerate(samples)}
pairs = []
for path in glob.glob('cn.*.bedGraph'):
    sample = os.path.basename(path)[3:-9]
    if sample in index:
        i = index[sample]
        for line in open(path):
            _, start, _, value = line.split()
            if int(start) in cn[i]:
                pairs.append((float(value), cn[i][int(start)]))
mx = statistics.mean([a for a, _ in pairs])
my = statistics.mean([b for _, b in pairs])
r = (sum((a - mx) * (b - my) for a, b in pairs)
     / (sum((a - mx) ** 2 for a, _ in pairs) ** .5
        * sum((b - my) ** 2 for _, b in pairs) ** .5))
print('callset depth vs CRAM depth over %d shared windows: r = %.3f, '
      'callset runs %+.2f copies high' % (len(pairs), r,
                                          statistics.mean(b - a for a, b in pairs)))

rows = []
for sample, per_window in zip(samples, cn):
    prev = None
    for w in windows:
        if w in per_window and w not in dropped:
            value = min(10, max(0, round(per_window[w])))
            if prev and prev[2] == w and prev[3] == value:
                prev[2] = w + BIN
            else:
                if prev:
                    rows.append(prev)
                prev = [chrom, w, w + BIN, value, sample]
    if prev:
        rows.append(prev)

# Rows are left in sample order: the display sorts them itself, and Dog10K IDs
# carry a breed prefix, so sorted order groups each breed together.
rows.sort(key=lambda r: (r[0], r[1]))
with open('dog10k_cyp1a2_cohort_cn.bed', 'w') as fh:
    for chrom, start, end, value, sample in rows:
        fh.write('\t'.join([chrom, str(start), str(end), 'CN %d' % value, '0',
                            '.', str(start), str(end), cn_color(value), sample,
                            str(value)]) + '\n')

element = [w for w in windows if w not in dropped and cohort_median[w] >= 2.5]
over = [statistics.mean([per[w] for w in element if w in per]) for per in cn]
print('%d painted segments across %d canids' % (len(rows), len(samples)))
print('over the element the collection medians %.2f copies; %d of %d dogs '
      '(%.0f%%) round to three or more'
      % (statistics.median(over), sum(v >= 2.5 for v in over), len(over),
         100 * sum(v >= 2.5 for v in over) / len(over)))

# The display's `legend` config slot restates this palette, because BED9 carries
# a color per feature and nothing to key a category off. Nothing checks the two
# agree, and they have drifted before (the painting was recolored and the legend
# was not), so print the block to paste rather than leaving it to be remembered.
print()
print('legend slot for the copy-number displays, paste into the track config:')
painted = {min(CN_CAP, int(r[3].split()[1])) for r in rows}
print(json.dumps([{'label': cn_label(cn), 'color': 'rgb(%s)' % cn_color(cn)}
                  for cn in sorted(painted)], indent=2))
PY

bgzip -f dog10k_cyp1a2_cohort_cn.bed
tabix -f -p bed dog10k_cyp1a2_cohort_cn.bed.gz

# ── The wild canids on their own ────────────────────────────────────────────
# The same rows, restricted to Canis lupus (CLUP) and Canis latrans (CLAT).
#
# This exists because the comparison cannot be made inside the collection track.
# Wild canids are a few dozen rows against nearly two thousand, so however they
# are marked or grouped there they occupy a thirtieth of the height, and "is
# this group redder than the rest" is a question about the *proportion* of each
# group that is red -- which a reader cannot judge between two bands whose
# heights differ by that much. Given its own track at the same pixel height, the
# small group is drawn at the same scale as the large one and the two are
# directly comparable. No new measurement: it is a strict subset of the file
# written above.
# The split is exact and exhaustive -- every row of the collection lands in one
# file or the other -- so the two together are the collection and neither
# contains the other. Painted as two lanes of equal pixel height, "how much of
# this lane is red" is then the same question asked of both.
zcat dog10k_cyp1a2_cohort_cn.bed.gz \
  | awk -F'\t' '$10 ~ /^(CLUP|CLAT)/' > dog10k_cyp1a2_wild_cn.bed
zcat dog10k_cyp1a2_cohort_cn.bed.gz \
  | awk -F'\t' '$10 !~ /^(CLUP|CLAT)/' > dog10k_cyp1a2_domestic_cn.bed
for part in wild domestic; do
  bgzip -f "dog10k_cyp1a2_${part}_cn.bed"
  tabix -f -p bed "dog10k_cyp1a2_${part}_cn.bed.gz"
  printf '%s %s rows across %s animals\n' \
    "$(zcat "dog10k_cyp1a2_${part}_cn.bed.gz" | wc -l)" "$part" \
    "$(zcat "dog10k_cyp1a2_${part}_cn.bed.gz" | cut -f10 | sort -u | wc -l)"
done

echo
echo "Wrote $(pwd)/dog10k_cyp1a2_cn.bed.gz, one painted row per CRAM dog,"
echo "     $(pwd)/dog10k_cyp1a2_cohort_cn.bed.gz, one per canid in the callset,"
echo "     $(pwd)/dog10k_cyp1a2_wild_cn.bed.gz, the wild canids of that file."
echo "Load each as a BedTabixAdapter under a LinearMultiRowFeatureDisplay, and"
echo "check its legend slot against the block printed above."
