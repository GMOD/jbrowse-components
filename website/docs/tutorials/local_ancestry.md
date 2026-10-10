---
title: Local ancestry (Dog10K)
sidebar_label: Dog10K (local ancestry)
description:
  Paint wolf-derived haplotype blocks in two wolfdog breeds, against 219 other
  breeds and eight held-out wolves, from the Dog10K phased panel
guide_category: Tutorials
tutorial_category: Population genomics
tutorial_subcategory: Dog10K
---

Two of the Dog10K breeds are wolf hybrids, so some stretches of their genome
trace back to a gray wolf ancestor and the rest to domestic dogs.
[FLARE](https://github.com/browning-lab/flare) calls which of the two sources
each stretch of DNA came from, against a wolf panel and 219 other breeds, and we
paint the result as one colored row per haplotype (one copy of a chromosome).

## Prerequisites

- the `UU_Cfam_GSD_1.0` dog assembly (UCSC's canFam4) set up in JBrowse. The
  [canFam4 hub on genomes.jbrowse.org](https://genomes.jbrowse.org/ucsc/canFam4/)
  is a config that loads it with its gene and repeat tracks, and the
  [assemblies guide](/docs/config_guides/assemblies) builds one by hand. These
  tracks read only its `chrom.sizes`.
- Java 8+, for FLARE
- `bcftools` built with libcurl
- `curl`
- `python3`
- htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install bcftools tabix curl python3 default-jre` covers
all of it, including a `bcftools` linked against libcurl. `flare.jar` is a
single download from FLARE's
[releases page](https://github.com/browning-lab/flare/releases). The painted BED
is a local file, so [JBrowse Desktop](/docs/quickstart_desktop) opens it by
path, while JBrowse Web needs it served.

## Where the data comes from

The Dog10K consortium's public phased reference panel
([Meadows et al. 2023](https://doi.org/10.1186/s13059-023-03023-7)), plus a
canFam4 genetic map published separately.

The [build script](#reproduce-it-end-to-end) fetches these files, so there is
nothing to download by hand.

- the phased reference panel of 1929 canids FLARE runs against:
  https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
- the sample table, breed and category labels the panels and targets are derived
  from:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
- the Campbell pedigree map, transitioned onto the assembly of this panel
  ([Wang et al. 2025](https://doi.org/10.5281/zenodo.17095604)):
  https://zenodo.org/records/17095604/files/campbell_sex_average_canFam4.tar.gz?download=1

## Loading the UU_Cfam_GSD_1.0 dog assembly

`UU_Cfam_GSD_1.0` is the Dog10K reference that UCSC calls canFam4. We load it
from UCSC's 2bit, with the alias file that maps the `chr` names to GenBank
accessions:

```json addassembly
{
  "name": "UU_Cfam_GSD_1.0",
  "aliases": ["canFam4"],
  "sequence": {
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/canFam4/bigZips/canFam4.2bit"
    }
  },
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/canFam4/bigZips/canFam4.chromAlias.txt"
  }
}
```

## Two wolfdog breeds and their wolf blocks

Local ancestry labels each stretch of a chromosome with the reference panel (a
labelled set of animals) it most resembles. The
[Dog10K consortium](https://www.dog10kgenomes.org/)'s panel of 1929 canids
includes both wolfdog breeds, 57 gray wolves and hundreds of breed dogs. As
targets, FLARE paints one dog from each of the 219 breeds with four or more
sequenced animals, to catch a wolf cross in any breed, plus:

- **The two wolfdog breeds**: the Saarloos Wolfdog and the Czechoslovakian
  Wolfdog are 20th-century crosses between German Shepherd Dogs and captive gray
  wolves, bred back to dogs afterwards. Each should have wolf-derived haplotype
  blocks on a dog background, and a German Shepherd essentially none.
- **The Shiloh Shepherd**, from the Dog10K paper's discussion of wolf-like dogs,
  shares more of its doubleton (F2) sites, those carried by only two
  chromosomes, with wolves than any other breed dog in the collection.
- **The Tamaskan**, from the same discussion, is a wolf-lookalike bred from
  ordinary sled and herding dogs.
- **Eight European wolves**, held out of the wolf panel.

## The files FLARE reads and writes

Every file between the phased panel and the painted track is text, VCF or BED:

<Figure caption="The Dog10K sample table and phased BCF at the top, the panel lists and per-chromosome VCFs FLARE takes as input in the middle, and the BED9 files the track reads at the bottom." src="/img/wolfdog_ancestry_pipeline.png" />

### Choosing the wolf and dog reference panels

FLARE compares each target animal against a wolf panel and a dog panel. The
build script derives both lists from the sample table's breed and category per
animal: European gray wolves for the wolf panel, and one dog from every breed
for the dog panel, minus the targets and both wolfdog breeds. The dog panel has
to include the breed of each target, or the ordinary haplotypes of that target
have no close match there.

No animal is painted against a panel that contains it:

- the script removes the eight gray wolves from the wolf panel, since a target
  matched against itself paints solid
- each target dog comes out of the dog panel while another dog of its breed
  stays in, so a Chow Chow is painted against a different Chow Chow

FLARE reads the two lists as one `ref-panel` file:

```text
CLUPGR000001	Wolf
CLUPGR000002	Wolf
AFFN000001	Dog
AFGH000001	Dog
```

### Slicing one chromosome out of the phased BCF

The panel is a single 6 GB BCF, which `bcftools` reads over HTTP by range
request. The chromosome subset splits into `chr1.ref.vcf.gz` (the two panels)
and `chr1.gt.vcf.gz` (the 243 targets).

<!-- from: scripts/build_dog10k_wolfdog_ancestry.sh -->

```bash
PANEL=https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
# -r fetches one chromosome of the 6 GB file by range request
# the two later views re-slice that local subset
bcftools view -r chr1 -S all.txt --force-samples -Oz -o chr1.subset.vcf.gz "$PANEL"
bcftools view -S <(cat wolves.txt dogs.txt) --force-samples \
  -Oz -o chr1.ref.vcf.gz chr1.subset.vcf.gz
bcftools view -S targets.txt --force-samples -Oz -o chr1.gt.vcf.gz chr1.subset.vcf.gz
```

`all.txt`, `wolves.txt`, `dogs.txt` and `targets.txt` list one sample per line.

### Reshaping the Campbell genetic map for FLARE

FLARE requires a genetic map in four PLINK columns: chromosome, marker ID,
genetic position in cM and base-pair position. The build script reshapes the
Campbell pedigree map's `POS`/`rate`/`Map(cM)` columns into them, and the
chromosome names must match the VCF's. With no map for your organism, write one
at a constant rate per megabase from the assembly's `chrom.sizes`; segment edges
are then approximate.

### Running FLARE

FLARE takes the two panel VCFs, the `ref-panel` file and the map, and writes
`wolfdog_chr1.anc.vcf.gz` plus a summary:

<!-- from: scripts/build_dog10k_wolfdog_ancestry.sh -->

```bash
# FLARE draws random samples while it infers, so two runs of the same input
# give slightly different block boundaries unless the seed is pinned.
#   seed=42    any fixed number, so a re-run reproduces this painting exactly
#   -Xmx12g    the Java memory ceiling; raise it for more targets or a longer
#              chromosome, since FLARE exits with an OutOfMemoryError past it
#   out=       a prefix; FLARE appends .anc.vcf.gz and .global.anc.gz
java -Xmx12g -jar flare.jar ref=chr1.ref.vcf.gz ref-panel=refpanel.txt \
  gt=chr1.gt.vcf.gz map=chr1.map out=wolfdog_chr1 seed=42
```

`wolfdog_chr1.global.anc.gz` is the per-sample summary, and chr1 alone already
ranks the targets:

```text
SAMPLE          Wolf    Dog
CLUPRU000001    0.996   0.004     held-out gray wolf
SAAR000001      0.446   0.554     Saarloos Wolfdog
CZEC000003      0.281   0.719     Czechoslovakian Wolfdog
SHIL000001      0.225   0.775     Shiloh Shepherd
THAI000009      0.08    0.92      top of the 219-breed sweep
TMSK000001      0.033   0.967     Tamaskan
GRSD000002      0       1         German Shepherd Dog
```

Nearly all swept breeds show a trace of wolf, and seven of the eight wolfdogs
(four Saarloos, four Czechoslovakian) sit far above them. The eighth,
Czechoslovakian 2 (`CZEC000002`), lands inside the range of the sweep with no
long block anywhere.

### Collapsing FLARE's calls into BED blocks

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

The BED sorts and indexes like any other BED track. The build script sorts
inline to run without node:

```bash
jbrowse sort-bed ancestry.chr1.bed | bgzip > ancestry.chr1.bed.gz
tabix -p bed ancestry.chr1.bed.gz
```

Each output line looks like this:

```text
#chrom	chromStart	chromEnd	name	score	strand	thickStart	thickEnd	itemRgb	sample	ancestry
chr1	49135137	57939751	Wolf	0	.	49135137	57939751	230,159,0	Czechoslovakian 1 hap1	Wolf
```

The last two columns hold the block's row and its called ancestry, and the `#`
header names them, so the track config needs no `columnNames`. The build script
runs the converter twice:

- `labels.tsv` over every target, into `dog10k_wolfdog_ancestry.chr1.bed.gz`
- `named.tsv` over the animals the figure names, into
  `dog10k_wolfdog_named.chr1.bed.gz`, the file the track below loads

## Loading the blocks as a multi-row track

The multi-row feature display (`LinearMultiRowFeatureDisplay`) draws one row per
`sample`. In grammar-of-graphics terms, `rows` assigns the rows and
`rows.domain` orders them, and `color` is a color scale whose
`scale: "identity"` names the BED's `itemRgb` colors in the key.

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
      "rows": {
        "field": "sample",
        "domain": [
          "Gray wolf 7 hap1",
          "Gray wolf 7 hap2",
          "Saarloos 1 hap1",
          "Saarloos 1 hap2",
          "Czechoslovakian 3 hap1",
          "Czechoslovakian 3 hap2",
          "German Shepherd hap1",
          "German Shepherd hap2"
        ]
      },
      "color": {
        "scale": "identity",
        "domain": ["rgb(0,114,178)", "rgb(230,159,0)"],
        "labels": ["Breed dog", "Gray wolf"],
        "title": "Ancestry (FLARE)"
      }
    }
  ]
}
```

**Advanced → Edit plot...** in the track menu shows `rows` and `color` as text
and applies edits live.

`rows.domain` is abbreviated here; the build script writes all sixty-four rows
in descending order of chr1 wolf fraction from FLARE's summary. For your own
animals:

- omit `domain` and cluster the rows, or list the animals in the order you want
- load a second BED of all 243 animals the same way, with no `domain`: at two
  rows per animal there is no room for labels, so the named-animals track shows
  the labels and the all-animals track the extent

## Wolf blocks along chr1 in wolfdogs and controls

<Figure caption="Local ancestry along chr1 called by FLARE against gray wolf and breed-dog panels: wolf-derived in orange, dog in blue, two rows per animal in descending order of wolf fraction." src="/img/dog10k-wolfdog-ancestry.png" />

Each pair of rows is the two chromosome copies of one animal. Orange marks a
stretch resembling a present-day gray wolf more than a breed dog. Wolf on one
row and dog on the other is heterozygous, and both orange is homozygous
wolf-derived.

Blocks break up towards the end of chr1, tracking the genetic map: the build
script tiles the chromosome and prints block-edge count and recombination per
tile, and the tile with the most block edges has recombination far above the
median.

### Held-out wolves where FLARE and allele counts disagree

Most held-out wolves come out essentially all wolf. The two Swedish museum
specimens come out partly dog in FLARE's calls, yet score highest of the
held-out wolves on a second measure the build script prints, the fraction of
near-fixed differing sites with the wolf allele. That measure scores one site at
a time, where FLARE matches whole haplotypes against a panel.

### How long the Tamaskan's and Shiloh Shepherd's wolf blocks run

The build script prints a count of wolf blocks with their median and longest,
one line per animal:

- The Tamaskan's wolf blocks are many and short, no longer than ordinary breeds'
  (the Kars, the Eurasier, the Spanish Mastiff).
- The Shiloh Shepherd has the longest wolf block of any dog outside the two
  wolfdog breeds, and many more blocks than the runner-up, a Great Anglo-French
  Tricolor Hound with three. A later genome-wide run over the same collection
  puts it among the three dogs with the longest, most recent wolf tracts
  ([Lin et al. 2025](https://doi.org/10.1073/pnas.2421768122)).

**Clustering** → **Cluster rows by similarity...** in the track menu orders the
rows of the full 243-animal track by their blocks. It puts the held-out wolves
on a small branch with the wolfdog haplotypes with the most wolf, apart from the
breed dogs. Clustering runs over the region in view, and a chip in the corner of
the tree shows the locus.

## Reproduce it end to end

[`build_dog10k_wolfdog_ancestry.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_wolfdog_ancestry.sh)
runs every step above. It:

1. derives the panel and target lists and slices the chromosome
2. generates the map and runs FLARE
3. writes both painted BEDs
   ([`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py))
   plus indexes
4. prints every measurement read above and, for each painted block edge, how
   many ancestry-informative markers each haplotype has on either side. The long
   wolfdog blocks have marker support at their edges, and the short blocks in
   ordinary breeds lack it.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_wolfdog_ancestry.sh
bash build_dog10k_wolfdog_ancestry.sh       # chr1, into ./dog10k_wolfdog_build
bash build_dog10k_wolfdog_ancestry.sh chr38 # any other autosome
```

## See also

- [](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/dog10k_lof)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)

## Citations

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
