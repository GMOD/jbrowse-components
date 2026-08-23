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
# breed-dog panel, and writes one painted BED9 row per haplotype.
#
# The eight wolfdogs are painted alongside twenty-one other animals that pin
# both ends of the answer: four European gray wolves held out of the wolf panel
# (which should paint solid wolf), the German Shepherd lineage the crosses were
# made with, and the northern and "ancient"-cluster breeds a reader expects to
# be wolfish (which should paint solid dog, because local ancestry measures a
# recent cross and not deep divergence). See the target table below.
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

# Targets, chosen before the dog panel so the panel can exclude them, and
# written in the order the painted track stacks them. The figure is a spectrum,
# not a portrait of the wolfdogs alone, so the subject is painted between two
# groups that pin the ends and one that is the rest of the dog world:
#
#   held-out wolves  eight European gray wolves REMOVED from the wolf panel
#                    below, so they are painted by the remaining twenty-eight
#                    rather than by themselves. Nothing else in the figure says
#                    what a correct all-wolf call looks like.
#   the subject      all eight wolfdogs, both breeds, the only animals here with
#                    a documented 20th-century wolf cross; the Shiloh Shepherd
#                    (which shares 78% of its F2 sites with wolves in the Dog10K
#                    paper, the highest of any breed dog, though D-statistics
#                    there find no significant excess over German Shepherds) and
#                    the Tamaskan, both bred to LOOK wolfish out of ordinary
#                    sled and herding dogs; and the German Shepherd lineage the
#                    crosses were made with, three ways (the modern breed, the
#                    Old German Shepherd, the White Swiss Shepherd).
#   the breed sweep  one dog from every breed the collection sequenced at least
#                    four of. Two jobs at once: it is the negative control (the
#                    northern and "ancient"-cluster breeds a reader assumes are
#                    the wolfiest dogs in the room are all in here, and local
#                    ancestry measures a recent cross rather than deep
#                    divergence, so they should paint as flat as a Labrador),
#                    and it is what makes the picture a spectrum rather than an
#                    assertion — nothing about a breed's position is chosen, so
#                    a breed that comes out carrying wolf comes out of the data.
#
# The threshold is on how well a breed is SEQUENCED, not on anything about the
# breed, which keeps the sweep from being a curated list; four is where the
# collection stops being one or two founders' dogs. Village dogs are
# deliberately absent: the dog reference panel below is one animal per BREED, so
# a free-breeding dog has no representative of its own background in it and any
# wolf it painted could be that gap rather than ancestry.
SWEEP_MIN=4
awk -F'\t' -v m="$SWEEP_MIN" '$3=="Breed_Dogs" &&
  $2 !~ /Wolfdog|Shiloh|Tamaskan|German Shepherd|White Swiss Shepherd/ {
    n[$2]++; last[$2] = $1
  }
  END { for (b in n) if (n[b] >= m) print last[b]"\t"b }' keep.tsv \
  | LC_ALL=C sort -t$'\t' -k2,2 > sweep.tsv

# Named groups first, then the sweep in breed order. `last[]` above takes the
# breed's last animal so the dog panel below, which takes the first one left
# after the targets are removed, is never left without a stand-in for a breed
# it just gave up — a target whose own breed is missing from the panel gets
# pushed toward the wolf side, which is the one artifact that would look
# exactly like the result.
python3 - <<'PY' > targets.tsv
GROUPS = (
    # Russia, Sweden and Portugal; the Greek wolves are left in the panel
    # because the marker figure at the bottom of this script draws all twelve
    # of them as its wolf reference and one animal should not be both.
    ('Gray wolf', ['CLUPRU000001', 'CLUPRU000002', 'CLUPRU000003',
                   'CLUPRU000004', 'CLUPSE000001', 'CLUPSE000002',
                   'CLUPPT000001', 'CLUPPT000002']),
    ('Saarloos', ['SAAR00000%d' % i for i in range(1, 5)]),
    ('Czechoslovakian', ['CZEC00000%d' % i for i in range(1, 5)]),
    ('Shiloh Shepherd', ['SHIL000001']),
    ('Tamaskan', ['TMSK000001']),
    ('German Shepherd', ['GRSD000002']),
    ('Old German Shepherd', ['OLGS000001', 'OLGS000002', 'OLGS000003']),
    ('White Swiss Shepherd', ['WSSD000003', 'WSSD000004']),
)
for prefix, ids in GROUPS:
    for n, sample in enumerate(ids, 1):
        # a one-animal group carries no number: "Tamaskan", not "Tamaskan 1"
        print('%s\t%s' % (sample, prefix if len(ids) == 1
                          else '%s %d' % (prefix, n)))
PY
grep -v -F -f <(cut -f1 targets.tsv) sweep.tsv >> targets.tsv
cut -f1 targets.tsv > targets.txt

# The eight wolf targets are painted, so they cannot also be painting: drop them
# from the reference panel. Held out AFTER wolves.txt is built rather than
# excluded from the awk above, so the panel definition stays "every European
# gray wolf" and this line is visibly the hold-out.
grep -v -F -f targets.txt wolves.txt > wolves.panel.txt
mv wolves.panel.txt wolves.txt

# Dog panel: one dog from every breed the collection has, minus the targets and
# the two wolfdog breeds. Breadth is what makes a block read as wolf-versus-dog
# rather than breed-versus-breed, and it has to include the shepherd breeds:
# an alphabetically truncated panel leaves the targets' own dog background
# unrepresented, which pushes ordinary dog haplotypes toward the wolf panel.
# Only the target ANIMALS are removed, not their breeds, so every target that
# has a littermate in the collection keeps a stand-in on the dog side — which is
# what makes a flat-dog painting of the Chow Chow or the Malamute a result
# rather than an artifact of a missing panel.
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

cat wolves.txt dogs.txt targets.txt greek.txt gsdref.txt \
  | sort -u > all.txt
awk '{print $1"\tWolf"}' wolves.txt > refpanel.txt
awk '{print $1"\tDog"}' dogs.txt >> refpanel.txt

# Row labels for the painted track, in the order the display stacks them —
# the same table the targets were taken from.
cp targets.tsv labels.tsv

printf 'panel: %s wolves, %s dogs; %s targets (%s haplotype rows)\n' \
  "$(wc -l < wolves.txt)" "$(wc -l < dogs.txt)" \
  "$(wc -l < targets.txt)" "$(( $(wc -l < targets.txt) * 2 ))"

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
# The Campbell pedigree map, as transitioned onto this panel's own assembly by
# Wang et al. 2025 (Zenodo 10.5281/zenodo.17095604, CC-BY-4.0). A map built on
# canFam4 is what lets a block boundary mean something: the older published dog
# maps are all on canFam3.1, and a uniform cM/Mb stand-in asserts a constant
# recombination rate the genome does not have.
# Its columns are POS / rate(cM/Mb) / Map(cM); FLARE wants PLINK's
# chrom / marker / cM / bp, so this is a reshape, not a computation.
MAPDIR=campbell_sex_average_canFam4
[ -f "$MAPDIR.tar.gz" ] || curl -fsSL -o "$MAPDIR.tar.gz" \
  "https://zenodo.org/records/17095604/files/$MAPDIR.tar.gz?download=1"
[ -d "$MAPDIR" ] || tar xzf "$MAPDIR.tar.gz"
awk -v c="$CHROM" 'NR>1 && $1 ~ /^[0-9]+$/ {printf "%s\t.\t%s\t%s\n", c, $3, $1}' \
  "$MAPDIR/${MAPDIR}_${CHROM}_map.txt" > "$CHROM.map"
awk -v c="$CHROM" 'NR==1{f=$3} END{printf "map: %d markers spanning %.1f cM on %s\n", NR, $3-f, c}' \
  "$CHROM.map"

# ── FLARE ───────────────────────────────────────────────────────────────────
[ -f flare.jar ] || curl -fsSL -o flare.jar \
  https://faculty.washington.edu/browning/flare.jar
java -Xmx12g -jar flare.jar ref="$CHROM.ref.vcf.gz" ref-panel=refpanel.txt \
  gt="$CHROM.gt.vcf.gz" map="$CHROM.map" out="wolfdog_$CHROM" seed=42

# Per-sample genome-wide-style summary for this chromosome: the wolfdogs carry
# wolf ancestry, the German Shepherds essentially none.
echo
echo "Ancestry fractions on $CHROM:"
gzip -dc "wolfdog_$CHROM.global.anc.gz"

# ── The named subset ────────────────────────────────────────────────────────
# The spectrum painting is 243 animals, which at any sane figure height is under
# the ~6px a row label needs, so it can show WHERE everything falls and not WHAT
# anything is. This is the companion set that carries the names: the twenty-four
# animals the target table names outright, plus the eight sweep breeds with the
# most wolf on this chromosome — chosen by FLARE's own per-sample output rather
# than by which breeds sound wolfish, which is the whole point of having swept
# 219 of them. Ordered by descending wolf fraction, so the figure is a ranking
# and the order is not an assertion either.
python3 - "wolfdog_$CHROM.global.anc.gz" <<'PY' > named.tsv
import gzip
import sys

frac = {}
with gzip.open(sys.argv[1], 'rt') as fh:
    next(fh)
    for line in fh:
        sample, wolf = line.split('\t')[:2]
        frac[sample] = float(wolf)

named, sweep = [], []
with open('targets.tsv') as fh:
    for i, line in enumerate(fh):
        sample, label = line.rstrip('\n').split('\t')
        (named if i < 24 else sweep).append((sample, label))

sweep.sort(key=lambda r: -frac[r[0]])
rows = named + sweep[:8]
rows.sort(key=lambda r: -frac[r[0]])
for sample, label in rows:
    print(f'{sample}\t{label}')
PY

# ── Painted BEDs ────────────────────────────────────────────────────────────
# Two paintings out of the one FLARE run, differing only in which rows they
# keep: the spectrum and the named subset above.
python3 "$SCRIPT_DIR/flare_anc_to_bed.py" "wolfdog_$CHROM.anc.vcf.gz" named.tsv \
  "dog10k_wolfdog_named.$CHROM.bed"
python3 "$SCRIPT_DIR/flare_anc_to_bed.py" "wolfdog_$CHROM.anc.vcf.gz" labels.tsv \
  "dog10k_wolfdog_ancestry.$CHROM.bed"
# `jbrowse sort-bed` does exactly this, but this script is otherwise node-free,
# so the pipeline is inline rather than pulling in the CLI: keep the `#`-header
# line (it names the columns for the BedTabixAdapter) on top, and sort the rest
# under LC_ALL=C so the order does not shift with the caller's locale.
for painting in "dog10k_wolfdog_ancestry.$CHROM" "dog10k_wolfdog_named.$CHROM"; do
  { grep '^#' "$painting.bed"
    grep -v '^#' "$painting.bed" \
      | LC_ALL=C sort -t"$(printf '\t')" -k1,1 -k2,2n
  } | bgzip > "$painting.bed.gz"
  tabix -f -p bed "$painting.bed.gz"
done

echo
echo "Wrote $(pwd)/dog10k_wolfdog_ancestry.$CHROM.bed.gz (243 animals) and"
echo "      $(pwd)/dog10k_wolfdog_named.$CHROM.bed.gz (the named subset),"
echo "plus their .tbi. Load them with the track JSON in the local ancestry"
echo "tutorial; the subset track's rowOrder is named.tsv, in that order."

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

# ── The painting checked against raw allele sharing ─────────────────────────
# FLARE matches HAPLOTYPES against the panels, which is what makes a block a
# block; this counts ALLELES instead, at the sites where the two panels are
# nearly fixed for different ones, and is deliberately the cruder measurement.
# Two things need it. The wolfdogs' fractions should track it, which says the
# painting is reading the data rather than the model. And when the two disagree
# the disagreement is the interesting number rather than a thing to argue past:
# on chr1 the two Swedish museum wolves carry MORE wolf-diagnostic alleles than
# any other held-out wolf and are still painted about half dog, so their rows
# are a property of the panel they are matched against and not of the animals.
echo
echo "Wolf-diagnostic alleles carried, per named animal (FLARE-independent):"
{ awk '{print $1"\twolfpanel"}' wolves.txt
  awk '{print $1"\tdogpanel"}' dogs.txt; } > afgroups.chk
# The panel frequencies have to be computed BEFORE the subset — after it there
# are no panel samples left to compute them from, and `+fill-tags` says so with
# a bare "No populations given?".
bcftools +fill-tags "$CHROM.subset.vcf.gz" -Ou -- -S afgroups.chk -t AF \
  | bcftools view -S <(cut -f1 named.tsv) --force-samples -Ob -o named.chk.bcf
# `-S` subsets but does not REORDER: the columns come out in the VCF's own
# sample order, so the labels have to be looked up from that order rather than
# from named.tsv's. Getting this wrong silently prints every number against the
# wrong animal, and the result still looks like a plausible table.
bcftools query -l named.chk.bcf > named.chk.order
bcftools query -f '%INFO/AF_wolfpanel\t%INFO/AF_dogpanel[\t%GT]\n' named.chk.bcf \
  | awk -F'\t' -v labelfile=named.tsv -v orderfile=named.chk.order '
      BEGIN {
        n_named = 0
        while ((getline line < labelfile) > 0) {
          split(line, f, "\t")
          named[++n_named] = f[1]; label[f[1]] = f[2]
        }
        n_order = 0
        while ((getline s < orderfile) > 0) { column[s] = ++n_order + 2 }
      }
      $1 >= 0.8 && $2 <= 0.2 {
        n++
        for (i = 3; i <= NF; i++) {
          g = $i; carried[i] += gsub(/1/, "1", g); total[i] += 2
        }
      }
      END {
        printf "  over %d sites where the panels are nearly fixed apart\n", n
        # named.tsv order, which is descending FLARE wolf fraction, so the two
        # measurements read down the page against each other
        for (j = 1; j <= n_named; j++) {
          i = column[named[j]]
          printf "  %-34s %.3f\n", label[named[j]], carried[i] / total[i]
        }
      }'
rm -f named.chk.bcf named.chk.order

# ── Genotype slice behind the second tutorial figure ────────────────────────
# 1.5 Mb at chr1:112.0-113.5 Mb, and the window is chosen for its EDGES: three
# wolfdog haplotypes end a wolf block inside it (Saarloos 3 hap1 and
# Czechoslovakian 4 hap1 at 112.58 Mb, Saarloos 1 hap1 at 113.25 Mb) while
# others run wolf or dog straight through. A window sitting entirely inside one
# block can only show that a wolf-called haplotype carries wolf alleles, which
# is a weaker claim than it sounds — it is where the painting says a block STOPS
# that there is something to be wrong about, and the same rows are drawn above
# as the painting so the two can be read against each other.
#
# Rows are named.tsv, the same animals in the same order as the subset painting,
# so a row is at the same height in both tracks. The eight held-out gray wolves
# are the wolf reference; the collection's Greek wolves are not needed here.
#
# Each site carries the alt-allele frequency in each FLARE reference panel, so
# the figure can filter itself down to the ancestry-informative markers instead
# of drawing every common site in the window. The frequencies are computed over
# the full panels (28 European wolves, 318 one-per-breed dogs) *before* the
# sample subset, so they stay panel-wide estimates and do not describe the
# thirty-two samples the file ends up holding — which is why AC/AF/AN are
# dropped rather than left to be read as the same thing.
BLOCK_START=112000000
BLOCK_END=113500000
if [ "$CHROM" = chr1 ]; then
  cut -f1 named.tsv > block.samples
  { awk '{print $1"\twolf"}' wolves.txt
    awk '{print $1"\tdog"}' dogs.txt; } > afgroups.txt
  tabix -f -p vcf "$CHROM.subset.vcf.gz"
  bcftools view -r "chr1:$BLOCK_START-$BLOCK_END" -Ou "$CHROM.subset.vcf.gz" \
    | bcftools +fill-tags -Ou -- -S afgroups.txt -t AF \
    | bcftools view -S block.samples --force-samples -Ou \
    | bcftools annotate -x INFO/AC,INFO/AF,INFO/AN,INFO/NS \
      -Oz -o dog10k_wolfdog_chr1_block.vcf.gz
  tabix -f -p vcf dog10k_wolfdog_chr1_block.vcf.gz
  echo
  echo "Wrote $(pwd)/dog10k_wolfdog_chr1_block.vcf.gz (the marker figure's window)."

  # Is that window a special place, or an ordinary one? The tutorial marks it on
  # a whole-chromosome painting, where 1.5 Mb is about a percent of the frame and
  # nothing inside it resolves, and a marked band reads as a claim whether or not
  # one was meant. So tile the chromosome and count, and let the page say which
  # it is rather than leave the reader to assume. The same pass prints the map's
  # cM per tile, because that is what sets how often a painted block CAN end:
  # the tile that tops this list is the one the map puts the most recombination
  # in, not the one with the most wolf ancestry.
  python3 - "$BLOCK_START" "$BLOCK_END" <<'CONTEXT'
import bisect
import statistics
import sys

lo, hi = int(sys.argv[1]), int(sys.argv[2])
win = hi - lo

ends, span = [], 0
with open('dog10k_wolfdog_named.chr1.bed') as fh:
    for line in fh:
        if line.startswith('#'):
            continue
        f = line.rstrip('\n').split('\t')
        span = max(span, int(f[2]))
        if f[10] == 'Wolf':
            ends.append(int(f[2]))
# a block flush against the end of the painted region stops because the
# chromosome does, not because the ancestry changes
ends = [e for e in ends if e < span]

# the same map FLARE was given, read back as a cumulative cM(position) step
# function: columns are chrom, ., cM, bp
grid = sorted((int(f[3]), float(f[2]))
              for f in (line.split() for line in open('chr1.map'))
              if len(f) >= 4)
pos = [p for p, _ in grid]
cms = [c for _, c in grid]


def cm_at(x):
    i = bisect.bisect_left(pos, x)
    if i <= 0:
        return cms[0]
    if i >= len(pos):
        return cms[-1]
    f = (x - pos[i - 1]) / (pos[i] - pos[i - 1])
    return cms[i - 1] + f * (cms[i] - cms[i - 1])


tiles = [(sum(1 for e in ends if s <= e < s + win),
          cm_at(s + win) - cm_at(s), s)
         for s in range(0, span, win)]
counts = [t[0] for t in tiles]
here = sum(1 for e in ends if lo <= e < hi)
atleast = sum(1 for c in counts if c >= here)
busiest = max(tiles)

print('\nWolf-block ends per %.1f Mb of chr1, over the 64 named haplotype rows:'
      % (win / 1e6))
print('  median tile         %3d ends   %5.2f cM'
      % (statistics.median(counts), statistics.median(t[1] for t in tiles)))
print('  the checked window  %3d ends   %5.2f cM   (%d of %d tiles hold %d or more)'
      % (here, cm_at(hi) - cm_at(lo), atleast, len(tiles), here))
print('  busiest tile        %3d ends   %5.2f cM   at chr1:%s-%s'
      % (busiest[0], busiest[1], format(busiest[2], ','),
         format(busiest[2] + win, ',')))
CONTEXT

  # Does the painting hold at its own edges? For every haplotype whose wolf
  # block ENDS inside the window, count the figure's markers carried on each
  # side of the coordinate the painting put that edge at. This is the claim the
  # figure makes, so it is a printed number rather than a reading off the
  # picture, and it is the one that could come out wrong: carriage running on
  # past the edge, or stopping well short of it, would say the boundary is the
  # model's rather than the data's. Both inputs are already on disk by here.
  python3 - "$BLOCK_START" "$BLOCK_END" <<'EDGES'
import gzip
import sys

lo, hi = int(sys.argv[1]), int(sys.argv[2])

# wolf blocks ending strictly inside the window, keyed by the BED's own row
# label ("<animal> hapN") -- the label is what ties this to a row in the figure
edges = {}
with open('dog10k_wolfdog_named.chr1.bed') as fh:
    for line in fh:
        if line.startswith('#'):
            continue
        f = line.rstrip('\n').split('\t')
        if f[10] == 'Wolf' and lo < int(f[2]) < hi:
            edges[f[9]] = int(f[2])

sample_of = {}
with open('named.tsv') as fh:
    for line in fh:
        sample, label = line.rstrip('\n').split('\t')
        sample_of[label] = sample

ids, markers = None, []
with gzip.open('dog10k_wolfdog_chr1_block.vcf.gz', 'rt') as fh:
    for line in fh:
        if line.startswith('##'):
            continue
        f = line.rstrip('\n').split('\t')
        if line.startswith('#CHROM'):
            ids = f[9:]
            continue
        info = dict(kv.split('=', 1) for kv in f[7].split(';') if '=' in kv)
        if 'AF_wolf' not in info or 'AF_dog' not in info:
            continue
        if (float(info['AF_wolf'].split(',')[0]) >= 0.8
                and float(info['AF_dog'].split(',')[0]) <= 0.15):
            markers.append((int(f[1]), f[9:]))


def frac(v):
    return '%d/%d' % (sum(v), len(v)) if v else 'n/a'


print('Markers the figure keeps (AF_wolf >= 0.8, AF_dog <= 0.15): %d'
      % len(markers))
print('\nWolf alleles carried either side of a painted block edge:')
for row, edge in sorted(edges.items(), key=lambda kv: kv[1]):
    animal, _, hap = row.rpartition(' hap')
    sample = sample_of.get(animal)
    if sample is None or sample not in ids:
        continue
    col, h = ids.index(sample), int(hap) - 1
    before, after = [], []
    for pos, gts in markers:
        carried = gts[col].replace('/', '|').split('|')[h] == '1'
        (after if pos >= edge else before).append(carried)
    print('  %-26s edge %11s   wolf side %7s   dog side %7s'
          % (row, format(edge, ','), frac(before), frac(after)))
EDGES
fi
