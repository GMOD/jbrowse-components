#!/usr/bin/env bash
#
# Draw one of the graph's inversion-flagged bubbles as an alignment. The bubble
# file's inversion column says a bubble's paths disagree about orientation; it
# does not say whether that is a polymorphic inversion or an inverted paralog in
# a segmental duplication, and the wave VCF's INV flag is not set at these loci.
# The alignments settle it, so this script classifies every HPRC haplotype at one
# flagged bubble and slices a carrier and a non-carrier out of HPRC's own
# all-vs-GRCh38 PAF.
#
# Requires: curl, awk, python3, bgzip, tabix
# Usage:    bash scripts/build_hprc_inversion_synteny.sh [outdir]
#
# Writes, per haplotype, into ./hprc_inversion_synteny_build/ (copy them beside
# test_data/graphgenomeview/hprc.json, which is where the figure reads them):
#
#   hprc_inv_<sample>.<hap>.paf          the sliced alignment, query names with
#                                        the PanSN prefix stripped
#   hprc_inv_<sample>.<hap>.chrom.sizes  the query contig's length, for a
#                                        ChromSizesAdapter assembly
#   hprc_inv_<sample>.<hap>.genes.gff3.gz  HPRC's own CAT annotation of that
#                                        haplotype, cut to the drawn window
#
# The locus is chr1:144,419,292-144,572,458 at 1q21.1, which
# hprc-v2.0-mc-grch38.bubbles.bed.gz reports as inversion-flagged and whose
# breakpoints are three mixed-orientation rank-0 links in the links index:
#
#   tabix hprc-v2.0-mc-grch38.links.bed.gz 'GRCh38#0#chr1:144,400,000-144,600,000' \
#     | awk -F'\t' '!s[$4$5]++ && $9==0 && $13==0 &&
#                   substr($4,length($4)) != substr($5,length($5))'
#
# THE FLANKS ARE THE TEST, not the block. A haplotype whose whole window aligns
# reverse says nothing: its contig may simply be deposited in the opposite
# orientation. What makes an inversion is a block that reverses while the
# sequence on both sides of it stays forward, which is why the streamed window is
# 1.2 Mb around a 153 kb bubble rather than the bubble plus a margin. Both
# orientations are then read per haplotype and printed, so the split is the
# script's output rather than a number in prose.
#
# A 1q21.1 window is also a segmental duplication, so a haplotype can align the
# same query span to the reference twice, once forward against a paralog and once
# reverse against the block. Every haplotype here has such records: the cleanest
# of the 87 that are evidence either way still carries three reverse alignments
# in the streamed window, and a reverse alignment draws the same crossing the
# inversion does. Two things follow, and both were learned by drawing it wrong.
#
# A SYNTENY FIGURE DRAWS FAR MORE THAN ITS WINDOW. The fetch is region-scoped and
# the PAF adapter filters to the region it is asked for, but that region is the
# query axis's visible window widened by JBrowse's synteny pan buffer (2000 px of
# bp per side at this width, ~700 kb, snapped outward to that grid) and the mate
# axis is unscoped by design. So a 1.2 Mb slice is fetched whole, and a record
# whose mate sits a megabase off the other row is drawn across the frame anyway.
# The emitted PAF is therefore cut to the figure's frame (FRAME_START/FRAME_END
# below, the window it draws on GRCh38) rather than to the classification window,
# and the classification runs over the wider streamed file that the browser never
# sees.
#
# WHICH PAIR IS PICKED IS THEN A PROPERTY OF THE FRAME. The script keeps only
# haplotypes whose in-frame records are the inversion plus forward flanks, and
# prints how many of each qualified, so the panel is not chosen by eye.
#
set -euo pipefail

OUTDIR="${1:-hprc_inversion_synteny_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

REL=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2
PAF=$REL/impg/pafs/hprc465vsgrch38.aln.paf.gz
# Release 2 annotates every assembly with CAT, and the index says where each
# haplotype's gff3 lives. Same file the CFHR build reads.
CAT_INDEX=https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
# how far outside a row's drawn window its gene slice reaches, so panning a live
# link a little does not run off the end of the annotation
GENE_FLANK=20000

# The flagged bubble, and the window streamed around it. The flank margins below
# start 20 kb outside the bubble so a breakpoint's own homology is in neither.
BLOCK_START=144419292
BLOCK_END=144572458
SLICE_START=143900000
SLICE_END=145100000

# The window the figure draws on GRCh38. Wider than the bubble so both flanks are
# visible, and it stops at 144,610,000 because past there most haplotypes carry a
# paralogous record of their own.
FRAME_START=144260000
FRAME_END=144610000

# The PAF is 6.3 GB, unindexed, and not sorted by target, so it is streamed once
# and filtered on the fly. Kept on disk because it is by far the most expensive
# step here.
if [ -f inv_window_all_haplotypes.paf ]; then
  echo "== reusing inv_window_all_haplotypes.paf"
else
  echo "== streaming $PAF, keeping GRCh38#0#chr1:$SLICE_START-$SLICE_END"
  curl -fsS "$PAF" \
    | gzip -dc \
    | awk -F'\t' -v s="$SLICE_START" -v e="$SLICE_END" \
        '$6=="GRCh38#0#chr1" && $8 < e && $9 > s' \
    > inv_window_all_haplotypes.paf
fi
echo "   $(wc -l < inv_window_all_haplotypes.paf) records"

# Classify every haplotype by two orientations: the bubble, and the sequence
# outside it, then pick the pair that draws cleanest inside the figure's frame.
python3 - "$BLOCK_START" "$BLOCK_END" "$SLICE_START" "$SLICE_END" \
         "$FRAME_START" "$FRAME_END" <<'PY'
import collections
import sys

bs, be, ss, se, fs, fe = (int(a) for a in sys.argv[1:7])
margin = 20000
flanks = [(ss, bs - margin), (be + margin, se)]

recs = collections.defaultdict(list)
for line in open('inv_window_all_haplotypes.paf'):
    f = line.rstrip('\n').split('\t')
    recs['#'.join(f[0].split('#')[:2])].append(
        (f[0], f[4], int(f[2]), int(f[3]), int(f[7]), int(f[8]))
    )


def oriented(rows, spans):
    fwd = rev = 0
    for _, strand, _, _, ts, te in rows:
        for a, b in spans:
            overlap = min(te, b) - max(ts, a)
            if overlap > 0:
                if strand == '+':
                    fwd += overlap
                else:
                    rev += overlap
    return fwd, rev


carriers, noncarriers, other = [], [], 0
for hap, rows in recs.items():
    bf, br = oriented(rows, [(bs, be)])
    if bf + br < 0.5 * (be - bs):
        continue
    ff, fr = oriented(rows, flanks)
    if ff <= 0.8 * (ff + fr):
        other += 1                       # flanks not forward: says nothing
    elif br > 0.8 * (bf + br):
        carriers.append(hap)
    elif bf > 0.8 * (bf + br):
        noncarriers.append(hap)
    else:
        other += 1

print(f'   {len(carriers)} haplotypes reverse the bubble with forward flanks')
print(f'   {len(noncarriers)} keep it forward with forward flanks')
print(f'   {other} are mixed or reverse throughout, and are not evidence either way')
if not carriers or not noncarriers:
    sys.exit('FAILED: the bubble is not polymorphic in orientation here')


def framed(hap, carrier):
    """What a synteny row for this haplotype draws, and the window it draws in.

    The emitted PAF is cut to the frame, and a row draws every record its file
    holds for the contig, so this is the drawn set. One contig per row: the one
    carrying the most reference bp in the frame.
    """
    rows = [r for r in recs[hap] if min(r[5], fe) - max(r[4], fs) > 0]
    if not rows:
        return None
    covered = collections.Counter()
    for r in rows:
        covered[r[0]] += min(r[5], fe) - max(r[4], fs)
    contig = covered.most_common(1)[0][0]
    drawn = [r for r in rows if r[0] == contig]
    return {
        # the query name as the sliced PAF writes it, PanSN prefix stripped
        'contig': contig.split('#', 2)[-1],
        'window': (min(r[2] for r in drawn), max(r[3] for r in drawn)),
        'drawn': len(drawn),
        # a reverse ribbon that is not the inversion itself
        'stray': sum(
            1 for r in drawn
            if r[1] == '-' and not (carrier and min(r[5], be) - max(r[4], bs) > 0)
        ),
        # forward alignment either side of the bubble, which is the whole test
        'left': sum(max(0, min(r[5], bs) - max(r[4], fs)) for r in drawn
                    if r[1] == '+'),
        'right': sum(max(0, min(r[5], fe) - max(r[4], be)) for r in drawn
                     if r[1] == '+'),
    }


def pick(haps, label):
    carrier = label == 'carrier'
    scored = []
    for hap in haps:
        f = framed(hap, carrier)
        if f and f['stray'] == 0 and f['left'] > 0 and f['right'] > 0:
            scored.append((f['drawn'], -min(f['left'], f['right']), hap, f))
    print(f'   {len(scored)} of {len(haps)} {label}s draw the frame with no'
          ' stray reverse ribbon and forward alignment on both flanks')
    if not scored:
        sys.exit(f'FAILED: no {label} draws this frame cleanly')
    _, _, hap, f = sorted(scored)[0]
    return hap, f


with open('inv_panel.txt', 'w') as fh:
    for haps, label in ((carriers, 'carrier'), (noncarriers, 'non-carrier')):
        hap, f = pick(haps, label)
        sample, haplotype = hap.split('#')
        qs, qe = f['window']
        fh.write(f'{sample}\t{haplotype}\t{label}\t{f["contig"]}\t{qs}\t{qe}\n')
        print(f'   {label}: {sample} hap {haplotype}, {f["drawn"]} record(s) in'
              f' frame, row window {f["contig"]}:{qs}-{qe}')
PY

# Per haplotype: keep the records the figure draws, which is the frame on GRCh38
# and the contig the panel row is, drop the PanSN prefixes so the query names are
# the assembly's own contig names, and write that contig's length.
while IFS=$'\t' read -r sample hap label contig qstart qend; do
  name="$sample.$hap"
  awk -F'\t' -v p="$sample#$hap#$contig" -v s="$FRAME_START" -v e="$FRAME_END" \
      -v OFS='\t' \
    '$1==p && $8 < e && $9 > s {
       sub(/^[^#]*#[^#]*#/, "", $1)
       sub(/^[^#]*#[^#]*#/, "", $6)
       print
     }' inv_window_all_haplotypes.paf > "hprc_inv_$name.paf"
  awk -F'\t' -v p="$sample#$hap#$contig" -v c="$contig" -v OFS='\t' \
    '$1==p { print c, $2; exit }' inv_window_all_haplotypes.paf \
    > "hprc_inv_$name.chrom.sizes"
  echo "== $name ($label): $(wc -l < "hprc_inv_$name.paf") record(s), the figure"
  echo "   draws this row at $contig:$qstart-$qend"
  awk -F'\t' '{print "   query " $3 "-" $4 "  " $5 "  target chr1:" $8 "-" $9}' \
    "hprc_inv_$name.paf"
done < inv_panel.txt

# ── The genes on each haplotype ─────────────────────────────────────────────
# A crossing ribbon is also what a contig deposited in the opposite orientation
# draws, which is why the classification above tests the flanks. These lanes put
# that test in the figure: CAT annotates each release 2 assembly on its own
# contigs (the same names the PAF queries carry once the PanSN prefix is off), so
# each row can show its own gene order through the block — the reference's on the
# non-carrier, reversed on the carrier.
#
# `intron`, `start_codon` and `stop_codon` rows are dropped: a gene glyph draws
# exons and CDS, and an intron feature would paint over the gap it names.
#
# So are the loci CAT has no symbol for, which it names by their Ensembl gene id.
# 29 of the 45 genes in this window are those, and unfiltered they are most of
# the lane and all of the same width and colour as the rest: the row packs three
# deep and reading an order off it means first finding the labels that are
# names. Every row of a CAT record carries `gene_name`, gene through exon, so
# this is one filter rather than a parent walk. The reference lane above is
# curated the same way by `geneGlyphMode`.
[ -f cat_index.csv ] || curl -fsSL -o cat_index.csv "$CAT_INDEX"

echo
echo "== CAT gene annotation, per haplotype"
while IFS=$'\t' read -r sample hap label contig qstart qend; do
  name="$sample.$hap"
  s3=$(awk -F, -v s="$sample" -v h="$hap" '$1==s && $2==h {print $4}' cat_index.csv)
  [ -n "$s3" ] || { echo "no CAT annotation indexed for $name"; exit 1; }
  url="https://s3-us-west-2.amazonaws.com/human-pangenomics/${s3#s3://human-pangenomics/}"
  gs=$((qstart > GENE_FLANK ? qstart - GENE_FLANK : 0))
  ge=$((qend + GENE_FLANK))
  echo "== $name ($label): $contig:$gs-$ge"
  # CAT emits each gene's rows together rather than in coordinate order, and
  # overlapping genes therefore interleave backwards, which tabix rejects
  { echo '##gff-version 3'
    curl -fsS "$url" \
      | gzip -dc \
      | awk -F'\t' -v c="$contig" -v s="$gs" -v e="$ge" \
          '$1==c && $4<e && $5>s && $3!="intron" && $3!="start_codon" &&
           $3!="stop_codon" && $9 !~ /gene_name=ENSG/' \
      | LC_ALL=C sort -k1,1 -k4,4n -k5,5n
  } > "hprc_inv_$name.genes.gff3"
  bgzip -f "hprc_inv_$name.genes.gff3"
  tabix -f -p gff "hprc_inv_$name.genes.gff3.gz"
  # named genes only, in the order the row draws them: the carrier's is the
  # reference's reversed, which is the figure's second statement of the event
  gzip -dc "hprc_inv_$name.genes.gff3.gz" \
    | awk -F'\t' '$3=="gene" { match($9, /Name=[^;]*/)
                               n = substr($9, RSTART+5, RLENGTH-5)
                               if (n !~ /^ENSG/) print n }' \
    | tr '\n' ' ' | sed 's/^/   genes: /;s/$/\n/'
done < inv_panel.txt

# The claim the figure makes, asserted rather than described: the carrier's
# alignment crosses the bubble in reverse while its flanks run forward, the
# non-carrier's runs forward throughout, and the only ribbon that crosses inside
# the drawn frame is the carrier's block.
python3 - "$BLOCK_START" "$BLOCK_END" "$FRAME_START" "$FRAME_END" <<'PY'
import sys

bs, be, fs, fe = (int(a) for a in sys.argv[1:5])
failures = []
for line in open('inv_panel.txt'):
    sample, hap, label = line.rstrip('\n').split('\t')[:3]
    fwd = rev = left = right = 0
    for row in open(f'hprc_inv_{sample}.{hap}.paf'):
        f = row.split('\t')
        strand = f[4]
        qts, qte, ts, te = int(f[2]), int(f[3]), int(f[7]), int(f[8])
        block = min(te, be) - max(ts, bs)
        if block > 0:
            if strand == '+':
                fwd += block
            else:
                rev += block
        if strand == '+':
            left += max(0, min(te, bs) - max(ts, fs))
            right += max(0, min(te, fe) - max(ts, be))
        else:
            # the file is cut to the frame and the fetch window is wider than
            # the frame, so every record in it is drawn: a reverse one that is
            # not the inversion is a crossing the caption does not account for
            if not (label == 'carrier' and block > 0):
                failures.append(
                    f'{sample}.{hap} ({label}) draws a reverse ribbon that is'
                    f' not the bubble: query {qts}-{qte} against'
                    f' chr1:{ts}-{te}')
    if (rev > fwd) != (label == 'carrier'):
        failures.append(f'{sample}.{hap} ({label}) has {fwd} bp forward and'
                        f' {rev} bp reverse over the bubble')
    if not left or not right:
        failures.append(f'{sample}.{hap} ({label}) has {left} bp forward left of'
                        f' the bubble and {right} bp right of it')
if failures:
    sys.exit('\nFAILED:\n  ' + '\n  '.join(failures))
print('   the carrier reverses the bubble and the non-carrier does not, both'
      ' flank forward, and nothing else in the frame crosses')
PY
