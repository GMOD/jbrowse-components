---
title: Phased trio analysis
description: Examine inheritance patterns and variant phasing in a trio dataset
guide_category: Tutorials
---

A **trio** is sequencing data from a mother, father, and child together. A
**phased** VCF assigns each variant to one of the two haplotypes (`0|1` vs
`1|0`), so you can trace which copy of the genome each variant came from.

This tutorial uses a pre-built phased VCF from the 1000 Genomes Project — the
Kinh-Vietnamese trio HG02024 (chr1 only):

- [VCF](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- [Index (.tbi)](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz.tbi)

Add the VCF to JBrowse via the CLI (`jbrowse add-track`) or the in-app "Add
track" workflow (see the
[variant track guide](/docs/config_guides/variant_track)). Once loaded:

<Figure caption="Initial load of the VCF file, showing the default display mode with simple orange boxes for each variant" src="/img/trio-basic.png"/>

## Enabling the matrix view

Switch the track to the
[Multi-sample variant display (matrix)](/docs/user_guides/multivariant_track)
display. Each sample becomes a row, each variant a column, with black lines
connecting columns back to their genomic positions.

<Figure caption="Multi-sample variant display (matrix). Each sample is a row and each variant is a column; black lines connect columns to their genome positions." src="/img/trio-matrix.png"/>

## Enabling the phased mode

The matrix display has a "phased" rendering mode, available when the genotypes
use the `0|1` (phased) separator instead of `0/1` (unphased).

Ideally your variants are fully phased, which often requires a dedicated phasing
program such as SHAPEIT.

<Figure caption="Screenshot showing the phased rendering mode along with the menu item used to select it 'Rendering mode'->'Phased'" src="/img/trio-matrix-phased.png"/>

## Finding matching haplotypes with "visual phasing"

The term "visual phasing" comes from the genetic genealogy subfield. We borrow
it here, but the idea is simple: look at the genotype matrix and find areas
where different rows match. You would expect the child to match the mom in some
places and the dad in others. Each row looks like a barcode, so you can find
matching pieces by eye.

<Figure caption="Screenshot showing the phased rendering mode without any added markup. You can look at this figure and see various areas where rows match one another. The first two rows are the two haplotypes of the child, next two rows are the two haplotypes of the mom, and next two rows are the two haplotypes of the father" src="/img/trio-matrix-phased-clean.png"/>

## Using a program to help find phased blocks

In the above section, we could see matching blocks with our eyes, but can a
program help?

There are indeed options for this. The program
[hap-ibd](https://github.com/browning-lab/hap-ibd) can find "identical by
descent" blocks. It is actually capable of finding such blocks in massive
population-scale datasets, but we are applying it here to a smaller trio VCF.
The hap-ibd program takes as input:

- a phased VCF like the
  [trio dataset](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- a genetic map in PLINK format (the README of hap-ibd provides these for
  GRCh38)

## What we're visualizing: crossover points

Each of the child's inherited chromosomes is a mosaic of the two copies its
parent carries, spliced together at
[recombination](https://www.genome.gov/genetics-glossary/Crossing-Over)
(crossing-over) breakpoints. The painting below marks exactly where those
splices fall along each chromosome.

<Figure caption="Crossing-over: the exchange of DNA between paired homologous chromosomes during meiosis. Figure from the NHGRI genetics glossary." src="/img/crossing_over.jpg"/>

## Running hap-ibd

hap-ibd needs the phased VCF and a genetic map. The trio VCF labels its
chromosome `1` (no `chr` prefix), so use the `no_chr_in_chrom_field` variant of
the GRCh38 PLINK map:

```bash
java -jar hap-ibd.jar \
  gt=HG02024_VN049_KHVTrio.chr1.vcf.gz \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0
```

This writes `trio.ibd.gz`, one row per shared segment, with columns: sample1,
hap1, sample2, hap2, chrom, start, end, cM-length. In a trio, every segment
pairs the child with one parent, and the child's two haplotypes split cleanly
between the parents:

| child haplotype | matches parent   | inherited copy |
| --------------- | ---------------- | -------------- |
| HG02024:1       | HG02026 (father) | paternal       |
| HG02024:2       | HG02025 (mother) | maternal       |

(The parent roles come from the 1000 Genomes pedigree line
`VN049 HG02024 HG02026 HG02025` — father HG02026, mother HG02025.) Within a
child haplotype the matching _parental_ copy flips between the parent's copy 1
and copy 2 at each recombination breakpoint — that flip is the crossing-over
event we want to see.

The raw segments are fragmented, though: hap-ibd only emits stretches that pass
its cM-length thresholds, so there are gaps, and statistically-phased data (see
[Is hap-ibd the right tool?](#is-hap-ibd-the-right-tool) below) sprinkles in
short spurious flips. So we don't paint the raw segments — we first collapse
them into clean inheritance blocks.

## Converting hap-ibd data into painted inheritance blocks

We want **one row per parental haplotype** — father copy 1, father copy 2,
mother copy 1, mother copy 2 — and we want the child's inherited chromosome
tiled across each parent's pair of rows, so that a crossover shows up as the
painted block stepping from one row to its partner. The script below does three
things per child haplotype: merges adjacent segments of the same parental copy
into runs, drops short interior runs (the switch-error specks), and snaps each
remaining crossover to the midpoint of the gap between runs so the blocks abut
(leaving genuine large gaps, like the centromere, blank).

```python
import gzip

CHILD, FATHER, MOTHER = 'HG02024', 'HG02026', 'HG02025'
MAX_GAP, MIN_RUN_CM = 6_000_000, 2.5  # tiling cap; min interior-run length
STYLE = {  # parental copy -> (row label, itemRgb): father blues, mother reds
    (FATHER, 1): ('Father hap1', '31,120,180'),
    (FATHER, 2): ('Father hap2', '166,206,227'),
    (MOTHER, 1): ('Mother hap1', '227,26,28'),
    (MOTHER, 2): ('Mother hap2', '251,154,153'),
}

segs = {1: [], 2: []}  # child haplotype 1 = paternal, 2 = maternal
for line in gzip.open('trio.ibd.gz', 'rt'):
    s1, h1, s2, h2, chrom, start, end, cm = line.split('\t')
    child, chap, par, phap = (s1, int(h1), s2, int(h2)) if s1 == CHILD else (s2, int(h2), s1, int(h1))
    segs[chap].append((int(start), int(end), par, phap, float(cm)))

def runs(seglist):
    seglist.sort()
    out = []
    for start, end, par, phap, cm in seglist:
        if out and out[-1][2:4] == [par, phap]:
            out[-1][1] = max(out[-1][1], end); out[-1][4] += cm
        else:
            out.append([start, end, par, phap, cm])
    changed = True
    while changed:  # drop short interior runs flanked by the same opposite copy
        changed = False
        for i in range(1, len(out) - 1):
            if out[i][4] < MIN_RUN_CM and out[i - 1][2:4] == out[i + 1][2:4]:
                out[i - 1][1] = max(out[i - 1][1], out[i + 1][1]); out[i - 1][4] += out[i + 1][4]
                del out[i:i + 2]; changed = True; break
    return out

rows = []
for chap in (1, 2):
    paint = [[r[0], r[1], r[2], r[3]] for r in runs(segs[chap])]
    for a, b in zip(paint, paint[1:]):
        if b[0] - a[1] <= MAX_GAP:
            a[1] = b[0] = (a[1] + b[0]) // 2  # snap crossover to the gap midpoint
    rows += paint

with open('trio.hapibd.bed', 'w') as fh:
    fh.write('#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tparenthap\n')
    for start, end, par, phap in sorted(rows):
        label, rgb = STYLE[(par, phap)]
        fh.write(f'1\t{start}\t{end}\t{label}\t0\t.\t{start}\t{end}\t{rgb}\t{label}\n')
```

```bash
bgzip trio.hapibd.bed
tabix -p bed trio.hapibd.bed.gz
```

Load the result as a `FeatureTrack` whose display is a
`LinearMultiRowFeatureDisplay`: partition rows by the `parenthap` column, order
the four rows father-then-mother, and read each block's color from `itemRgb`.

```json
{
  "type": "FeatureTrack",
  "trackId": "khv_trio_hapibd",
  "name": "KHV trio hap-ibd haplotype blocks (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb",
      "parenthap"
    ],
    "bedGzLocation": { "uri": "trio.hapibd.bed.gz" },
    "index": { "location": { "uri": "trio.hapibd.bed.gz.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "khv_trio_hapibd-LinearMultiRowFeatureDisplay",
      "partitionField": "parenthap",
      "color": "jexl:'rgb('+get(feature,'itemRgb')+')'",
      "rowOrder": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
    }
  ]
}
```

## Visualizing crossing-over points

The painting is now automatic — no manual markup needed. The four rows are the
two parental copies of each parent (blues for father HG02026, reds for mother
HG02025):

<Figure caption="hap-ibd inheritance blocks painted with the multi-row feature display. The top two rows (blue) are father HG02026's two haplotypes; the bottom two (red) are mother HG02025's. The child's paternal chromosome is tiled across the two blue rows and its maternal chromosome across the two red rows, so each crossover is the crisp boundary where a painted block steps from one row to its partner." src="/img/trio-hapibd-painting.png"/>

Read the two blue rows together as the child's single **paternal** chromosome:
at any position exactly one of them is filled, telling you which of the father's
two copies the child inherited there. Each place the block steps between the two
blue rows is a **crossing-over point**. The two red rows are the same story for
the **maternal** chromosome.

## Relating the painting back to the genotypes

Stacking the painting directly above the same VCF in the **phased multi-sample
variant display** shows where the blocks come from. That display draws the
genotypes at their genomic positions (use it rather than the _matrix_ mode,
whose evenly-spaced columns no longer line up with the painting). It has six
rows — the two haplotypes of each trio member — and the painting is just a
summary of which parental haplotype the child's haplotype matches at each
position.

A crossover spans only a single base, so the whole-chromosome view is far too
zoomed-out to read it off the genotypes — at that scale the matrix is a solid
wall of color. Zoom instead to a few hundred kb around one boundary, where the
painting's block-step is unmistakable and the genotype columns resolve into
individual variants. The clearest crossover to start with is the **paternal**
one near chr1:29.7 Mb:

<Figure caption="Paternal crossover near chr1:29.7 Mb (~400 kb wide). In the painting (top) the child's paternal chromosome steps from Father hap2 (light blue) to Father hap1 (dark blue); an arrow drops to the same breakpoint in the genotypes below. The tinted frames read the switch off the raw genotypes: left of the crossover the yellow frame ties Child hap1 to Father hap2, right of it the purple frame ties Child hap1 to Father hap1, and the yellow/purple blocks on the Child hap1 row abut exactly at the breakpoint." src="/img/trio-crossover-paternal.png"/>

The **maternal** chromosome does the same thing at its own boundaries. Near
chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="Maternal crossover near chr1:55.8 Mb (~400 kb wide), the cleanest maternal boundary on chr1. The child's maternal chromosome steps from Mother hap2 (pink) to Mother hap1 (red). Same idea as the paternal figure in its own palette: the green frame ties Child hap2 to Mother hap2 left of the crossover, the orange frame ties it to Mother hap1 right of it, and the green/orange blocks abut at the breakpoint on the Child hap2 row." src="/img/trio-crossover-maternal.png"/>

The painting is the clean, readable summary; the genotype rows are the raw,
statistically-phased evidence it is built from, and that evidence is noisy. If
you read the inherited copy site-by-site straight off the genotypes it flickers
between the two parental copies every few kb — those flickers are phasing switch
errors, not crossovers. hap-ibd's length threshold filters most of them out,
which is exactly why we trust its block-step over the raw genotypes. It does not
filter all of them, though: many of the painting's smaller boundaries do not
survive a check against the genotype transmission, so treat the two crossovers
above as the well-supported ones and the rest as approximate. The next section
is about why.

## Is hap-ibd the right tool?

Not really — and it's worth being honest about why. hap-ibd is built to detect
IBD between _distantly_ related individuals in large cohorts, so its cM-length
thresholds are tuned to suppress false positives. A parent and child share a
whole haplotype, which is a much stronger signal, so hap-ibd's thresholds end up
fighting you: too strict and the blocks are sparse, too loose and short spurious
segments creep in (which is why tuning the block-size parameters matters, and
why we post-process into consensus runs above).

The deeper issue is the input data. This 1000 Genomes VCF is _statistically_
phased, not trio- or read-backed phased, so its haplotypes carry **switch
errors** every megabase or so. If you skip hap-ibd entirely and read the
inherited copy straight off the genotypes (at sites where a parent is
heterozygous, the child's transmitted allele names the parental copy), chr1
appears to have ~50 crossovers per parent — but a real human meiosis has only
about [one to three per chromosome](https://www.nature.com/articles/ng.3669).
Almost all of those apparent switches are phasing errors, not biology. hap-ibd's
length threshold is, in effect, a switch-error filter, which is what makes its
(post-processed) output look closer to the truth here.

So for a clean, _exact_ crossover map you would first re-phase the trio with a
pedigree-aware or read-backed phaser (e.g. SHAPEIT with the pedigree, or
WhatsHap on long reads) and then read the mosaic directly from the genotypes.
hap-ibd is a reasonable stand-in when all you have is a statistically-phased
VCF, as long as you treat the block boundaries as approximate.

## A direct alternative: read crossovers from the genotypes

If you want to skip hap-ibd, the direct method is short enough to keep as a
small command-line script. It produces the same painted BED (so it drops
straight into the track config above), and the `--min-sites` smoothing parameter
exposes the switch-error tradeoff directly: lower values track the noisy raw
phasing, higher values collapse toward the few real crossovers.

```python title="trio_crossovers.py"
#!/usr/bin/env python3
"""Call crossover blocks directly from a phased trio VCF (no hap-ibd).

At a site where a parent is heterozygous, the child's transmitted allele names
which of that parent's two haplotypes was passed on; a crossover is where that
choice flips. Emits a BED painted for LinearMultiRowFeatureDisplay (one row per
parental haplotype). It reads the phasing as-is, so it inherits the VCF's switch
errors -- raise --min-sites to smooth them.
"""
import argparse
import gzip

STYLE = {
    ('father', 1): ('Father hap1', '31,120,180'),
    ('father', 2): ('Father hap2', '166,206,227'),
    ('mother', 1): ('Mother hap1', '227,26,28'),
    ('mother', 2): ('Mother hap2', '251,154,153'),
}

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--vcf', required=True)
ap.add_argument('--child', required=True)
ap.add_argument('--father', required=True)
ap.add_argument('--mother', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--min-sites', type=int, default=200,
                help='merge runs shorter than this many informative sites')
ap.add_argument('--max-gap', type=int, default=6_000_000)
args = ap.parse_args()
op = gzip.open if args.vcf.endswith('.gz') else open

col, chrom, raw, votes = {}, '?', [], [0, 0]
with op(args.vcf, 'rt') as fh:
    for line in fh:
        if line.startswith('##'):
            continue
        f = line.rstrip('\n').split('\t')
        if line.startswith('#CHROM'):
            col = {name: i for i, name in enumerate(f)}
            continue
        chrom = f[0]
        c, fa, mo = (f[col[s]].split(':')[0].split('|')
                     for s in (args.child, args.father, args.mother))
        if not (len(c) == len(fa) == len(mo) == 2):
            continue
        raw.append((int(f[1]), c, fa, mo))
        if fa[0] != fa[1]:  # vote: which child allele matches the father
            votes[0 if c[0] in fa and c[1] not in fa else 1] += 1
pat = 0 if votes[0] >= votes[1] else 1

informative = {'father': [], 'mother': []}
for pos, c, fa, mo in raw:
    if fa[0] != fa[1] and c[pat] in fa:
        informative['father'].append((pos, 1 if c[pat] == fa[0] else 2))
    if mo[0] != mo[1] and c[1 - pat] in mo:
        informative['mother'].append((pos, 1 if c[1 - pat] == mo[0] else 2))

rows = []
for role in ('father', 'mother'):
    runs = []  # [start, end, copy, nsites]
    for pos, copy in sorted(informative[role]):
        if runs and runs[-1][2] == copy:
            runs[-1][1], runs[-1][3] = pos, runs[-1][3] + 1
        else:
            runs.append([pos, pos, copy, 1])
    changed = True
    while changed:  # absorb short runs flanked by the same opposite copy
        changed = False
        for i in range(1, len(runs) - 1):
            if runs[i][3] < args.min_sites and runs[i - 1][2] == runs[i + 1][2]:
                runs[i - 1][1] = runs[i + 1][1]
                runs[i - 1][3] += runs[i + 1][3]
                del runs[i:i + 2]
                changed = True
                break
    runs = [r for r in runs if r[3] >= args.min_sites]
    merged = []
    for r in runs:
        if merged and merged[-1][2] == r[2]:
            merged[-1][1] = r[1]
        else:
            merged.append(r[:])
    paint = [[r[0], r[1], role, r[2]] for r in merged]
    for a, b in zip(paint, paint[1:]):
        if b[0] - a[1] <= args.max_gap:
            a[1] = b[0] = (a[1] + b[0]) // 2
    rows += paint
    print(f'{role}: {len(merged)} blocks -> {max(len(merged) - 1, 0)} crossovers')

with open(args.out, 'w') as fh:
    fh.write('#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\t'
             'thickStart\tthickEnd\titemRgb\tparenthap\n')
    for start, end, role, copy in sorted(rows):
        label, rgb = STYLE[(role, copy)]
        fh.write(f'{chrom}\t{start}\t{end}\t{label}\t0\t.\t{start}\t{end}\t{rgb}\t{label}\n')
```

```bash
python trio_crossovers.py --vcf HG02024_VN049_KHVTrio.chr1.vcf.gz \
  --child HG02024 --father HG02026 --mother HG02025 \
  --out trio.direct.bed --min-sites 200
bgzip trio.direct.bed && tabix -p bed trio.direct.bed.gz
```

On this VCF that reports 6 paternal and 8 maternal crossovers — still a few more
than biology, because no amount of post-hoc smoothing fully undoes statistical
phasing switch errors. That is the honest bottom line: this belongs in a
command-line preprocessing step, not inside JBrowse, and the cleanest input is a
well-phased trio VCF.

## See also

For structural variant analysis with the 1000 Genomes dataset — multi-sample
genotypes, trio inheritance of SVs, and a large chromosomal inversion — see the
[Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) tutorial.

## Live demo

[Open this session](https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg38","loc":"1:62,174,000-65,097,304","tracks":[{"trackId":"HG02024_VN049_KHVTrio.chr1.vcf","displaySnapshot":{"type":"LinearVariantMatrixDisplay","renderingMode":"phased","minorAlleleFrequencyFilter":0.1}}]}]})
to explore the trio dataset described above. The "Open this view in JBrowse"
link under the painting figure opens the hap-ibd track on its own.
