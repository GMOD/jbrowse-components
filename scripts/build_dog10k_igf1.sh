#!/usr/bin/env bash
#
# Reproducibly build the IGF1 haplotype track that
# website/docs/tutorials/dog10k_selection.md follows along in.
#
# IGF1 is a major determinant of body size in dogs (Sutter et al. 2007). This
# script slices chr15 around the gene out of the public Dog10K SNV callset for
# every animal of fourteen toy/small breeds, eleven giant breeds, and the Greek
# gray wolves, keeping sites that are common within that panel.
#
# The panel is selected by breed from the Dog10K sample table, not by genotype:
# rows selected by what they carry would group by what they carry, so the
# clustering would reproduce the selection rather than test it.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl,
#           python3.
# Usage:    bash scripts/build_dog10k_igf1.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_igf1_build}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# fetched on demand so a bare `curl -O` of this one script still works
HELPERS=(igf1_site_fst.py)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || curl -fsSL -o "$HERE/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

SHARE=https://kiddlabshare.med.umich.edu/dog10K
SNVS=$SHARE/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz

# IGF1 is chr15:41,495,479-41,567,874 on UU_Cfam_GSD_1.0. The window runs well
# past both ends so the haplotype's edges fall inside the view rather than at it.
REGION=chr15:41350000-41750000

# Sites that are common within the panel. Without it about three quarters of the
# columns are reference in every animal and draw empty.
MINOR_AF=0.05

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# ── Panel ───────────────────────────────────────────────────────────────────
# Every animal of each breed, not a head-N slice: the variation within a breed is
# part of the result, and several breeds depart from the pattern one animal at a
# time. Writes the sample list and the metadata TSV the track colors by.
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
name, breed, category = (head.index(c) for c in
                         ('sampleName', 'Breed.Type', 'Category'))
in_vcf = head.index('includedInVCF')

panel = []
for size, breeds in (('Toy/small', SMALL), ('Giant', GIANT)):
    for b in breeds:
        panel += [(r[name], b, size) for r in rows
                  if len(r) > in_vcf and r[breed] == b and r[in_vcf] == 'YES']
panel += [(r[name], 'Greek gray wolf', 'Gray wolf') for r in rows
          if len(r) > in_vcf and r[category] == 'Wolf' and r[breed] == 'Greece'
          and r[in_vcf] == 'YES']

with open('igf1.samples', 'w') as fh:
    fh.write('\n'.join(s for s, _, _ in panel) + '\n')
with open('dog10k_igf1_samples.tsv', 'w') as fh:
    fh.write('name\tbreed\tsize\n')
    for s, b, size in panel:
        fh.write(f'{s}\t{b}\t{size}\n')

counts = {}
for _, _, size in panel:
    counts[size] = counts.get(size, 0) + 1
print(f'panel: {len(panel)} canids ' +
      ', '.join(f'{v} {k.lower()}' for k, v in counts.items()))
PY

# ── Slice ───────────────────────────────────────────────────────────────────
# The callset is 397 GB across 1,987 canids; bcftools reads only this window.
bcftools view -r "$REGION" -S igf1.samples --force-samples -f PASS "$SNVS" \
  | bcftools view -q "$MINOR_AF:minor" -Oz -o dog10k_igf1.vcf.gz
tabix -f -p vcf dog10k_igf1.vcf.gz

echo
echo "Sites kept: $(bcftools view -H dog10k_igf1.vcf.gz | wc -l)"

# ── Fst per site ────────────────────────────────────────────────────────────
# The same Hudson estimator build_dog10k_size_fst.sh scans the genome with, one
# site at a time over the slice above rather than in 200 kb windows: that scan's
# bin is wider than this whole window, so it says nothing inside it. Reading it
# off the same VCF the matrix draws is what makes each point one column of the
# matrix.
python3 "$HERE/igf1_site_fst.py" \
  dog10k_igf1.vcf.gz dog10k_igf1_samples.tsv dog10k_igf1_fst.bed
bgzip -f dog10k_igf1_fst.bed
tabix -f -p bed dog10k_igf1_fst.bed.gz

# ── Check it against the numbers ────────────────────────────────────────────
# Report the quantity the figure shows: per size class, the alt-allele dosage
# over the sites inside the gene that separate the two dog classes. Those sites
# are defined by the two dog classes, so the wolf row is a projection onto that
# axis -- it locates wolves relative to the dog split, and is not a wolf allele
# frequency.
python3 - <<'PY'
import subprocess
import statistics

GENE_START, GENE_END = 41495479, 41567874


def run(args):
    return subprocess.run(args, capture_output=True, text=True,
                          check=True).stdout


meta = {}
for line in run(['cat', 'dog10k_igf1_samples.tsv']).splitlines()[1:]:
    sample, breed, size = line.split('\t')
    meta[sample] = size

ids = run(['bcftools', 'query', '-l', 'dog10k_igf1.vcf.gz']).split()
rows = [l.split('\t') for l in
        run(['bcftools', 'query', '-f', '%POS[\t%GT]\n',
             'dog10k_igf1.vcf.gz']).splitlines()]


def dose(gt):
    if '.' in gt:
        return None
    return gt.count('1')


gene = [r for r in rows if GENE_START <= int(r[0]) <= GENE_END]
by_size = {}
for i, s in enumerate(ids):
    by_size.setdefault(meta[s], []).append(i)


def freq(row, group):
    d = [x for x in (dose(row[i + 1]) for i in group) if x is not None]
    return sum(d) / (2 * len(d)) if d else 0.0


small, giant = by_size['Toy/small'], by_size['Giant']
diagnostic = [r for r in gene if freq(r, small) - freq(r, giant) > 0.5]
print(f'\n{len(gene)} sites inside IGF1; {len(diagnostic)} of them separate '
      'the toy/small and giant panels')

# Where the separating sites are, over the WHOLE slice rather than inside the
# gene. The figure frames this span with flanks either side, so it is printed
# rather than eyeballed off a picture: in a matrix every record is one column of
# equal width, so a window that is mostly undifferentiated sites is mostly
# columns that say nothing and the shared haplotype reads as speckle. Both ends
# fall outside the gene, which is the other reason not to frame on the gene.
sep = [r for r in rows if freq(r, small) - freq(r, giant) > 0.5]
if sep:
    lo, hi = int(sep[0][0]), int(sep[-1][0])
    print(f'{len(sep)} separating sites in the whole slice, spanning '
          f'{lo:,}-{hi:,} ({(hi - lo) / 1000:.0f} kb), of {len(rows)} sites')

print('\nalt dosage over those sites, per canid:')
for size, group in by_size.items():
    scores = []
    for i in group:
        d = [x for x in (dose(r[i + 1]) for r in diagnostic) if x is not None]
        scores.append(sum(d) / (2 * len(d)) if d else 0.0)
    print(f'  {size:10s} n={len(group):3d}  median {statistics.median(scores):.2f}'
          f'  range {min(scores):.2f}-{max(scores):.2f}')
PY

echo
echo "Wrote $(pwd)/dog10k_igf1.vcf.gz (plus its .tbi),"
echo "      $(pwd)/dog10k_igf1_fst.bed.gz (plus its .tbi) and"
echo "      $(pwd)/dog10k_igf1_samples.tsv"
