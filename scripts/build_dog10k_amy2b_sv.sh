#!/usr/bin/env bash
#
# Reproducibly build the two diet-gene tracks that
# website/docs/tutorials/dog10k_svs.md stacks against each other: the amylase
# duplication dogs carry and wolves do not, and the RNASE1 insertion wolves
# carry and dogs do not. One panel, sliced from two callsets in the same order,
# so the two lanes can be read row for row.
#
# The pancreatic amylase duplication is the best known copy-number difference
# between dogs and wolves (Axelsson et al. 2013). The Dog10K Manta callset
# carries it as an ordinary DUP record, chr6:47,375,677-47,390,529, which spans
# the amylase gene end to end. The UCSC ncbiRefSeq track for canFam4 names that
# gene LOC607460; NCBI Gene 607460 is "pancreatic alpha-amylase", aliases AMY2A
# and AMY2B.
#
# Genotyped, the record separates dogs from wolves almost completely, and the
# handful of animals on the wrong side of it is the reason to draw a panel
# rather than quote a frequency. What the record CANNOT say is how many copies
# an animal has, which is the measurement the locus is famous for: a dog with
# four copies and a dog with twenty are both "1/1" here. The tutorial says so,
# and points at the depth-ratio recipe in the CYP1A2 tutorial for the other
# half.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl,
#           python3.
# Usage:    bash scripts/build_dog10k_amy2b_sv.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_amy2b_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
# The Michigan aggregate Manta callset rather than the Zenodo Paragraph set the
# NHEJ1 and DENR sections use: at 1.08 GB it is the smaller of the two, covers
# the same 1,879 samples, and unlike the Paragraph set it carries DUP records,
# which is the whole point here.
SV=$SHARE/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
# The duplication, plus enough flank that both breakpoints sit inside the view.
REGION=chr6:47360000-47405000
DUP_POS=47375677

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# The panel, in the order the figure stacks it. Whole breeds throughout, because
# for this variant the animals that depart from their breed are the content and
# a head-N truncation could drop every one of them.
#
# Two ordinary breeds first, to establish what a dog row looks like. Then the
# three Arctic breeds together: two of the three Greenland Dogs are the only
# pure breed dogs in the collection called homozygous reference, and the
# Alaskan Malamutes and Samoyeds beside them are what stops that being read as
# "sled breeds lack it". The third Greenland Dog carries it, so the split is
# visible within one breed as well as between them.
#
# Then the two other breeds holding a non-carrier, again whole, so each
# exception sits next to its own breed-mates. The Czechoslovakian Wolfdog is
# also the subject of the local-ancestry tutorial, which paints CZEC000003's
# wolf-derived blocks on chr1.
#
# The three Alaskan village dogs ride along because one of them is the only
# village dog in the collection that lacks the duplication.
#
# Then every gray wolf in the analysis set, ordered by country. All 57 rather
# than a token few: the five carriers are what the panel is for, and which
# countries they come from is the reading the figure supports.
python3 - <<'PY' > amy2b.samples
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
# columns 12 and 17 are includedInVCF and SNP.keep: the analysis set
rows = [r for r in rows if r[11] == 'YES' and r[16] == 'TRUE']

breeds = ['Labrador Retriever', 'Boxer',
          'Greenland Dog', 'Alaskan Malamute', 'Samoyed',
          'English Springer Spaniel', 'Czechoslovakian Wolfdog']
out = []
for breed in breeds:
    out += [r[0] for r in rows if r[1] == breed]
out += [r[0] for r in rows if r[2] == 'Village_Dogs' and r[1] == 'Alaska']

# Wolves by country, Europe first then Asia, singleton countries last. The
# order is only the figure's; nothing downstream depends on it.
wolves = [r for r in rows if r[2] == 'Wolf']
order = ['Greece', 'Sweden', 'Portugal', 'Russia', 'China', 'Iran', 'Tajikistan']
for country in order:
    out += [r[0] for r in wolves if r[1] == country]
out += [r[0] for r in wolves if r[1] not in order]
print('\n'.join(out))
PY

# Only the duplication record. The window holds a second, overlapping DUP called
# at different breakpoints and a 174 bp deletion past its right edge; drawn
# together the three read as one striped block rather than as one duplication,
# the same problem the NHEJ1 section documents.
bcftools view -r "$REGION" -S amy2b.samples --force-samples \
  -i "POS=$DUP_POS" \
  -Oz -o dog10k_amy2b_svs.vcf.gz "$SV"
tabix -f -p vcf dog10k_amy2b_svs.vcf.gz

# The sample metadata TSV. The panel is whole breeds rather than a handful of
# named animals, so the rows are labelled through the adapter rather than
# through a display `layout`. `group` is the column the figure's `colorBy`
# paints, and it is deliberately category and not breed: the claim the swatch
# has to support is dog against wolf, and a swatch per breed would put 90 rows
# of legend beside a two-value result.
#
# The names come from the slice rather than from the request: two of the
# Tajikistan wolves in the analysis set are not in this callset's header, and a
# TSV naming a sample the VCF does not have is a row label with nothing under
# it.
bcftools query -l dog10k_amy2b_svs.vcf.gz > amy2b.kept
python3 - <<'PY' > dog10k_amy2b_samples.tsv
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
meta = {r[0]: (r[1], r[2]) for r in rows}
ids = [l.strip() for l in open('amy2b.kept') if l.strip()]
seen = {}
print('name\tgroup\tbreed')
for s in ids:
    breed, cat = meta[s]
    if cat == 'Wolf':
        group, label = 'Gray wolf', f'{breed} wolf'
    elif cat == 'Village_Dogs':
        group, label = 'Village dog', f'{breed} village dog'
    else:
        group, label = 'Breed dog', breed
    seen[label] = seen.get(label, 0) + 1
    print(f'{s}\t{group}\t{label} {seen[label]}')
PY

# Everything below is the check on the figure: the same record genotyped over
# every canid the callset carries, not just the panel. The tutorial quotes these
# counts, so they are derived here rather than measured once and written down.
echo
echo "Genotypes at the AMY2B duplication (chr6:$DUP_POS), whole collection:"
bcftools query -r "$REGION" -i "POS=$DUP_POS" -f '[%SAMPLE=%GT\n]' "$SV" \
  > amy2b_all.gt

python3 - <<'PY'
import collections
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
meta = {r[0]: (r[1], r[2]) for r in rows}
gt = dict(l.rstrip('\n').split('=') for l in open('amy2b_all.gt') if '=' in l)

NAMES = {'1/1': 'hom alt', '0/1': 'het', '0/0': 'hom ref', './.': 'no call'}
tally = collections.defaultdict(collections.Counter)
for s, g in gt.items():
    tally[meta.get(s, ('?', '?'))[1]][g] += 1
for cat, t in sorted(tally.items()):
    parts = ', '.join(f'{n} {NAMES.get(g, g)}'
                      for g, n in sorted(t.items(), key=lambda kv: -kv[1]))
    print(f'  {cat:14s} {sum(t.values()):5d} canids: {parts}')

print()
print('  Canids other than wolves NOT homozygous for the duplication:')
for s, g in sorted(gt.items()):
    breed, cat = meta.get(s, ('?', '?'))
    if cat != 'Wolf' and g != '1/1':
        print(f'    {s:14s} {g}  {breed} ({cat})')
print()
print('  Wolves that carry it:')
for s, g in sorted(gt.items()):
    breed, cat = meta.get(s, ('?', '?'))
    if cat == 'Wolf' and g not in ('0/0', './.'):
        print(f'    {s:14s} {g}  {breed}')
print()
wolves = {s: g for s, g in gt.items() if meta.get(s, ('', ''))[1] == 'Wolf'}
by = collections.defaultdict(collections.Counter)
for s, g in wolves.items():
    by[meta[s][0]][g] += 1
print('  Wolves by country:')
for c, t in sorted(by.items(), key=lambda kv: -sum(kv[1].values())):
    n, carr = sum(t.values()), t['0/1'] + t['1/1']
    print(f'    {c:14s} {n:3d} {"wolf" if n == 1 else "wolves"}, {carr} carrying')
PY

# ── RNASE1, the mirror image ────────────────────────────────────────────────
# The same panel at a second diet gene, so the two loci can be stacked and read
# row for row. RNASE1 encodes pancreatic ribonuclease, which digests RNA from
# ingested microbes and plant matter, and the callset carries a 223 bp SINE
# insertion in it at chr15:18,164,072. There the wolves are the carriers and the
# dogs are not, which is the reverse of the amylase record above.
#
# This one comes from the Zenodo Paragraph set rather than the Michigan Manta
# aggregate: insertions are what Paragraph genotyping added, and this record is
# not in the Manta set. Zenodo serves the file and its index from separate
# content URLs, so the index is named explicitly with ##idx##.
ZEN=https://zenodo.org/api/records/14968874/files
PARAGRAPH=$ZEN/Dog10k_manta_paragraph.vcf.gz/content
PARAGRAPH_IDX=$ZEN/Dog10k_manta_paragraph.vcf.gz.tbi/content
RNASE1_REGION=chr15:18155000-18175000
RNASE1_POS=18164072

bcftools view -r "$RNASE1_REGION" -S amy2b.samples --force-samples \
  -i "POS=$RNASE1_POS" \
  -Oz -o dog10k_rnase1_svs.vcf.gz "$PARAGRAPH##idx##$PARAGRAPH_IDX"
tabix -f -p vcf dog10k_rnase1_svs.vcf.gz

echo
echo "Genotypes at the RNASE1 insertion (chr15:$RNASE1_POS), whole collection:"
bcftools query -r "$RNASE1_REGION" -i "POS=$RNASE1_POS" -f '[%SAMPLE=%GT\n]' \
  "$PARAGRAPH##idx##$PARAGRAPH_IDX" > rnase1_all.gt

python3 - <<'PY'
import collections
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
meta = {r[0]: (r[1], r[2]) for r in rows}
gt = dict(l.rstrip('\n').split('=') for l in open('rnase1_all.gt') if '=' in l)

NAMES = {'1/1': 'hom alt', '0/1': 'het', '0/0': 'hom ref', './.': 'no call'}
tally = collections.defaultdict(collections.Counter)
for s, g in gt.items():
    tally[meta.get(s, ('?', '?'))[1]][g] += 1
for cat, t in sorted(tally.items()):
    parts = ', '.join(f'{n} {NAMES.get(g, g)}'
                      for g, n in sorted(t.items(), key=lambda kv: -kv[1]))
    print(f'  {cat:14s} {sum(t.values()):5d} canids: {parts}')

print()
print('  Canids other than wolves that carry it:')
for s, g in sorted(gt.items()):
    breed, cat = meta.get(s, ('?', '?'))
    if cat != 'Wolf' and g not in ('0/0', './.'):
        print(f'    {s:14s} {g}  {breed} ({cat})')
print()
by = collections.defaultdict(collections.Counter)
for s, g in gt.items():
    if meta.get(s, ('', ''))[1] == 'Wolf':
        by[meta[s][0]][g] += 1
print('  Wolves by country:')
for c, t in sorted(by.items(), key=lambda kv: -sum(kv[1].values())):
    n, carr = sum(t.values()), t['0/1'] + t['1/1']
    print(f'    {c:14s} {n:3d} {"wolf" if n == 1 else "wolves"}, {carr} carrying')
PY

echo
echo "Wrote $(pwd)/dog10k_amy2b_svs.vcf.gz and $(pwd)/dog10k_rnase1_svs.vcf.gz"
echo "      (plus their .tbi) and $(pwd)/dog10k_amy2b_samples.tsv, which labels"
echo "      both: the two slices carry the same panel in the same order."
echo "Load them with the track JSON in the structural-variant tutorial."
