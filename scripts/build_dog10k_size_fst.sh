#!/usr/bin/env bash
#
# Reproducibly build the genome-wide body-size selection scan that
# website/docs/tutorials/dog10k_selection.md opens with.
#
# Hudson Fst in 200 kb windows across the 38 autosomes, between the same two
# panels the IGF1 figure on that page draws per animal: every animal of fourteen
# toy or small breeds against every animal of eleven giant breeds, taken from the
# Dog10K sample table by breed name. Allele frequencies come from the public
# Dog10K phased imputation panel, which has no missing genotypes, so a window's
# score depends only on which sites fall in it.
#
# The panel is selected by breed, not by genotype, for the same reason as the
# IGF1 track: groups defined by what they carry would score their own definition.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix, bgzip),
#           curl, python3.
# Usage:    bash scripts/build_dog10k_size_fst.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_size_fst_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
PANEL=$SHARE/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf

# 200 kb is wide enough that a window carries hundreds of sites at this panel
# size and narrow enough to resolve one gene's sweep from its neighbors.
WINDOW=200000

# Windows carrying fewer sites than this are dropped rather than drawn: a
# handful of sites gives a ratio that swings on any one of them.
MIN_SITES=20

# The panel is autosomal, and chrX would need its own ploidy handling.
CHROMS=$(seq 1 38 | sed 's/^/chr/')

# One HTTP stream per chromosome. The panel is remote, so this is bound by the
# transfer rather than by the arithmetic.
JOBS="${JOBS:-8}"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# ── Panel ───────────────────────────────────────────────────────────────────
# The same breed lists as build_dog10k_igf1.sh. Writes the sample list bcftools
# subsets on and the two-column group file `bcftools +fill-tags` counts by.
python3 - <<'PY'
SMALL = ['Chihuahua', 'Pomeranian', 'Yorkshire Terrier', 'Toy Fox Terrier',
         'Maltese', 'Pekingese', 'Shih Tzu', 'Miniature Pinscher', 'Havanese',
         'Brussels Griffon', 'Japanese Chin', 'Norfolk Terrier',
         'Norwich Terrier', 'Cairn Terrier']
GIANT = ['Saint Bernard', 'Leonberger', 'Great Pyrenees', 'Newfoundland',
         'Mastiff', 'Scottish Deerhound', 'Bernese Mountain Dog',
         'Neapolitan Mastiff', 'Bullmastiff', 'Kuvasz', 'Dogue de Bordeaux']

rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')]
head, rows = rows[0], rows[1:]
name, breed = (head.index(c) for c in ('sampleName', 'Breed.Type'))
in_vcf = head.index('includedInVCF')

panel = []
for group, breeds in (('SMALL', SMALL), ('GIANT', GIANT)):
    for b in breeds:
        panel += [(r[name], group) for r in rows
                  if len(r) > in_vcf and r[breed] == b and r[in_vcf] == 'YES']

with open('size.samples', 'w') as fh:
    fh.write('\n'.join(s for s, _ in panel) + '\n')
with open('size.groups', 'w') as fh:
    for s, g in panel:
        fh.write(f'{s}\t{g}\n')

counts = {}
for _, g in panel:
    counts[g] = counts.get(g, 0) + 1
print('panel: ' + ', '.join(f'{v} {k.lower()}' for k, v in counts.items()))
PY

# ── Hudson Fst ──────────────────────────────────────────────────────────────
# Hudson's estimator as ratio-of-averages: the per-window numerator and
# denominator are summed over sites before dividing, which is what keeps a
# window from being dominated by its least informative sites (Bhatia et al.
# 2013). Both group frequencies are bias-corrected against their own sample
# size, so the two panels being unequal does not tilt the score.
cat > fst_windows.py <<PY
#!/usr/bin/env python3
"""Hudson Fst in fixed windows from an AN/AC stream on stdin.

stdin columns: POS AN_SMALL AC_SMALL AN_GIANT AC_GIANT
stdout columns: start end fst sites
"""
import sys

WIN = $WINDOW
MIN_SITES = $MIN_SITES

acc = {}
for line in sys.stdin:
    f = line.split()
    pos = int(f[0])
    try:
        an1, ac1, an2, ac2 = (int(x) for x in f[1:5])
    except ValueError:
        # A multiallelic site carries a comma-separated AC and is skipped.
        continue
    if an1 < 40 or an2 < 40:
        continue
    p1 = ac1 / an1
    p2 = ac2 / an2
    # Monomorphic across both panels: no information about the split.
    if (p1 == 0 and p2 == 0) or (p1 == 1 and p2 == 1):
        continue
    num = (p1 - p2) ** 2 - p1 * (1 - p1) / (an1 - 1) - p2 * (1 - p2) / (an2 - 1)
    den = p1 * (1 - p2) + p2 * (1 - p1)
    w = pos // WIN
    a = acc.setdefault(w, [0.0, 0.0, 0])
    a[0] += num
    a[1] += den
    a[2] += 1

for w in sorted(acc):
    num, den, n = acc[w]
    if n >= MIN_SITES and den > 0:
        # The estimator is unbiased, so it goes slightly negative where the two
        # panels do not differ; those windows are reported as zero.
        print(f'{w * WIN}\t{(w + 1) * WIN}\t{max(0.0, num / den):.5f}\t{n}')
PY

# ── Scan ────────────────────────────────────────────────────────────────────
# +fill-tags counts alleles per group in one pass, so each chromosome is read
# over HTTP once.
cat > scan_chrom.sh <<'SH'
set -euo pipefail
chrom=$1
bcftools view -r "$chrom" -S size.samples --force-samples -Ou "$PANEL" \
  | bcftools +fill-tags -Ou -- -S size.groups -t AN,AC \
  | bcftools query -f '%POS\t%AN_SMALL\t%AC_SMALL\t%AN_GIANT\t%AC_GIANT\n' \
  | python3 fst_windows.py \
  | awk -v c="$chrom" 'BEGIN{OFS="\t"} {print c, $1, $2, c":"$1"-"$2, $3, $4}' \
  > "win.$chrom.bed"
SH

export PANEL
echo "scanning ${WINDOW} bp windows across 38 autosomes, $JOBS at a time"
echo "$CHROMS" | xargs -P "$JOBS" -I{} bash scan_chrom.sh {}

# Concatenated in chromosome order, which is the order the assembly lays them
# out in, so the track needs no sorting beyond this.
for chrom in $CHROMS; do
  cat "win.$chrom.bed"
done > dog10k_size_fst.bed

bgzip -f dog10k_size_fst.bed
tabix -f -p bed dog10k_size_fst.bed.gz

# ── Check it against the numbers ────────────────────────────────────────────
# Print the ranked windows rather than asserting anything about them: which loci
# top a scan is the result, and a script that checked for IGF1 would be checking
# its own expectation.
echo
echo "windows scored: $(zcat dog10k_size_fst.bed.gz | wc -l)"
echo
echo "top 20 windows by Fst:"
zcat dog10k_size_fst.bed.gz | sort -k5,5gr | head -20 \
  | awk 'BEGIN{OFS="\t"} {print NR, $1":"$2"-"$3, $5, $6" sites"}'

echo
echo "Wrote $(pwd)/dog10k_size_fst.bed.gz (plus its .tbi)"
