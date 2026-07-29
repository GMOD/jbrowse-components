#!/usr/bin/env bash
#
# Build per-sample SLC28A3 copy-number tracks for the Dog10K panel, the
# read-depth counterpart to scripts/build_dog10k_cyp1a2_cn.sh.
#
# The Dog10K paper reports a copy-number element spanning the whole coding
# sequence of SLC28A3, expanded in Grand Basset Griffon Vendeen and basset hound
# dogs and at copy number two in the German Shepherd reference breed (Meadows et
# al. 2023, Fig 11). Unlike CYP1A2, none of these dogs are among the 15 CRAMs the
# Dog10K share publishes, so this one starts from reads in SRA.
#
# Aligning whole runs takes over two hours each (measured: 45k reads/s on 12
# cores, 360M reads per run). Instead every read is tested against the locus
# with bbduk and only the ~0.05% sharing a 31-mer with it are aligned, which
# puts a sample at about twenty minutes, bounded by fastq-dump. The bait is
# repeat-masked, so copy number is read from the locus's unique sequence only:
# the same restriction QuicK-mer2 makes, and the reason depth below is counted
# over unmasked reference positions rather than over whole bins.
#
# Validated on 11% of GBGV000003's reads: flanks land on copy number two and the
# element peaks at 6.8, against the copy number of six the paper infers for that
# dog, with edges matching the SV callset's duplication at
# chr1:75,578,115-75,714,214.
#
# Requires: sra-toolkit (fastq-dump), bbmap (bbduk.sh), minimap2, samtools,
#           curl, awk, python3, and UCSC's bedGraphToBigWig. Budget ~35 GB of
#           scratch: the reference, its minimap2 index, and one run at a time.
#           minimap2 holds the index in ~11 GB of RAM.
# Usage:    bash scripts/build_dog10k_slc28a3_cn.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_slc28a3_cn_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
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

# The paper's panel, minus GBGV000004 and GBGV000005, which have no run in the
# Dog10K sample table. GRSD000001 (a German Shepherd, the breed the reference
# assembly comes from) and BASS000002 are its copy-number-two comparisons.
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

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

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
