---
title: Local ancestry (Dog10K)
description:
  Paint wolf-derived haplotype blocks in two wolfdog breeds, against 219 other
  breeds and eight held-out wolves, from the Dog10K phased panel
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** two of these dog breeds are wolf hybrids, so parts of their genome
trace back to a gray wolf ancestor rather than a domestic dog.
[FLARE](https://github.com/browning-lab/flare) calls which of the two sources
each stretch of DNA came from, against a wolf panel and 219 other breeds, and we
paint the result as one colored row per haplotype.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all these tracks need, see the
  [assemblies guide](/docs/config_guides/assemblies))
- Java 8+, for FLARE
- `bcftools` built with libcurl
- `curl`
- `python3`
- htslib (`bgzip`, `tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3 default-jre` covers
all of it, and the packaged `bcftools` is linked against libcurl. `flare.jar` is
a single download from FLARE's
[releases page](https://github.com/browning-lab/flare/releases). The painted BED
is a local file, so [JBrowse Desktop](/docs/quickstart_desktop) opens it by
path, while JBrowse Web needs it served.

## Where the data comes from

The Dog10K consortium's public phased reference panel
([Meadows et al. 2023](https://doi.org/10.1186/s13059-023-03023-7)), plus a
canFam4 genetic map published separately.

- the phased reference panel of 1929 canids FLARE runs against:
  https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
- the sample table, breed and category labels the panels and targets are derived
  from:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
- the Campbell pedigree map, transitioned onto this panel's own assembly
  ([Wang et al. 2025](https://doi.org/10.5281/zenodo.17095604)):
  https://zenodo.org/records/17095604/files/campbell_sex_average_canFam4.tar.gz?download=1

## Two wolfdog breeds and their wolf blocks

The Saarloos Wolfdog and the Czechoslovakian Wolfdog are both 20th-century
crosses between German Shepherd Dogs and captive gray wolves, bred back to dogs
afterwards. Each should carry wolf-derived haplotype blocks on a dog background,
and a German Shepherd essentially none.

Two more breeds ride along, from the Dog10K paper's own discussion of wolf-like
dogs:

- the **Shiloh Shepherd** shares more of its doubleton (F2) sites with wolves
  than any other breed dog in the collection
- the **Tamaskan** is a wolf-lookalike bred from ordinary sled and herding dogs

One dog from each of the 219 breeds with four or more sequenced goes in as well,
so the run sweeps every breed for a cross. Eight European gray wolves go in as
targets too, each removed from the wolf panel first.

The [Dog10K consortium](https://www.dog10kgenomes.org/) publishes a phased panel
of 1929 canids on `UU_Cfam_GSD_1.0`, including both wolfdog breeds, 57 gray
wolves, and hundreds of breed dogs. Local ancestry is a per-segment estimate of
which reference panel a stretch of chromosome most resembles.

## The files between the panel and the painting

Every artifact between the panel and the painted track is a plain text, VCF or
BED file:

<Figure caption="The Dog10K sample table and phased BCF at the top, the panel lists and per-chromosome VCFs FLARE takes as input in the middle, and the BED9 files the track reads at the bottom." src="/img/wolfdog_ancestry_pipeline.png" />

### Who goes in which panel

The sample table carries a breed and a category per animal, from which the build
script derives every list: European gray wolves for the wolf panel, and one dog
from every breed for the dog panel, minus the targets and both wolfdog breeds.
Each target's own dog background has to be in the dog panel for its ordinary
haplotypes to land there.

An animal cannot be in a panel and painted against it:

- the eight gray wolves are **removed from the wolf panel**, since a target
  matched against itself paints solid
- each swept animal comes out of the dog panel while its **breed** stays in, so
  a Chow Chow is painted against other Chow Chows

FLARE reads the two lists as one `ref-panel` file:

```
CLUPGR000001	Wolf
CLUPGR000002	Wolf
AFFN000001	Dog
AFGH000001	Dog
```

### Slicing the panel

The panel is a single 6 GB BCF, and `bcftools` reads it over HTTP by range
request. The chromosome subset splits into `chr1.ref.vcf.gz` (the two panels)
and `chr1.gt.vcf.gz` (the 243 targets).

<!-- from: scripts/build_dog10k_wolfdog_ancestry.sh -->

```bash
PANEL=https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
# -r over HTTP costs one chromosome, not the whole 6 GB file; the two later
# views re-slice that local subset rather than fetching twice
bcftools view -r chr1 -S all.txt --force-samples -Oz -o chr1.subset.vcf.gz "$PANEL"
bcftools view -S <(cat wolves.txt dogs.txt) --force-samples \
  -Oz -o chr1.ref.vcf.gz chr1.subset.vcf.gz
bcftools view -S targets.txt --force-samples -Oz -o chr1.gt.vcf.gz chr1.subset.vcf.gz
```

Each of `all.txt`, `wolves.txt`, `dogs.txt` and `targets.txt` is one sample name
per line; the build script derives them from the Dog10K sample table.

### The genetic map

FLARE requires one. The Campbell pedigree map has been transitioned onto
`UU_Cfam_GSD_1.0`, so no liftover is needed. The build script reshapes its
`POS`/`rate`/`Map(cM)` columns into the four PLINK columns FLARE reads.

### Running FLARE

FLARE takes the two panel VCFs, the `ref-panel` file, and the map, and writes
`wolfdog_chr1.anc.vcf.gz` plus a summary:

<!-- from: scripts/build_dog10k_wolfdog_ancestry.sh -->

```bash
# FLARE draws random samples while it infers, so two runs of the same input
# give slightly different block boundaries unless the seed is pinned.
#   seed=42    any fixed number, so a re-run reproduces this painting exactly
#   -Xmx12g    Java's memory ceiling, raise it for more targets or a longer
#              chromosome (FLARE dies with an OutOfMemoryError rather than
#              slowing down)
#   out=       a prefix, not a file: FLARE appends .anc.vcf.gz, .global.anc.gz
java -Xmx12g -jar flare.jar ref=chr1.ref.vcf.gz ref-panel=refpanel.txt \
  gt=chr1.gt.vcf.gz map=chr1.map out=wolfdog_chr1 seed=42
```

`wolfdog_chr1.global.anc.gz` is the per-sample summary, and on chr1 it already
sorts the targets:

```
SAMPLE          Wolf    Dog
CLUPRU000001    0.996   0.004     held-out gray wolf
SAAR000001      0.446   0.554     Saarloos Wolfdog
CZEC000003      0.281   0.719     Czechoslovakian Wolfdog
SHIL000001      0.225   0.775     Shiloh Shepherd
THAI000009      0.08    0.92      top of the 219-breed sweep
TMSK000001      0.033   0.967     Tamaskan
GRSD000002      0       1         German Shepherd Dog
```

Nearly all swept breeds come in at a trace of wolf, and seven of the eight
wolfdogs sit far above them. The eighth, Czechoslovakian 2, lands inside the
sweep's range with no long block anywhere; both breeds have been bred back to
dogs for decades.

### Collapsing calls into blocks

FLARE writes per-marker calls into the `AN1`/`AN2` `FORMAT` fields of
`wolfdog_chr1.anc.vcf.gz`.
[`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py)
collapses each haplotype's run of identical calls into one BED9 line, taking row
labels from a two-column `labels.tsv` and coloring by ancestry via `itemRgb`:

<!-- from: scripts/build_dog10k_wolfdog_ancestry.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/flare_anc_to_bed.py
python3 flare_anc_to_bed.py wolfdog_chr1.anc.vcf.gz labels.tsv ancestry.chr1.bed
```

Sort and index it as any BED track. The build script sorts inline with `sort` to
stay free of node:

```bash
jbrowse sort-bed ancestry.chr1.bed | bgzip > ancestry.chr1.bed.gz
tabix -p bed ancestry.chr1.bed.gz
```

Each output line looks like this:

```
#chrom	chromStart	chromEnd	name	score	strand	thickStart	thickEnd	itemRgb	sample	ancestry
chr1	49135137	57939751	Wolf	0	.	49135137	57939751	230,159,0	Czechoslovakian 1 hap1	Wolf
```

The last two columns are the row this block belongs to and the ancestry it was
called. The `#` header names them, so the track config carries no `columnNames`.

## Loading the blocks as a multi-row track

`LinearMultiRowFeatureDisplay` draws one row per distinct value of
`partitionField`, here `sample`, and `rowOrder` sets their order. A BED carrying
`itemRgb` is painted with it automatically.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dog10k_wolfdog_named",
  "name": "Local ancestry, named animals (FLARE, chr1)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "uri": "dog10k_wolfdog_named.chr1.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "rowOrder": [
        "Gray wolf 7 hap1",
        "Gray wolf 7 hap2",
        "Saarloos 1 hap1",
        "Saarloos 1 hap2",
        "Czechoslovakian 3 hap1",
        "Czechoslovakian 3 hap2",
        "German Shepherd hap1",
        "German Shepherd hap2"
      ]
    }
  ]
}
```

`rowOrder` is abbreviated here; the build script writes all sixty-four rows in
descending order of chr1 wolf fraction from FLARE's summary. A second BED holds
all 243 animals, loaded the same way with an empty `rowOrder`; at 486 rows there
is no room for labels, so the small painting carries the labels and the big one
the extent.

## Reading the painting

<Figure caption="Dog10K chr1 painted by FLARE against gray wolf and breed-dog panels, two rows per animal, in descending order of wolf fraction." src="/img/dog10k-wolfdog-ancestry.png" />

Each pair of rows is one animal's two chromosome copies. Wolf on one row and dog
on the other is a heterozygous stretch; both orange is homozygous wolf-derived.
Orange means a stretch that resembles a present-day gray wolf more than a breed
dog; both panels are modern, so what domestication carried into dogs sits in
both and separates nothing.

Blocks break up towards the end of chr1, tracking the genetic map: the build
script tiles the chromosome and prints block-edge count and recombination per
window, and the busiest window on one is the busiest on the other.

### Where the painting and the alleles disagree

Most held-out wolves paint essentially all wolf. The two Swedish museum
specimens come out about half dog, yet on the build script's second measurement,
the fraction of near-fixed differing sites carrying the wolf allele, they score
highest of all eight. One measurement asks about alleles one at a time, the
other about whole haplotypes matched against a panel.

### The Tamaskan and the Shiloh Shepherd

The build script prints a count of wolf blocks with their median and longest,
one line per animal. The Tamaskan's wolf assignments are many and short, its
longest inside the range the Kars, the Eurasier and the Spanish Mastiff reach.
The Shiloh Shepherd carries one wolf block far longer than any other breed dog
in the sweep; a later genome-wide run over the same collection puts it among the
three dogs with the longest, most recent wolf tracts
([Lin et al. 2025](https://doi.org/10.1073/pnas.2421768122)).

**Clustering** → **Cluster rows by similarity...** in the track menu derives the
order from the blocks themselves, and on the full 243-animal painting it puts
the held-out wolves and the wolfdogs on their own branch. Clustering runs over
the region in view, and the chip in the tree's corner names the locus.

## Repartitioning the same display

Pointing `partitionField` at a different column repartitions the same display:
the [phased trio tutorial](/docs/tutorials/analyze_trio) points it at parental
haplotype, and the [BXD QTL tutorial](/docs/tutorials/bxd_qtl) at strain.

## Reproduce it end to end

[`build_dog10k_wolfdog_ancestry.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_wolfdog_ancestry.sh)
runs every step above:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_wolfdog_ancestry.sh
bash build_dog10k_wolfdog_ancestry.sh       # chr1, into ./dog10k_wolfdog_build
bash build_dog10k_wolfdog_ancestry.sh chr38 # any other autosome
```

It derives the panel and target lists, slices the chromosome, generates the map,
runs FLARE, prints every measurement read above, and writes both painted BEDs
([`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py))
plus indexes. It also prints, per painted block edge, how many
ancestry-informative markers each haplotype carries on either side: the long
wolfdog blocks hold at their edges, and the short blocks in ordinary breeds do
not.

## See also

- [](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/dog10k_lof)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)

## References

- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
- Browning et al. (2023).
  [Fast, accurate local ancestry inference with FLARE](https://doi.org/10.1016/j.ajhg.2022.12.010)
- Lin et al. (2025).
  [A legacy of genetic entanglement with wolves shapes modern dogs](https://doi.org/10.1073/pnas.2421768122),
  local ancestry over the same collection
- Campbell et al. (2016).
  [A pedigree-based map of recombination in the domestic dog genome](https://doi.org/10.1534/g3.116.034678),
  the genetic map used here, in the
  [canFam4 transition](https://doi.org/10.5281/zenodo.17095604) published with
  Wang et al. (2025),
  [Fine-scale recombination rates inferred using the canFam4 assembly](https://doi.org/10.1007/s00335-025-10178-0)
