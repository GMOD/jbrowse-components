---
title: Local ancestry (Dog10K)
description:
  Paint wolf-derived haplotype blocks in two wolfdog breeds, against 219 other
  breeds and eight held-out wolves, from the Dog10K phased panel
guide_category: Tutorials
tutorial_category: Population genomics
data: pipeline
---

**TL;DR:** run [FLARE](https://github.com/browning-lab/flare) on the public
Dog10K phased panel with a gray wolf panel and a breed-dog panel, collapse its
per-marker `AN1`/`AN2` calls into BED9 runs with `itemRgb`, and point a
`LinearMultiRowFeatureDisplay`'s `partitionField` at the haplotype column to
paint one row per haplotype.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all these tracks need, see the
  [assemblies guide](/docs/config_guides/assemblies))
- Java 8+, for FLARE
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`bgzip`,
  `tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3 default-jre` covers
all of it, and the packaged `bcftools` is linked against libcurl, so it can
slice the panel over HTTP. `flare.jar` is a single download from FLARE's
[releases page](https://github.com/browning-lab/flare/releases). The painted BED
the build writes is a local file, so [JBrowse Desktop](/docs/quickstart_desktop)
opens it by path with no web server, and on JBrowse Web it goes in through **Add
track** or a `config.json`.

## Two wolfdog breeds and their wolf blocks

The Saarloos Wolfdog and the Czechoslovakian Wolfdog are both 20th-century
crosses between German Shepherd Dogs and captive gray wolves, bred back to dogs
afterwards. Each individual should therefore carry wolf-derived haplotype blocks
on an otherwise dog background, and a German Shepherd should carry essentially
none.

Two more breeds ride along, both taken from the Dog10K paper's own discussion of
wolf-like dogs:

- the **Shiloh Shepherd** shares more of its doubleton (F2) sites with wolves
  than any other breed dog in the collection
- the **Tamaskan** is a wolf-lookalike bred from ordinary sled and herding dogs

Painting all of them at once asks whether a genome-wide sharing statistic and a
wolfish appearance point at the same thing local ancestry does.

One dog from each of the 219 breeds the collection sequenced four or more of
goes in as well, chosen on how well the breed was sequenced, so the same run
says what a dog with no such cross looks like and sweeps every breed for one.
Eight European gray wolves go in as targets too, each removed from the wolf
panel first.

The [Dog10K consortium](https://www.dog10kgenomes.org/) publishes a phased
reference panel of 1929 canids on the `UU_Cfam_GSD_1.0` assembly, which includes
both wolfdog breeds, 57 gray wolves, and hundreds of breed dogs. Local ancestry
is a per-segment statistical estimate of which reference panel a stretch of
chromosome most resembles, which is exactly what "wolf-derived block" means when
the panels are wolves and dogs.

## The files between the panel and the painting

Every artifact between the published panel and the painted track is a plain
text, VCF or BED file you can open and check:

<Figure caption="The Dog10K sample table and phased BCF at the top, the panel lists and per-chromosome VCFs FLARE takes as input in the middle, and the BED9 files the track reads at the bottom." src="/img/wolfdog_ancestry_pipeline.png" />

### Who goes in which panel

The sample table carries a breed and a category per animal, which is enough for
the build script to derive every list: European gray wolves for the wolf panel,
matching both breeds' founder populations, and one dog from every breed the
collection has for the dog panel, minus the targets and both wolfdog breeds.

The panels decide what the colors mean, and each target's own dog background has
to be represented in the dog panel for its ordinary dog haplotypes to land
there.

An animal cannot be in a panel and painted against it:

- The eight gray wolves are **removed from the wolf panel** before the run,
  since a target matched against itself paints solid by construction.
- Each swept animal comes out of the dog panel while its **breed** stays in,
  since the targets are drawn from breeds with several sequenced animals. A Chow
  Chow or an Alaskan Malamute is painted against dogs of its own breed.

FLARE reads the two lists as one `ref-panel` file:

```
CLUPGR000001	Wolf
CLUPGR000002	Wolf
AFFN000001	Dog
AFGH000001	Dog
```

### Slicing the panel

The panel is a single 6 GB BCF, and `bcftools` reads it over HTTP by range
request, so a chromosome costs a chromosome. That subset splits into
`chr1.ref.vcf.gz` (the two panels) and `chr1.gt.vcf.gz` (the targets: 243
animals, the eight wolfdogs, the Shiloh Shepherd and Tamaskan, the German
Shepherd lineage, eight held-out gray wolves, and the 219-breed sweep).

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

FLARE requires one. The older published dog maps are all on canFam3.1 while this
panel is phased on `UU_Cfam_GSD_1.0`, and the Campbell pedigree map has since
been transitioned onto this assembly, which skips any liftover. The build script
downloads it and reshapes its `POS`/`rate`/`Map(cM)` columns into the four PLINK
columns FLARE reads.

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

Check `wolfdog_chr1.global.anc.gz` before painting anything. It is the
per-sample summary, and on chr1 it already sorts the targets:

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

The sweep across every breed gives those fractions a scale to be read against:
nearly all of the swept breeds come in at a trace of wolf on this chromosome,
and seven of the eight wolfdogs sit far above them. The eighth, Czechoslovakian
2, lands down inside the range the sweep occupies, with no long block anywhere.
Both breeds have been bred back to dogs for decades, so how much wolf an
individual carries varies from animal to animal.

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
jbrowse sort-bed ancestry.chr1.bed | bgzip > ancestry.chr1.bed.gz
tabix -p bed ancestry.chr1.bed.gz
```

Each output line looks like this:

```
#chrom	chromStart	chromEnd	name	score	strand	thickStart	thickEnd	itemRgb	sample	ancestry
chr1	49135137	57939751	Wolf	0	.	49135137	57939751	230,159,0	Czechoslovakian 1 hap1	Wolf
```

The last two columns are the ones the display needs: the row this block belongs
to, and the ancestry it was called. The `#`-header line names them for the
adapter, so the track config below carries no `columnNames`.

## Loading the blocks as a multi-row track

`LinearMultiRowFeatureDisplay` draws one row per distinct value of
`partitionField`, so pointing it at the `sample` column gives one row per
haplotype, and `rowOrder` sets their top-to-bottom order. A BED carrying
`itemRgb` is painted with it automatically.

```json
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

`rowOrder` is abbreviated here; the build script writes all sixty-four rows, in
descending order of the animal's chr1 wolf fraction, which comes out of FLARE's
own summary.

The same FLARE run writes a second BED holding all 243 animals, loaded the same
way with an empty `rowOrder`. A row label needs about six pixels of row height,
which 486 rows have at no figure size, so the small painting carries the labels
and the big one the extent.

## Reading the painting

<Figure caption="Dog10K chr1 painted by FLARE against gray wolf and breed-dog panels, two rows per animal, in descending order of wolf fraction." src="/img/dog10k-wolfdog-ancestry.png" />

Read each pair of rows as one animal's two chromosome copies. Wolf on one row
and dog on the other is a heterozygous stretch; both orange is homozygous
wolf-derived. A short block can come from variation that was never sorted
cleanly between the two panels.

Orange marks a stretch that resembles a present-day gray wolf more than a breed
dog. Both reference panels are modern, so whatever domestication carried into
dogs sits in both of them and separates nothing.

Blocks break up towards the end of chr1, tracking the genetic map: the build
script tiles the chromosome and prints both the block-edge count and the map's
recombination per window, and the busiest window on one is the busiest on the
other. Read block density against the map before reading it against the breed.

### Where the painting and the alleles disagree

Most of the held-out wolves paint essentially all wolf. The two Swedish museum
specimens come out about half dog. The build script prints a second measurement
beside FLARE's, the fraction of near-fixed differing sites at which the animal
carries the wolf allele, and those two score highest of all eight on it. The
alleles say wolf where the painting says half dog, and the two measurements ask
different questions: one about alleles one at a time, one about whole haplotypes
matched against a panel.

### The Tamaskan and the Shiloh Shepherd

The build script prints a count of wolf blocks with their median and longest,
one line per animal.

The Tamaskan's wolf assignments are many and short, its longest 1.5 Mb, inside
the range the Kars, the Eurasier and the Spanish Mastiff reach, none of them a
cross.

The Shiloh Shepherd's longest wolf block on chr1 is 17.5 Mb, against a sweep in
which every breed but one stops at 2.4 Mb. The Dog10K paper's own D-statistics
find no significant excess of wolf allele sharing in this breed over German
Shepherd Dogs, and the collection holds a single Shiloh Shepherd, painted here
on a single chromosome. A later genome-wide run over the same collection puts it
among the three dogs with the longest, most recent wolf tracts
([Lin et al. 2025](https://doi.org/10.1073/pnas.2421768122)).

The order above comes from FLARE's per-sample summary. The track menu's
**Clustering** → **Cluster rows by similarity** derives the order from the
blocks themselves, and on the full 243-animal painting it puts the held-out
wolves and the wolfdogs on their own branch with no access to the breed names.
Clustering runs over the region in view, so the chip in the tree's corner names
the locus it came from.

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
the per-sample ancestry fractions, the wolf-block length distribution, the
FLARE-independent allele count and the per-window block-edge and recombination
tiling behind the readings above, and writes both painted BEDs
([`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py))
plus their indexes.

It also writes a genotype slice of one 1.5 Mb window and prints, per painted
block edge, how many ancestry-informative markers each haplotype carries on
either side of it, which is the check on the painting itself: the long wolfdog
blocks hold at their edges, and the short blocks in ordinary breeds do not.

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
