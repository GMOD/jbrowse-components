---
title: Local ancestry (Dog10K)
sidebar_label: Local ancestry (Dog10K)
description:
  Paint wolf-derived haplotype blocks in two wolfdog breeds from the Dog10K
  phased panel
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** run [FLARE](https://github.com/browning-lab/flare) on the public
Dog10K phased panel with a gray wolf panel and a breed-dog panel, collapse its
per-marker `AN1`/`AN2` calls into BED9 runs with `itemRgb`, and point a
`LinearMultiRowFeatureDisplay`'s `partitionField` at the haplotype column to
paint one row per haplotype.

## Prerequisites

To build the tracks:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all these tracks need, see the
  [assemblies guide](/docs/config_guides/assemblies))
- Java 8+, for FLARE
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`bgzip`,
  `tabix`)

## The dataset and the question

The Saarloos Wolfdog and the Czechoslovakian Wolfdog are both 20th-century
crosses between German Shepherd Dogs and captive gray wolves, bred back to dogs
afterwards. Each individual should therefore carry wolf-derived haplotype blocks
on an otherwise dog background, and a German Shepherd should carry essentially
none. That makes the pair a local-ancestry problem with a built-in control.

Two more breeds ride along, both taken from the Dog10K paper's own discussion of
wolf-like dogs. The Shiloh Shepherd shares 78% of its doubleton (F2) sites with
wolves, the highest of any breed dog in the collection, though the paper's
D-statistics find no significant excess over German Shepherds. The Tamaskan is a
wolf-lookalike bred from ordinary sled and herding dogs. Painting all of them at
once asks whether a genome-wide sharing statistic and a wolfish appearance point
at the same thing local ancestry does.

The [Dog10K consortium](https://www.dog10kgenomes.org/) publishes a phased
reference panel of 1929 canids on the `UU_Cfam_GSD_1.0` assembly, which includes
both wolfdog breeds, 57 gray wolves, and hundreds of breed dogs. Local ancestry
is a per-segment statistical estimate of which reference panel a stretch of
chromosome most resembles, which is exactly what "wolf-derived block" means when
the panels are wolves and dogs.

## The pipeline

Five artifacts stand between the published panel and the painted track. Each one
is a plain text or VCF file you can open and check:

```
Dog10K sample table ──> wolves.txt, dogs.txt, targets.txt, refpanel.txt
Dog10K phased BCF ────> chr1.ref.vcf.gz + chr1.gt.vcf.gz   (bcftools view -r)
                        chr1.map                            (uniform 1 cM/Mb)
                              │
                              v  FLARE
                        wolfdog_chr1.anc.vcf.gz   per-marker AN1/AN2 calls
                        wolfdog_chr1.global.anc.gz  per-sample summary
                              │
                              v  flare_anc_to_bed.py + labels.tsv
                        dog10k_wolfdog_ancestry.chr1.bed.gz  one run per block
                              │
                              v  BedTabixAdapter + LinearMultiRowFeatureDisplay
                        one painted row per haplotype
```

### Who goes in which panel

The sample table carries a breed and a category per animal, which is enough to
derive every list:

```bash
# wolves.txt: European gray wolves, matching both breeds' founder populations
awk -F'\t' '$3=="Wolf" && ($2=="Greece"||$2=="Sweden"||$2=="Russia"||
  $2=="Portugal"||$2=="Europe"||$2=="Eurasia"){print $1}' keep.tsv > wolves.txt

# dogs.txt: one dog from every breed, minus the targets and both wolfdog breeds
awk -F'\t' '$3=="Breed_Dogs" && $2 !~ /Wolfdog|Shiloh|Tamaskan/ {print $1"\t"$2}' \
  keep.tsv | grep -v -F -f targets.txt | sort -t$'\t' -k2,2 -u | cut -f1 > dogs.txt
```

The panels decide what the colors mean, so this is the step that matters most,
and breadth is the part worth getting right. One dog from each of 318 breeds
reads as "generic dog"; an earlier version of this took the first 60 breeds by
name, which is everything from Affenpinscher to Cocker Spaniel and no shepherd
at all, leaving the targets' own dog background unrepresented. Rerunning with
the full panel dropped the German Shepherd control from 0.4% wolf to 0.0% and
left the wolfdogs where they were. FLARE reads the two lists as one `ref-panel`
file:

```
CLUPGR000001	Wolf
CLUPGR000002	Wolf
AFFN000001	Dog
AFGH000001	Dog
```

### Slicing the panel

The panel is a single 6 GB BCF. `bcftools` reads it over HTTP by range request,
so a chromosome costs a chromosome, not the whole file:

```bash
bcftools view -r chr1 -S all.txt --force-samples -Oz -o chr1.subset.vcf.gz \
  https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
```

That subset then splits into `chr1.ref.vcf.gz` (the two panels) and
`chr1.gt.vcf.gz` (the targets: four Saarloos, four Czechoslovakian Wolfdogs, and
the German Shepherd, Shiloh Shepherd, and Tamaskan controls).

### The genetic map

FLARE requires one, and the published dog maps are on canFam3.1 while this panel
is phased on `UU_Cfam_GSD_1.0`. The build script therefore generates a uniform 1
cM/Mb map, close to the dog genome-wide average. Block boundaries are
approximate as a result, which is worth remembering when reading a single
boundary rather than the overall mosaic.

### Running FLARE

```bash
java -jar flare.jar \
  ref=chr1.ref.vcf.gz ref-panel=refpanel.txt gt=chr1.gt.vcf.gz \
  map=chr1.map out=wolfdog_chr1 seed=42
```

Check `wolfdog_chr1.global.anc.gz` before painting anything. It is the
per-sample summary, and on chr1 it already sorts the targets:

```
SAMPLE          Wolf    Dog
SAAR000001      0.443   0.557
CZEC000003      0.295   0.705
SHIL000001      0.216   0.784
TMSK000001      0.033   0.967
GRSD000002      0       1
```

### Collapsing calls into blocks

FLARE writes per-marker calls into the `AN1`/`AN2` `FORMAT` fields of
`wolfdog_chr1.anc.vcf.gz`.
[`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py)
collapses each haplotype's run of identical calls into one BED9 line, taking row
labels from a two-column `labels.tsv` and coloring by ancestry via `itemRgb`:

```
chr1	11579924	11605808	Wolf	0	.	11579924	11605808	230,159,0	Czechoslovakian 1 hap1	Wolf
```

The last two columns are the ones the display needs: the row this block belongs
to, and the ancestry it was called.

## Loading it as a multi-row track

`LinearMultiRowFeatureDisplay` draws one row per distinct value of
`partitionField`, so pointing it at the `sample` column gives one row per
haplotype, and `rowOrder` sets their top-to-bottom order. There is no color
config: a BED carrying `itemRgb` is painted with it automatically.

```json
{
  "type": "FeatureTrack",
  "trackId": "dog10k_wolfdog_ancestry",
  "name": "Wolfdog local ancestry (FLARE, chr1)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
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
      "sample",
      "ancestry"
    ],
    "uri": "dog10k_wolfdog_ancestry.chr1.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "rowOrder": [
        "Saarloos 1 hap1",
        "Saarloos 1 hap2",
        "Czechoslovakian 1 hap1",
        "Czechoslovakian 1 hap2",
        "German Shepherd 1 hap1",
        "German Shepherd 1 hap2"
      ]
    }
  ]
}
```

`rowOrder` is abbreviated here; the build script writes all twenty-two rows.

## Reading the painting

<Figure caption="Dog10K chr1 painted by FLARE against gray wolf and breed-dog panels, two haplotype rows per animal. Wolf blocks (orange) tile the four Saarloos Wolfdogs and, in fewer and longer runs, the four Czechoslovakian Wolfdogs. The German Shepherd is near-solid dog (blue), the Shiloh Shepherd carries long wolf blocks, and the Tamaskan carries only flecks. The highlighted band is the wolf block dissected below." src="/img/dog10k-wolfdog-ancestry.png" />

Read each pair of rows as one animal's two chromosome copies. Wolf on one row
and dog on the other is a heterozygous stretch; both orange is homozygous
wolf-derived. The breeds separate on block length as well as on total wolf
fraction, and length is the more informative of the two: a recent cross leaves
long founder haplotypes because recombination has had few generations to break
them up.

The German Shepherd row is the check. Same panel, same FLARE run, same
references, and on this chromosome it takes one 104 kb wolf block in total, so
the orange elsewhere is signal rather than an artifact of the panels.

### What the two wolf-like breeds do

The Tamaskan behaves like a dog that merely looks like a wolf: its wolf
assignments are 27 short flecks, median 85 kb, none longer than about a
megabase, which is the same noise floor the German Shepherd sits on. Appearance
carries no ancestry.

The Shiloh Shepherd does not. It takes 23 wolf blocks with a median around 1.5
Mb and a longest of nearly 10 Mb, a length distribution much closer to a
Czechoslovakian Wolfdog than to the Tamaskan. Stated carefully: it agrees with
the Dog10K paper's observation that this individual shares more doubleton sites
with wolves than any other breed dog, but the same paper's D-statistics find no
significant excess of wolf allele sharing over German Shepherd Dogs. Only one
Shiloh Shepherd exists in the collection, and both a single sample and a single
chromosome are thin evidence. Read it as a lead to follow, not a settled result,
and note the shape of the disagreement: a genome-wide sharing fraction and a
block-length distribution are different measurements, and this is the sort of
case where they diverge.

## Checking a block against the genotypes

A painted block is an inference, and the genotypes it was inferred from are
right there in the panel. Saarloos 1 is called Wolf on hap1 and Dog on hap2
across the highlighted block above, so inside that block its two haplotype rows
should track different reference groups. Loading the same window's phased
genotypes underneath the painting shows exactly that:

<Figure caption="A 40 kb window inside the wolf block. Top: the painting, with Saarloos 1 hap1 orange and hap2 blue. Bottom: the panel's phased genotypes as a matrix, eight gray wolves above and eight breed dogs below, blue where a haplotype carries the alt allele. Where the Saarloos wolf-called haplotype carries an alt allele, most wolf haplotypes carry it and almost no dog haplotype does." src="/img/dog10k-wolfdog-block-genotypes.png" />

This is the check worth running on any local-ancestry call before building
anything on top of it: the painting is a summary, and the summary should be
visible in the raw genotypes. It is also how you would follow up the Shiloh
Shepherd's blocks.

## Repartitioning the same display

The row structure comes entirely from the BED column `partitionField` names.
Pointing it at a different column repartitions the same display: the
[phased trio tutorial](/docs/tutorials/analyze_trio) points it at parental
haplotype to paint inheritance blocks from hap-ibd, and the
[BXD QTL tutorial](/docs/tutorials/bxd_qtl) points it at strain.

## Reproduce it end to end

[`build_dog10k_wolfdog_ancestry.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_wolfdog_ancestry.sh)
runs every step above:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_wolfdog_ancestry.sh
bash build_dog10k_wolfdog_ancestry.sh       # chr1, into ./dog10k_wolfdog_build
bash build_dog10k_wolfdog_ancestry.sh chr38 # any other autosome
```

It downloads the Dog10K sample table, derives the panel and target lists, slices
that chromosome out of the phased panel, generates the map, runs FLARE, prints
the per-sample summary, and writes the painted BED
([`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py))
plus its index and the genotype slice the second figure uses.

## See also

- [](/docs/tutorials/dog10k_svs),
  [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof),
  [Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection) and
  [Retrogene (Dog10K)](/docs/tutorials/dog10k_retrogene), the other Dog10K
  tutorials, on the same assembly
- [](/docs/tutorials/analyze_trio), the same display painted from hap-ibd
  inheritance blocks
- [QTL visualization example (strain painting)](/docs/tutorials/bxd_qtl)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)

## References

Meadows, J. R. S., Kidd, J. M., Wang, G.-D., et al. (2023).
[Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7).
_Genome Biology_, _24_(1), 187.

Browning, S. R., Waples, R. K., and Browning, B. L. (2023).
[Fast, accurate local ancestry inference with FLARE](https://doi.org/10.1016/j.ajhg.2023.02.010).
_American Journal of Human Genetics_, _110_(2), 326-335.
