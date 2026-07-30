#!/usr/bin/env bash
#
# Build SLC28A3 copy-number tracks for the Dog10K collection, the counterpart to
# scripts/build_dog10k_cyp1a2_cn.sh at the locus of Meadows et al. 2023 Fig 11.
#
# The paper reports a copy-number element spanning the whole coding sequence of
# SLC28A3, expanded in Grand Basset Griffon Vendeen and basset hound dogs and at
# copy number two in the German Shepherd reference breed. Its QuicK-mer2
# estimates were never released.
#
# Two routes to them, and this script runs both:
#
#   1. The callset's own per-sample DP, which exists for all 1,987 canids. One
#      tabix slice of the 397 GB SNV VCF, stripped to the depth field, and each
#      dog normalized against its own flanks. Minutes, and it is what the figure
#      draws. Same measurement as the CYP1A2 script's collection pass, where it
#      is validated against read depth at r = 0.97 per window -- that check
#      cannot be repeated here, since all fifteen dogs with published CRAMs are
#      copy number two at this locus and there is no variance to correlate.
#   2. Reads, for the six panel dogs that have an SRA run. None of them is among
#      the published CRAMs, so this route starts from raw runs. Aligning whole
#      runs takes over two hours each (measured: 45k reads/s on 12 cores, 360M
#      reads per run). Instead every read is tested against the locus with bbduk
#      and only the ~0.05% sharing a 31-mer with it are aligned, which puts a
#      sample at about twenty minutes, bounded by fastq-dump. The bait is
#      repeat-masked, so copy number is read from the locus's unique sequence
#      only: the same restriction QuicK-mer2 makes, and the reason depth below is
#      counted over unmasked reference positions rather than over whole bins.
#
# Route 2 validated on 11% of GBGV000003's reads: flanks land on copy number two
# and the element peaks at 6.8, against the copy number of six the paper infers
# for that dog, with edges matching the SV callset's duplication at
# chr1:75,578,115-75,714,214 -- which is where route 1 puts the element too.
#
# Requires: route 1, bcftools (with libcurl), htslib (bgzip, tabix), curl,
#           python3. Route 2 adds sra-toolkit (fastq-dump), bbmap (bbduk.sh),
#           minimap2, samtools, awk, and UCSC's bedGraphToBigWig, plus ~35 GB of
#           scratch: the reference, its minimap2 index, and one run at a time.
#           minimap2 holds the index in ~11 GB of RAM.
# Usage:    bash scripts/build_dog10k_slc28a3_cn.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_slc28a3_cn_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
SNVS=$SHARE/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
UCSC=https://hgdownload.soe.ucsc.edu/goldenPath/canFam4/bigZips
SRA=https://sra-pub-run-odp.s3.amazonaws.com/sra
# SLC28A3 is chr1:75,622,825-75,700,238 on UU_Cfam_GSD_1.0 (UCSC canFam4). The
# duplications the Dog10K SV callset carries here run from about 75,578,000 to
# 75,758,000, so the window adds ~150 kb either side of that: the flanks are
# where the normalization has to come out at two.
CHROM=chr1
START=75400000
END=75950000
BIN=1000
# Alignments below this mapping quality are dropped: at a locus that is
# duplicated in some samples, a multi-mapping read says nothing about how many
# copies this dog has.
MINMAPQ=20
# A bin with less unique sequence than this says more about the repeat
# annotation than about the sample, so it is left out rather than drawn as a dip.
MINUNIQUE=200
# Everything outside these is flanking sequence, which is copy number two in
# every dog in the panel and is what each sample is normalized against.
FLANK_LEFT_END=75500000
FLANK_RIGHT_START=75850000

# The named panel route 1 paints, in the order it stacks: sample-id prefix, row
# label, and how many animals to take (0 = every one of them). The paper's own
# comparison -- the breed that carries the expansion throughout, the breed that
# segregates for it, and the copy-number-two breed the reference comes from --
# except that every animal of each is drawn rather than a chosen few.
PANEL_GROUPS="
GBGV	Grand Basset Griffon Vendeen	0
BASS	Basset Hound	0
GRSD	German Shepherd Dog	0
"

# Route 2 is the same panel restricted to the animals with an SRA run: GBGV000004
# and GBGV000005 have none, and the basset hounds beyond the first two are not in
# the paper's figure.
RUNS="
GRSD000001	SRR12330320
GBGV000001	SRR12330331
GBGV000002	SRR12330330
GBGV000003	SRR12330329
BASS000001	SRR12330169
BASS000002	SRR12330158
"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# ── Route 1: the whole collection, from callset depth ───────────────────────
# Windows of COHORT_BIN rather than the BIN above: a window's depth is a read
# count, so its spread is counting noise, and 5 kb is where a copy-number-two dog
# rounds to two in every window (7-10% CV, against 21-24% at 500 bp). The panel
# below can afford 1 kb because it is reading whole runs rather than the sites a
# variant was called at.
COHORT_BIN=5000
# The duplication the SV callset carries here, which is also where route 2 puts
# the element's edges. Used only to summarize a dog in one number; the painting
# is per window and takes no interval.
ELEMENT_START=75578115
ELEMENT_END=75714214

[ -f dp.vcf.gz ] || {
  bcftools view -r "$CHROM:$START-$END" -Ou "$SNVS" \
    | bcftools annotate -x 'INFO,^FORMAT/DP' -Oz -o dp.vcf.gz.tmp
  mv dp.vcf.gz.tmp dp.vcf.gz
}
bcftools query -l dp.vcf.gz > cohort.samples
bcftools query -f '%POS[\t%DP]\n' dp.vcf.gz > cohort.dp

PANEL_GROUPS="$PANEL_GROUPS" python3 - "$CHROM" "$COHORT_BIN" \
    "$FLANK_LEFT_END" "$FLANK_RIGHT_START" "$ELEMENT_START" "$ELEMENT_END" \
    <<'PY'
import collections, json, os, statistics, sys

chrom, BIN = sys.argv[1], int(sys.argv[2])
flank_left_end, flank_right_start = int(sys.argv[3]), int(sys.argv[4])
element_start, element_end = int(sys.argv[5]), int(sys.argv[6])
groups = [line.split('\t') for line in
          os.environ['PANEL_GROUPS'].strip().split('\n')]
# How far a flank window's median may sit from two before it is read as an
# artifact of the reference rather than a measurement of any dog.
FLANK_TOLERANCE = 0.2
# A window needs this many called sites in a dog before its median depth is a
# measurement rather than a coincidence.
MINSITES = 10

# ColorBrewer RdBu diverging about copy number two, the same palette as the
# CYP1A2 paintings so the two loci read the same way: blue for loss, a light grey
# baseline that gives the unexpanded majority the least ink, red for gain,
# saturating at CN_CAP rather than running a ramp long enough for the violets to
# come back around to the loss end.
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

# Each dog against its own flanks, so nothing depends on a coverage figure from
# the sample table. The flanks have to sit clear of the element or a carrier
# normalizes itself down: flanks reaching to 75.6 Mb put every GBGV a third of a
# copy low, which is why they start 60 kb outside the duplication.
cn = []
for per_window in depths:
    denominator = statistics.median(
        [d for w, ds in per_window.items() if is_flank(w) for d in ds])
    cn.append({w: 2 * statistics.median(ds) / denominator
               for w, ds in per_window.items() if len(ds) >= MINSITES})

windows = sorted({w for c in cn for w in c})
cohort_median = {w: statistics.median([c[w] for c in cn if w in c])
                 for w in windows}
# A window the whole collection reads below two is measuring the reference, not
# any dog: a deletion carried by half the canids alive is not what this is.
# Elevation is the opposite -- that is the signal -- so above two only counts
# against a flank window, where it would break the normalization. Painting
# nothing is the honest output for a window that cannot be measured, and the four
# it catches here are the vertical blue stripes that otherwise run through the
# collection lane at the same weight as the duplication. (The CYP1A2 script tests
# flanks only; nothing there is low enough for the difference to show.)
dropped = {w for w in windows
           if cohort_median[w] < 2 - FLANK_TOLERANCE
           or (is_flank(w) and cohort_median[w] > 2 + FLANK_TOLERANCE)}
for w in sorted(dropped):
    print('dropped %s:%d-%d: median %.2f across the collection, not two'
          % (chrom, w, w + BIN, cohort_median[w]), file=sys.stderr)

def paint(labelled_rows, path):
    rows = []
    for label, per_window in labelled_rows:
        segment = None
        for w in windows:
            if w in per_window and w not in dropped:
                value = min(10, max(0, round(per_window[w])))
                if segment and segment[1] == w and segment[2] == value:
                    segment[1] = w + BIN
                else:
                    if segment:
                        rows.append(segment)
                    segment = [w, w + BIN, value, label]
        if segment:
            rows.append(segment)
    rows.sort(key=lambda r: r[0])
    with open(path, 'w') as fh:
        for start, end, value, label in rows:
            fh.write('\t'.join([chrom, str(start), str(end), 'CN %d' % value,
                                '0', '.', str(start), str(end),
                                cn_color(value), label, str(value)]) + '\n')
    return rows

rows = paint(list(zip(samples, cn)), 'dog10k_slc28a3_cohort_cn.bed')
print('%d painted segments across %d canids' % (len(rows), len(samples)))

element = [w for w in windows
           if w not in dropped and element_start <= w < element_end]
over = [statistics.median([c[w] for w in element if w in c]) for c in cn]
print('over the element the collection medians %.2f copies; %d of %d canids '
      '(%.1f%%) round to three or more'
      % (statistics.median(over), sum(v >= 2.5 for v in over), len(over),
         100 * sum(v >= 2.5 for v in over) / len(over)))

# The named panel: the paper's own comparison, every animal of each breed rather
# than picked ones, so "every one of these carries it" is a claim it can make.
index = {s: i for i, s in enumerate(samples)}
panel = []
order = []
for prefix, label, limit in groups:
    picked = sorted(s for s in samples if s.startswith(prefix))
    picked = picked[:int(limit)] if int(limit) else picked
    if not picked:
        print('no samples matched %s' % prefix, file=sys.stderr)
        sys.exit(1)
    for i, sample in enumerate(picked, 1):
        # Numbered within the group rather than carrying the Dog10K id: gaps
        # close (GRSD000001 is not in the callset) and the label names the breed,
        # which is the thing being compared.
        row_label = '%s %d' % (label, i)
        order.append(row_label)
        panel.append((row_label, cn[index[sample]]))
        print('  %-14s %-32s median %.2f over the element'
              % (sample, row_label,
                 statistics.median([cn[index[sample]][w] for w in element
                                    if w in cn[index[sample]]])))
rows = paint(panel, 'dog10k_slc28a3_breed_cn.bed')
print('%d painted segments across the %d animals of the panel'
      % (len(rows), len(order)))

# Nothing checks that a display's legend still matches what the painting uses,
# and the two have drifted before, so print the blocks to paste rather than
# leaving them to be remembered.
print()
print('legend slot for the copy-number displays:')
painted = {min(CN_CAP, r[2]) for r in rows}
print(json.dumps([{'label': cn_label(cn), 'color': 'rgb(%s)' % cn_color(cn)}
                  for cn in sorted(painted)], indent=2))
print('rowOrder slot for the panel display:')
print(json.dumps(order, indent=2))
PY

for part in cohort breed; do
  bgzip -f "dog10k_slc28a3_${part}_cn.bed"
  tabix -f -p bed "dog10k_slc28a3_${part}_cn.bed.gz"
done

echo
echo "Wrote $(pwd)/dog10k_slc28a3_cohort_cn.bed.gz, one row per canid, and"
echo "     $(pwd)/dog10k_slc28a3_breed_cn.bed.gz, the named panel of that file."
echo "Load each as a BedTabixAdapter under a LinearMultiRowFeatureDisplay, and"
echo "check its legend and rowOrder slots against the blocks printed above."
echo "Route 2 follows, and needs the reference and the SRA runs."

# ── Route 2: six panel dogs, from their reads ───────────────────────────────
# ── One-time: the reference, a short-read index, and the bait ────────────────
if [ ! -f canFam4.fa ]; then
  curl -fsSL -C - -o canFam4.fa.gz "$UCSC/canFam4.fa.gz"
  gunzip -f canFam4.fa.gz
  samtools faidx canFam4.fa
fi
# Baited reads are aligned against the whole genome, not against the locus: a
# read from a paralog elsewhere has to be able to land there rather than being
# forced into this window.
[ -f canFam4.sr.mmi ] || minimap2 -x sr -d canFam4.sr.mmi canFam4.fa

awk '$1 ~ /^chr[0-9]+$/ {print $1"\t"$2}' canFam4.fa.fai > chrom.sizes

# The UCSC reference is soft-masked, so RepeatMasker's calls are already in it
# as lowercase (48.6% of this window). Hard-masking them gives a bait matching
# only the locus's unique sequence, and the per-position mask is what depth is
# counted over below.
if [ ! -f bait.fa ]; then
  samtools faidx canFam4.fa "$CHROM:$START-$END" > locus.fa
  python3 <<'PY'
seq = ''.join(l.strip() for l in open('locus.fa') if not l.startswith('>'))
with open('bait.fa', 'w') as fh:
    fh.write('>locus_unique\n')
    masked = ''.join('N' if c.islower() else c.upper() for c in seq)
    for i in range(0, len(masked), 60):
        fh.write(masked[i:i + 60] + '\n')
# 1 where the reference is unique (uppercase), 0 where RepeatMasker called it
with open('mask.txt', 'w') as fh:
    fh.write(''.join('1' if c.isupper() else '0' for c in seq) + '\n')
PY
fi

echo "sample	breed	CN over the element	CN in the flanks"
# fed by a here-string rather than a pipe: a `while read` on the right of a
# pipe runs in a subshell, where the guard below could not stop the script
while IFS=$'\t' read -r SAMPLE RUN; do
  BREED=$(awk -F'\t' -v s="$SAMPLE" 'NR>1 && $1==s {print $2}' samples.txt)

  # -C - resumes rather than restarting a 22 GB transfer that dropped
  [ -f "$RUN.sra" ] || curl -fsSL -C - -o "$RUN.sra" "$SRA/$RUN/$RUN"

  # fastq-dump rather than the faster fasterq-dump: the latter stages the whole
  # uncompressed FASTQ (~54 GB per run) in scratch even when writing to stdout,
  # and fails outright when the disk cannot hold it.
  fastq-dump -Z --split-spot "$RUN.sra" 2>/dev/null \
    | bbduk.sh -Xmx4g threads="$(nproc)" int=f in=stdin.fq outm=stdout.fq \
        out=/dev/null ref=bait.fa k=31 2>"bbduk.$SAMPLE.log" \
    | minimap2 -ax sr -t "$(nproc)" canFam4.sr.mmi - 2>"minimap2.$SAMPLE.log" \
    | awk -v chrom="$CHROM" -v start="$START" -v end="$END" -v bin="$BIN" \
          -v minq="$MINMAPQ" -v minuniq="$MINUNIQUE" \
          -v flankl="$FLANK_LEFT_END" -v flankr="$FLANK_RIGHT_START" '
      BEGIN { getline mask < "mask.txt" }
      # SAM flag bits, by arithmetic rather than and(), which is gawk-only:
      # skip unmapped (4), secondary (256) and supplementary (2048)
      !/^@/ && int($2 / 4) % 2 == 0 && int($2 / 256) % 2 == 0 &&
      int($2 / 2048) % 2 == 0 && $5 >= minq && $3 == chrom {
        len = length($10)
        # only baited reads reach this awk, so a per-base loop is affordable
        # here, and it is what lets masked positions be skipped one at a time
        for (p = $4; p < $4 + len; p++) {
          if (p >= start && p < end && substr(mask, p - start + 1, 1) == "1") {
            depth[int((p - start) / bin)]++
          }
        }
      }
      END {
        nb = 0
        for (b = 0; b * bin < end - start; b++) {
          n = 0
          for (p = 1; p <= bin; p++) {
            if (substr(mask, b * bin + p, 1) == "1") {
              n++
            }
          }
          if (n >= minuniq) {
            pos[nb] = start + b * bin
            rate[nb] = (depth[b] + 0) / n
            nb++
          }
        }
        # Normalized against the window own flanks rather than the sample
        # table mean autosomal coverage. That mean is measured over every
        # position, while this depth is measured over unique positions only,
        # where coverage runs higher: normalizing against it put the flanks at
        # 2.5 rather than 2. The flanks are copy number two in every dog here,
        # which is what makes them the right denominator. Median, so one
        # duplicated bin in a flank cannot move it.
        nf = 0
        for (i = 0; i < nb; i++) {
          if (pos[i] < flankl || pos[i] >= flankr) {
            flank[nf++] = rate[i]
          }
        }
        if (nf == 0) {
          print "no flank bins, cannot normalize" > "/dev/stderr"
          exit 1
        }
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

  if [ ! -s "cn.$SAMPLE.bedGraph" ]; then
    echo "$SAMPLE: no depth over the locus, the run or the bait is wrong" >&2
    exit 1
  fi

  bedGraphToBigWig "cn.$SAMPLE.bedGraph" chrom.sizes \
    "dog10k_slc28a3_cn.$SAMPLE.bw"

  # The element against the flanks, so the figure can be checked against
  # numbers rather than trusted by eye: the flanks have to come out at two.
  awk -v s="$SAMPLE" -v b="$BREED" -v l="$FLANK_LEFT_END" \
      -v r="$FLANK_RIGHT_START" '
    $2 >= 75600000 && $3 <= 75730000 { e += $4; en++ }
    $3 <= l || $2 >= r { f += $4; fn++ }
    END { printf "%s\t%s\t%.1f\t%.1f\n", s, b, e / en, f / fn }' \
    "cn.$SAMPLE.bedGraph"

  rm -f "$RUN.sra"
done <<< "$(printf '%s\n' "$RUNS" | grep -v '^$')"

echo
echo "Wrote $(pwd)/dog10k_slc28a3_cn.*.bw, one per sample."
echo "Load them as the subadapters of a MultiQuantitativeTrack."
