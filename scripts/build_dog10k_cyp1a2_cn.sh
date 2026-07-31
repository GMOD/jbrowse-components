#!/usr/bin/env bash
#
# Reproducibly build the CYP1A2 copy-number tracks that
# website/docs/tutorials/dog10k_lof.md reads alongside its nonsense allele.
#
# The Dog10K paper reports that half the collection carries three or more copies
# of CYP1A2 (Meadows et al. 2023, Fig 10a). Those QuicK-mer2 estimates were
# never released. Checked again, because the obvious question is whether the
# lab's own copy-number calls can just be read instead: the Dog10K share
# (kiddlabshare.med.umich.edu/dog10K) publishes SNVs/indels, Manta SVs, the
# imputation panel, CRAMs, callability masks and sample tables, and no copy
# number at all, while public-data/QuicK-mer/ holds fastCN and QuicK-mer
# REFERENCE bundles (canFam3.1) rather than results. So running either tool
# means every read of every sample. Read depth over one locus gets to the same
# place for a fraction of the cost, because the share publishes 15 CRAMs with
# their indexes: only the reads over this gene have to be fetched.
#
# Three things decide whether the result reads as copy number rather than as
# noise, and all three are measured rather than assumed:
#
#   - Window size. Depth in a window is a read count, so its spread is counting
#     noise: 500 bp windows came out at 21-24% CV (+-0.5 copies at CN 2, which
#     looks like wobble rather than an integer), 2 kb at 13%, 5 kb at 7-10%. At
#     5 kb every window of a copy-number-two dog rounds to 2, which is what
#     lets the output be an integer copy number rather than a trace.
#
#     Review asked for finer detail than 5 kb, so the same measurement was run
#     on the callset estimate over the collection's own flanks, where the answer
#     is copy number two by construction: the fraction of baseline windows that
#     round off two is 3.8% at 5 kb, 12.1% at 2.5 kb, 13.7% at 2 kb and 21.4% at
#     1 kb. Halving the window triples the speckle in a lane whose whole content
#     is a flat baseline, so the window is still 5 kb. What changed is that it
#     SLIDES: the estimate is taken over WIDTH but stepped by STEP, and each
#     block painted is the middle STEP of its window. Resolution is STEP, noise
#     is WIDTH's, and an element edge lands within a kilobase of where it is
#     instead of snapping to a 5 kb grid. WIDTH/STEP must be odd so there is a
#     middle.
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
START=38205000
END=38400000
# Estimate over WIDTH, paint the middle STEP of it. See the window-size note
# above; WIDTH/STEP is odd on purpose.
WIDTH=5000
STEP=1000
# Everything outside these is flanking sequence.
FLANK_LEFT_END=38245000
FLANK_RIGHT_START=38275000
# ...but only the flank within these bands is the DENOMINATOR. The drawn window
# is wide enough now to hold other copy-number-variable loci, and a dog whose
# own normalization came from one of them would have every window over this gene
# scaled by an unrelated event. The bands are the sequence either side of the
# element, which is what the region used to be in its entirety.
#
# The region's left edge is where it is because the estimate degrades below it:
# over 38,160,000-38,205,000 (tried) 3-6% of dogs call copy number one in every
# window, against 0.1% on the right, and the windows there are the ones
# MINUNIQUE drops. That is the reference, not the dogs.
NORM_LEFT_START=38210000
NORM_RIGHT_END=38340000
# A window with less unique sequence than this (of WIDTH) says more about the
# repeat annotation than about the dog, so it is dropped rather than drawn as a
# dip.
MINUNIQUE=1000

# ── Why the painting has holes in it ────────────────────────────────────────
# A window the estimate cannot make paints NOTHING. Copy number two is grey and
# the display has no background of its own, so a run of dropped windows reads as
# a white stripe through every row of the figure, which looks exactly like a
# rendering glitch and has been reported as one. It is not: filling those
# windows grey would assert a measurement that was not made, over the one part
# of the flank where the depth is known to be untrustworthy.
#
# Three filters drop a window, and it is worth knowing which one owns which
# hole, because only the first two are about the reference:
#
#   - MINUNIQUE, above: too little sequence RepeatMasker left alone.
#   - MINSITES, in the callset pass: no dog had enough called sites in it.
#   - FLANK_TOLERANCE, in both paintings: a flank window whose median across the
#     whole collection is not two is measuring the reference rather than any
#     dog. This one is the widest hole in the figure.
#
# The stripe at chr30:38,289,000-38,293,000 is FLANK_TOLERANCE. Under it is a
# 1.4 kb CpG island, chr30:38,290,164-38,291,553, which the cpgIslandExt track
# written at the end of this script draws: its two central kilobases are 81% and
# 76% GC, which is Illumina depth dropout in every canid. A 5 kb estimate
# stepped by 1 kb carries those two kilobases into four painted blocks, which is
# the width of the stripe.
#
# The alternative was checked rather than assumed. Recomputing unique bp per
# sliding window over the whole region puts only the blocks at 38,224,000 and
# 38,266,000 under MINUNIQUE, and those are exactly the two other gaps in the
# CRAM painting. Nothing near 38,289,000 is repeat-limited.

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
    | awk -v chrom="$CHROM" -v start="$START" -v end="$END" -v step="$STEP" \
          -v width="$WIDTH" -v minuniq="$MINUNIQUE" -v flankl="$FLANK_LEFT_END" \
          -v flankr="$FLANK_RIGHT_START" -v norml="$NORM_LEFT_START" \
          -v normr="$NORM_RIGHT_END" '
      BEGIN { getline mask < "mask.txt" }
      # depth only over positions RepeatMasker left alone, summed per STEP; a
      # window is then STEPS of them, so the same pass serves any width
      substr(mask, $2 - start + 1, 1) == "1" {
        b = int(($2 - start) / step)
        sum[b] += $3
        uniq[b]++
      }
      END {
        span = int(width / step)
        nsub = int((end - start) / step)
        nb = 0
        for (b = 0; b + span <= nsub; b++) {
          ws = 0
          wu = 0
          for (k = 0; k < span; k++) {
            ws += sum[b + k]
            wu += uniq[b + k]
          }
          if (wu >= minuniq) {
            # the middle STEP of the window is what this estimate paints
            pos[nb] = start + (b + int(span / 2)) * step
            rate[nb] = ws / wu
            nb++
          }
        }
        nf = 0
        for (i = 0; i < nb; i++) {
          if ((pos[i] < flankl && pos[i] >= norml) ||
              (pos[i] >= flankr && pos[i] < normr)) {
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
          printf "%s\t%d\t%d\t%.3f\n", chrom, pos[i], pos[i] + step,
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
  awk -v s="$SAMPLE" -v b="$BREED" -v l="$FLANK_LEFT_END" -v r="$FLANK_RIGHT_START" \
      -v nl="$NORM_LEFT_START" -v nr="$NORM_RIGHT_END" '
    $2 >= 38250000 && $3 <= 38272000 { e += $4; en++ }
    ($3 <= l && $2 >= nl) || ($2 >= r && $3 <= nr) { f += $4; ff += $4 * $4; fn++ }
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
python3 - "$FLANK_LEFT_END" "$FLANK_RIGHT_START" "$NORM_LEFT_START" "$NORM_RIGHT_END" <<'PY'
import glob, os, statistics, sys

flank_left_end, flank_right_start = int(sys.argv[1]), int(sys.argv[2])
norm_left_start, norm_right_end = int(sys.argv[3]), int(sys.argv[4])
# How far a flank window's median may sit from two before it is read as an
# artifact: well inside rounding's half copy, well outside the 7-10% spread a
# single window carries. What this drops is drawn as a hole, not as two -- see
# the note beside MINUNIQUE.
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
    normalizing = ((end <= flank_left_end and start >= norm_left_start)
                   or (start >= flank_right_start and end <= norm_right_end))
    if normalizing and abs(median - 2) > FLANK_TOLERANCE:
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

python3 - "$CHROM" "$STEP" "$WIDTH" "$FLANK_LEFT_END" "$FLANK_RIGHT_START" \
        "$NORM_LEFT_START" "$NORM_RIGHT_END" <<'PY'
import collections, glob, json, os, statistics, sys

chrom, STEP, WIDTH = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
flank_left_end, flank_right_start = int(sys.argv[4]), int(sys.argv[5])
norm_left_start, norm_right_end = int(sys.argv[6]), int(sys.argv[7])
SPAN = WIDTH // STEP
# see the note beside MINUNIQUE for what this drops and how it reads
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

# Sites bucketed by STEP, so a sliding window is SPAN consecutive buckets. The
# whole matrix is 1,987 dogs by every called site in a quarter megabase, which
# does not want to be a Python list of lists; buckets are held one at a time and
# the denominator is accumulated as a per-dog depth histogram, which gives the
# same exact median as pooling every flank site would.
def is_flank(window):
    return window + STEP <= flank_left_end or window >= flank_right_start

def is_normalizing(window):
    return ((window + STEP <= flank_left_end and window >= norm_left_start)
            or (window >= flank_right_start and window + STEP <= norm_right_end))

buckets = collections.defaultdict(list)
flank_hist = [collections.Counter() for _ in samples]
for line in open('cohort.dp'):
    fields = line.rstrip('\n').split('\t')
    window = int(fields[0]) // STEP * STEP
    row = [-1 if value == '.' else int(value) for value in fields[1:]]
    buckets[window].append(row)
    if is_normalizing(window):
        for i, value in enumerate(row):
            if value >= 0:
                flank_hist[i][value] += 1

def histogram_median(counter):
    total = sum(counter.values())
    if total == 0:
        return 0
    ordered = sorted(counter.items())
    wanted = [(total - 1) // 2, total // 2]
    picked = []
    seen = 0
    for value, count in ordered:
        while picked.__len__() < 2 and wanted[len(picked)] < seen + count:
            picked.append(value)
        seen += count
    return sum(picked) / 2

denominators = [histogram_median(h) for h in flank_hist]

# Each dog is normalized by its own flank depth, exactly as in the CRAM pass, so
# nothing depends on a coverage figure from the sample table.
starts = sorted(buckets)
cn = [{} for _ in samples]
for b in range(len(starts) - SPAN + 1):
    span_starts = starts[b:b + SPAN]
    # only a run of SPAN buckets that really is contiguous is a window
    if span_starts[-1] - span_starts[0] != (SPAN - 1) * STEP:
        continue
    rows = [row for w in span_starts for row in buckets[w]]
    window = span_starts[SPAN // 2]
    for i, denominator in enumerate(denominators):
        if denominator > 0:
            values = [row[i] for row in rows if row[i] >= 0]
            if len(values) >= MINSITES:
                cn[i][window] = 2 * statistics.median(values) / denominator

windows = sorted({w for c in cn for w in c})
cohort_median = {w: statistics.median([c[w] for c in cn if w in c])
                 for w in windows}
dropped = {w for w in windows
           if is_normalizing(w) and abs(cohort_median[w] - 2) > FLANK_TOLERANCE}
for w in sorted(dropped):
    print('dropped %s:%d-%d: median %.2f across the collection, not two'
          % (chrom, w, w + STEP, cohort_median[w]), file=sys.stderr)

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
                prev[2] = w + STEP
            else:
                if prev:
                    rows.append(prev)
                prev = [chrom, w, w + STEP, value, sample]
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
painted = {min(CN_CAP, r[3]) for r in rows}
print(json.dumps([{'label': cn_label(cn), 'color': 'rgb(%s)' % cn_color(cn)}
                  for cn in sorted(painted)], indent=2))
PY

bgzip -f dog10k_cyp1a2_cohort_cn.bed
tabix -f -p bed dog10k_cyp1a2_cohort_cn.bed.gz

# ── A few named animals, whole groups at a time ─────────────────────────────
# The paper's presentation of the neighbouring SLC28A3 expansion (Meadows et al.
# 2023, Fig 11a) is the complement to the collection painting: nine named
# animals, rows thick enough that the element's extent in one of them is
# readable. This writes that panel out of the same file -- a subset of its rows
# with the sample column rewritten to a label.
#
# Whole groups, not picked animals: every canid of that breed in the collection,
# which is what makes "every one of these carries it" a statement the panel can
# support. Which groups comes off the per-breed table this prints -- two where
# the whole group is expanded, one that segregates, one at copy number two
# throughout.
#
# Sample-id prefix, row label, and how many animals to take (0 = all), in the
# order the panel stacks them. The wolves are capped to the four the SNV figure
# draws, so both figures show the same wolves.
PANEL_GROUPS="
CLUPGR	Wolf	4
GOLD	Golden Retriever	0
LABR	Labrador Retriever	0
BOXR	Boxer	0
"

PANEL_GROUPS="$PANEL_GROUPS" python3 - "$STEP" <<'PY'
import collections, gzip, json, os, statistics, sys

STEP = int(sys.argv[1])
groups = [line.split('\t') for line in
          os.environ['PANEL_GROUPS'].strip().split('\n')]

# Windows rather than the merged segments the file carries, so a panel row can be
# re-merged after the rows around it are dropped. The color travels with the copy
# number instead of being recomputed, which is what keeps the panel and the
# collection painting the same picture of the same animals.
windows = collections.defaultdict(dict)
for line in gzip.open('dog10k_cyp1a2_cohort_cn.bed.gz', 'rt'):
    f = line.split('\t')
    chrom = f[0]
    for w in range(int(f[1]), int(f[2]), STEP):
        windows[f[9]][w] = (int(f[10]), f[8])

# The element is where the collection itself sits above two, the same definition
# the collection painting reports its percentage over.
median = {w: statistics.median([row[w][0] for row in windows.values()
                                if w in row])
          for w in sorted({w for row in windows.values() for w in row})}
element = [w for w, m in median.items() if m >= 2.5]
over = {s: max(cn for w, (cn, _) in row.items() if w in element)
        for s, row in windows.items()}

# Every breed and population with enough animals to say anything about, and what
# each animal carries over the element. This is the evidence for which groups the
# panel draws, so it is printed rather than left in a comment: a breed whose
# animals are all expanded, or all at two, is a statement the panel can make, and
# this is what says which breeds those are.
breed = {}
for i, line in enumerate(open('samples.txt')):
    f = line.rstrip('\n').split('\t')
    if i:
        breed[f[0]] = f[1]
by_breed = collections.defaultdict(list)
for sample in windows:
    by_breed[breed[sample]].append(over[sample])
print()
print('copy number over the element per breed or population (>= 5 animals):')
for name, values in sorted(by_breed.items(),
                           key=lambda kv: -statistics.mean(kv[1])):
    if len(values) >= 5:
        print('  %-34s n=%-4d %s' % (name, len(values), sorted(values)))

rows = []
order = []
for prefix, label, limit in groups:
    samples = sorted(s for s in windows if s.startswith(prefix))
    samples = samples[:int(limit)] if int(limit) else samples
    if not samples:
        print('no samples matched %s' % prefix, file=sys.stderr)
        sys.exit(1)
    for i, sample in enumerate(samples, 1):
        # Numbered within the group rather than carrying the Dog10K id, so the
        # row labels read the same as the SNV figure's, where these breeds also
        # appear. Gaps in the ids (there is no GOLD000006) close.
        row_label = '%s %d' % (label, i)
        order.append(row_label)
        segment = None
        for w in sorted(windows[sample]):
            cn, color = windows[sample][w]
            if segment and segment[1] == w and segment[3] == cn:
                segment[1] = w + STEP
            else:
                if segment:
                    rows.append(segment)
                segment = [w, w + STEP, color, cn, row_label]
        rows.append(segment)

rows.sort(key=lambda r: r[0])
with open('dog10k_cyp1a2_breed_cn.bed', 'w') as fh:
    for start, end, color, cn, row_label in rows:
        fh.write('\t'.join([chrom, str(start), str(end), 'CN %d' % cn, '0', '.',
                            str(start), str(end), color, row_label,
                            str(cn)]) + '\n')
print()
print('%d painted segments across the %d animals of the panel'
      % (len(rows), len(order)))
print('rowOrder slot for the panel display, paste into the track config:')
print(json.dumps(order, indent=2))
PY

bgzip -f dog10k_cyp1a2_breed_cn.bed
tabix -f -p bed dog10k_cyp1a2_breed_cn.bed.gz

# ── CpG islands ─────────────────────────────────────────────────────────────
# Drawn beside the paintings so the widest hole in them has its cause on screen
# rather than in this comment: see the note beside MINUNIQUE. Same UCSC API the
# repeat mask comes from, so this still downloads no genome.
curl -fsSL "$UCSC_API/getData/track?genome=canFam4;track=cpgIslandExt;chrom=$CHROM;start=$START;end=$END" \
  > cpg.json
python3 - <<'PY'
import json

items = sorted(json.load(open('cpg.json'))['cpgIslandExt'],
               key=lambda i: i['chromStart'])
with open('dog10k_cyp1a2_cpg.bed', 'w') as fh:
    for it in items:
        fh.write('\t'.join([it['chrom'], str(it['chromStart']),
                            str(it['chromEnd']), it['name'], '0', '.',
                            '%.1f' % it['perGc'], '%.2f' % it['obsExp'],
                            str(it['length'])]) + '\n')
print()
print('%d CpG islands over the window' % len(items))
PY

bgzip -f dog10k_cyp1a2_cpg.bed
tabix -f -p bed dog10k_cyp1a2_cpg.bed.gz

echo
echo "Wrote $(pwd)/dog10k_cyp1a2_cn.bed.gz, one painted row per CRAM dog,"
echo "     $(pwd)/dog10k_cyp1a2_cohort_cn.bed.gz, one per canid in the callset,"
echo "     $(pwd)/dog10k_cyp1a2_breed_cn.bed.gz, the named panel of that file,"
echo "     $(pwd)/dog10k_cyp1a2_cpg.bed.gz, the CpG islands under the window."
echo "Load each as a BedTabixAdapter under a LinearMultiRowFeatureDisplay, and"
echo "check its legend and rowOrder slots against the blocks printed above."
