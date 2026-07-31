#!/usr/bin/env bash
#
# Reproducibly build the tracks that
# website/docs/tutorials/dog10k_retrogene.md follows along in.
#
# Parker et al. (2009) tied breed-defining short legs to an expressed FGF4
# retrogene: a processed copy of the FGF4 mRNA inserted elsewhere in the genome.
# A retrocopy has no introns, so short reads from it pile onto the parent gene's
# exons and stop at each splice site. A short-read SV caller reading that pileup
# calls a deletion of each intron, and the Dog10K Manta callset carries exactly
# two such records over FGF4, one per intron.
#
# This script slices those two records out of the public genotype VCF twice:
# once for a named panel of breeds, once for every canid in the callset.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl,
#           python3.
# Usage:    bash scripts/build_dog10k_fgf4_retrogene.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_fgf4_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
# The Michigan aggregate callset, not the 5.9 GB Zenodo Paragraph set the other
# SV tutorial slices: 1.08 GB over the same collection, and it carries DUP and
# INV records the Paragraph set drops.
SV=$SHARE/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
# FGF4 is chr18:48,869,443-48,873,311 on UU_Cfam_GSD_1.0 (UCSC canFam4). The
# window runs past both ends so the flanking sequence, where nothing is called,
# frames the gene.
REGION=chr18:48865000-48876000
# The two records, at the first base of each intron. Derived below rather than
# trusted: the script checks each one's span against the RefSeq intron it
# claims, so a callset or annotation update cannot silently move them.
INTRON1_POS=48869782
INTRON2_POS=48870417

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# ── The records are the introns ─────────────────────────────────────────────
# The claim the whole tutorial rests on is geometric, so it is checked against
# the annotation rather than asserted: each record's [POS+1, END] has to land on
# a RefSeq intron of FGF4, to the base.
[ -f ncbiRefSeq.gff.gz ] || curl -fsSL -o ncbiRefSeq.gff.gz \
  https://jbrowse.org/ucsc/canFam4/ncbiRefSeq.gff.gz

bcftools query -r "$REGION" -f '%POS\t%INFO/END\t%INFO/SVTYPE\t%INFO/SVLEN\n' \
  "$SV" 2>/dev/null > svs.tsv

python3 - <<PY
import gzip

exons = []
for line in gzip.open('ncbiRefSeq.gff.gz', 'rt'):
    f = line.split('\t')
    if len(f) > 8 and f[2] == 'exon' and 'gene_id=FGF4' in f[8]:
        exons.append((int(f[3]), int(f[4])))
exons = sorted(set(exons))
introns = [(a[1] + 1, b[0] - 1) for a, b in zip(exons, exons[1:])]
print('FGF4 RefSeq exons:  ' + ', '.join('%d-%d' % e for e in exons))
print('FGF4 RefSeq introns:' + ', '.join(' %d-%d (%d bp)' % (a, b, b - a + 1)
                                         for a, b in introns))

records = []
for line in open('svs.tsv'):
    pos, end, svtype, svlen = line.split()
    records.append((int(pos) + 1, int(end), svtype, int(svlen)))

# One base of slack at each breakpoint. The caller places a junction from read
# evidence and the annotation places it from a transcript model, so the two can
# disagree by a base without disagreeing about what the record is; anything
# looser would stop being a check.
print()
for start, end in introns:
    hits = [r for r in records
            if abs(r[0] - start) <= 1 and abs(r[1] - end) <= 1]
    print('intron %d-%d: %s' % (start, end, ', '.join(
        'called as a %s of %d bp at %d-%d' % (t, l, s, e)
        for s, e, t, l in hits) or 'NO MATCHING SV RECORD'))
    assert hits, 'no SV record matches this intron; the figure would be wrong'
PY

# ── The named panel ─────────────────────────────────────────────────────────
# Whole breeds, in the order the figure stacks them.
#
# Three breeds whose short legs are the trait Parker et al. mapped; two spaniels
# that carry a retrogene without being short-legged, which is the second copy
# Brown et al. (2017) tied to disc disease instead; two normal-legged breeds
# that carry neither; and the Greek gray wolves.
#
# The spaniels are the reason the group column says what a breed *looks like*
# rather than what it carries. A panel split into carriers and non-carriers
# would be split on the answer, and the interesting part is that the two do not
# line up: one record cannot tell the two retrocopies apart, so a carrier row
# means "there is a retrocopy somewhere", not "this dog has short legs".
python3 - <<'PY'
GROUPS = [
    ('Dachshund', 'Dachshund', 'Chondrodysplastic breed'),
    ('Basset Hound', 'Basset Hound', 'Chondrodysplastic breed'),
    ('Cardigan Welsh Corgi', 'Cardigan Corgi', 'Chondrodysplastic breed'),
    ('Cocker Spaniel', 'Cocker Spaniel', 'Standard-proportioned breed'),
    ('English Cocker Spaniel', 'English Cocker', 'Standard-proportioned breed'),
    ('Labrador Retriever', 'Labrador', 'Standard-proportioned breed'),
    ('German Shepherd Dog', 'German Shepherd', 'Standard-proportioned breed'),
]

rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
# includedInVCF and SNP.keep: the analysis set the SV genotyping ran on
rows = [r for r in rows if len(r) > 16 and r[11] == 'YES' and r[16] == 'TRUE']

panel = []
for breed, label, group in GROUPS:
    ids = [r[0] for r in rows if r[1] == breed]
    panel += [(s, '%s %d' % (label, i + 1), breed, group)
              for i, s in enumerate(ids)]
wolves = [r[0] for r in rows if r[2] == 'Wolf' and r[1] == 'Greece']
panel += [(s, 'Greek wolf %d' % (i + 1), 'Greek gray wolf', 'Gray wolf')
          for i, s in enumerate(wolves)]

with open('fgf4.samples', 'w') as fh:
    fh.write('\n'.join(s for s, _, _, _ in panel) + '\n')
# The row labels and swatch groups travel with the data, not with the figure:
# `samplesTsvLocation` on the adapter feeds the display's `colorBy`/`groupBy`,
# so the sample-to-breed mapping lives in one file derived from the Dog10K
# table instead of being restated wherever the track is drawn.
with open('dog10k_fgf4_samples.tsv', 'w') as fh:
    fh.write('name\tlabel\tbreed\tgroup\n')
    for row in panel:
        fh.write('\t'.join(row) + '\n')
print('panel: %d canids across %d breeds plus %d wolves'
      % (len(panel), len(GROUPS), len(wolves)))
PY

bcftools view -r "$REGION" -S fgf4.samples --force-samples \
  -i "POS=$INTRON1_POS || POS=$INTRON2_POS" \
  -Oz -o dog10k_fgf4_svs.vcf.gz "$SV" 2>/dev/null
tabix -f -p vcf dog10k_fgf4_svs.vcf.gz

# ── The whole collection ────────────────────────────────────────────────────
# The same two records with no sample subset. The grouping is the sample table's
# own Category column, so nothing here is a curated list: whether every wolf
# comes out homozygous reference is the question, not an input to it.
bcftools view -r "$REGION" -i "POS=$INTRON1_POS || POS=$INTRON2_POS" \
  -Oz -o dog10k_fgf4_cohort_svs.vcf.gz "$SV" 2>/dev/null
tabix -f -p vcf dog10k_fgf4_cohort_svs.vcf.gz

bcftools query -l dog10k_fgf4_cohort_svs.vcf.gz 2>/dev/null > cohort.samples
python3 - <<'PY'
CATEGORY = {'Breed_Dogs': 'Breed dog', 'Village_Dogs': 'Village dog',
            'Wolf': 'Gray wolf', 'Coyote': 'Coyote'}
ORDER = ['Breed dog', 'Village dog', 'Coyote', 'Gray wolf']

rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
meta = {r[0]: (r[1], CATEGORY.get(r[2], 'Other')) for r in rows if len(r) > 2}
samples = [l.strip() for l in open('cohort.samples')]

# Sorted by group, then breed: the display draws rows in the TSV's order, and at
# a third of a pixel a row the only readable structure is the blocks.
ordered = sorted(samples, key=lambda s: (
    ORDER.index(meta[s][1]) if meta.get(s, ('', ''))[1] in ORDER else len(ORDER),
    meta.get(s, ('', ''))[0], s))
with open('dog10k_fgf4_cohort_samples.tsv', 'w') as fh:
    fh.write('name\tlabel\tbreed\tgroup\n')
    for s in ordered:
        breed, group = meta.get(s, ('Unknown', 'Other'))
        fh.write('%s\t%s (%s)\t%s\t%s\n' % (s, s, breed, breed, group))
print('cohort: %d canids' % len(ordered))
PY

# ── What the panel actually carries ─────────────────────────────────────────
# Printed rather than written into the tutorial's prose, so the figure can be
# checked against the data that produced it.
echo
echo "Genotype counts per group, at the intron 1 record (chr18:$INTRON1_POS):"
bcftools query -r "chr18:$INTRON1_POS-$((INTRON1_POS + 1))" \
  -i "POS=$INTRON1_POS" -f '[%SAMPLE=%GT\n]' \
  dog10k_fgf4_cohort_svs.vcf.gz 2>/dev/null > cohort.gt
python3 - <<'PY'
import collections

meta = {}
for l in open('samples.txt'):
    r = l.rstrip('\n').split('\t')
    if len(r) > 2:
        meta[r[0]] = (r[1], r[2])

counts = collections.defaultdict(collections.Counter)
breeds = collections.defaultdict(collections.Counter)
for line in open('cohort.gt'):
    sample, gt = line.rstrip('\n').split('=')
    breed, category = meta.get(sample, ('?', '?'))
    call = {'0/0': 'hom ref', '0/1': 'het', '1/0': 'het',
            '1/1': 'hom alt'}.get(gt, 'no call')
    counts[category][call] += 1
    if category == 'Breed_Dogs':
        breeds[breed][call] += 1

for category, c in sorted(counts.items()):
    total = sum(c.values())
    print('  %-14s %4d canids: %s' % (category, total, ', '.join(
        '%d %s' % (n, k) for k, n in c.most_common())))

fixed_carrier = [b for b, c in breeds.items()
                 if sum(c.values()) >= 2 and c['hom ref'] == 0]
fixed_absent = [b for b, c in breeds.items()
                if sum(c.values()) >= 2 and c['het'] + c['hom alt'] == 0]
print()
print('  of %d breeds with two or more animals: %d carry it in every animal, '
      '%d in none' % (sum(1 for c in breeds.values() if sum(c.values()) >= 2),
                      len(fixed_carrier), len(fixed_absent)))
PY

# ── The two records against each other ──────────────────────────────────────
# Manta genotyped the two introns independently, so their agreement is a check
# on the reading rather than a restatement of it: one retrocopy removes both
# introns from the pileup at once, and a caller seeing noise would have no reason
# to put the same animals on both records.
echo
echo "The two records genotyped against each other, across the collection:"
bcftools query -f '[%SAMPLE=%GT\t]\n' dog10k_fgf4_cohort_svs.vcf.gz \
  2>/dev/null > both.gt
python3 - <<'PY'
import collections

rows = [l.rstrip('\t\n').split('\t') for l in open('both.gt')]
calls = [dict(f.split('=') for f in row) for row in rows]
samples = list(calls[0])
pairs = collections.Counter((calls[0][s], calls[1][s]) for s in samples)
agree = sum(n for (a, b), n in pairs.items() if a == b)
print('  %d of %d canids get the same call from both: %.1f%%'
      % (agree, len(samples), 100 * agree / len(samples)))
# genotypes carry slashes, so the pair is bracketed rather than joined by one
print('  most common (intron 1, intron 2) pairs: %s' % '  '.join(
    '(%s, %s) x%d' % (a, b, n) for (a, b), n in pairs.most_common(4)))
PY

echo
echo "Wrote $(pwd):"
echo "  dog10k_fgf4_svs.vcf.gz + dog10k_fgf4_samples.tsv        (named panel)"
echo "  dog10k_fgf4_cohort_svs.vcf.gz + dog10k_fgf4_cohort_samples.tsv"
echo "Load them with the track JSON in the retrogene tutorial."
