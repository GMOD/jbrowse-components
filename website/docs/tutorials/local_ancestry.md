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

## The dataset and the question

The Saarloos Wolfdog and the Czechoslovakian Wolfdog are both 20th-century
crosses between German Shepherd Dogs and captive gray wolves, bred back to dogs
afterwards. Each individual should therefore carry wolf-derived haplotype blocks
on an otherwise dog background, and a German Shepherd should carry essentially
none. That makes the pair a local-ancestry problem with a built-in control.

Two more breeds ride along, both taken from the Dog10K paper's own discussion of
wolf-like dogs. The Shiloh Shepherd shares more of its doubleton (F2) sites with
wolves than any other breed dog in the collection, though the paper's
D-statistics find no significant excess over German Shepherds. The Tamaskan is a
wolf-lookalike bred from ordinary sled and herding dogs. Painting all of them at
once asks whether a genome-wide sharing statistic and a wolfish appearance point
at the same thing local ancestry does.

Then the rest of the dog world, because two wolfdog breeds on their own can only
show that a documented cross leaves blocks. One dog from each of the 219 breeds
the collection sequenced four or more of goes in as well, chosen on how well the
breed was sequenced and on nothing about the breed, so the same run also says
what a dog with no such cross looks like, and any breed that turns out to carry
something is found rather than nominated. Eight European gray wolves go in as
targets too, each removed from the wolf panel first, since an animal matched
against itself paints solid by construction and says nothing.

The [Dog10K consortium](https://www.dog10kgenomes.org/) publishes a phased
reference panel of 1929 canids on the `UU_Cfam_GSD_1.0` assembly, which includes
both wolfdog breeds, 57 gray wolves, and hundreds of breed dogs. Local ancestry
is a per-segment statistical estimate of which reference panel a stretch of
chromosome most resembles, which is exactly what "wolf-derived block" means when
the panels are wolves and dogs.

## The pipeline

Every artifact between the published panel and the painted track is a plain
text, VCF or BED file you can open and check:

<Figure caption="The Dog10K sample table and phased BCF at the top, the panel lists and per-chromosome VCFs FLARE takes as input in the middle, and the BED9 files the track reads at the bottom." src="/img/wolfdog_ancestry_pipeline.png" />

### Who goes in which panel

The sample table carries a breed and a category per animal, which is enough for
the build script to derive every list: European gray wolves for the wolf panel,
matching both breeds' founder populations, and one dog from every breed the
collection has for the dog panel, minus the targets and both wolfdog breeds.

The panels decide what the colors mean, so this is the step that matters most,
and breadth is the part worth getting right. The dog panel has to include the
shepherd breeds in particular: leave the targets' own dog background
unrepresented and ordinary dog haplotypes have nowhere to go but the wolf panel.

An animal cannot be in a panel and painted against it, so both directions of
that get handled explicitly:

- The eight gray wolves are **removed from the wolf panel** before the run,
  since a target matched against itself paints solid by construction and says
  nothing.
- Each swept animal comes out of the dog panel, but its **breed** does not,
  because the targets are drawn from breeds with several sequenced animals and
  the panel takes one of the others.

That second one is what makes a flat-dog painting of a Chow Chow or an Alaskan
Malamute a result rather than an artifact of a missing panel entry.

FLARE reads the two lists as one `ref-panel` file:

```
CLUPGR000001	Wolf
CLUPGR000002	Wolf
AFFN000001	Dog
AFGH000001	Dog
```

### Slicing the panel

The panel is a single 6 GB BCF, and `bcftools` reads it over HTTP by range
request, so a chromosome costs a chromosome rather than the whole file. That
subset splits into `chr1.ref.vcf.gz` (the two panels) and `chr1.gt.vcf.gz` (the
targets: 243 animals, the eight wolfdogs, the Shiloh Shepherd and Tamaskan, the
German Shepherd lineage, eight held-out gray wolves, and the 219-breed sweep).

### The genetic map

FLARE requires one, and it is worth using a real one: the map is what converts
"these markers disagree" into "a recombination happened here", so a uniform
cM/Mb stand-in asserts a constant rate the genome does not have and puts every
boundary at the wrong place by a little. The older published dog maps are all on
canFam3.1 while this panel is phased on `UU_Cfam_GSD_1.0`, but the Campbell
pedigree map has since been transitioned onto this assembly, which skips any
liftover. The build script downloads it and reshapes its `POS`/`rate`/`Map(cM)`
columns into the four PLINK columns FLARE reads.

### Running FLARE

FLARE takes the two panel VCFs, the `ref-panel` file, and the map, and writes
`wolfdog_chr1.anc.vcf.gz` plus a summary. Check `wolfdog_chr1.global.anc.gz`
before painting anything. It is the per-sample summary, and on chr1 it already
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

The sweep across every breed gives those fractions a scale to be read against:
nearly all of the swept breeds come in at a trace of wolf on this chromosome,
and seven of the eight wolfdogs sit far above them. The eighth, Czechoslovakian
2, lands down inside the range the sweep occupies, with no long block anywhere.
Both breeds have been bred back to dogs for decades, so how much wolf an
individual carries varies, and the unit here is the animal rather than the
breed.

### Collapsing calls into blocks

FLARE writes per-marker calls into the `AN1`/`AN2` `FORMAT` fields of
`wolfdog_chr1.anc.vcf.gz`.
[`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py)
collapses each haplotype's run of identical calls into one BED9 line, taking row
labels from a two-column `labels.tsv` and coloring by ancestry via `itemRgb`:

```
#chrom	chromStart	chromEnd	name	score	strand	thickStart	thickEnd	itemRgb	sample	ancestry
chr1	49135137	57939751	Wolf	0	.	49135137	57939751	230,159,0	Czechoslovakian 1 hap1	Wolf
```

The last two columns are the ones the display needs: the row this block belongs
to, and the ancestry it was called. The `#`-header line names them for the
adapter, so the track config below carries no `columnNames`.

## Loading it as a multi-row track

`LinearMultiRowFeatureDisplay` draws one row per distinct value of
`partitionField`, so pointing it at the `sample` column gives one row per
haplotype, and `rowOrder` sets their top-to-bottom order. There is no color
config: a BED carrying `itemRgb` is painted with it automatically.

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
descending order of the animal's chr1 wolf fraction, so the row order is FLARE's
own output rather than an editorial choice.

The same FLARE run writes a second BED holding all 243 animals, loaded the same
way with an empty `rowOrder`. Two paintings rather than one, because a row label
needs about six pixels of row height and 486 rows do not have them at any figure
size: the small one is who, the big one is where.

## Reading the painting

<Figure caption="Dog10K chr1 painted by FLARE against gray wolf and breed-dog panels, two rows per animal, in descending order of wolf fraction." src="/img/dog10k-wolfdog-ancestry.png" />

Read each pair of rows as one animal's two chromosome copies. Wolf on one row
and dog on the other is a heterozygous stretch; both orange is homozygous
wolf-derived. A short block is weaker evidence than its color suggests and need
not be a cross at all, since some variation was never sorted cleanly between the
two panels in the first place.

Orange marks what resembles a present-day gray wolf rather than a breed dog.
Both reference panels are modern, so whatever domestication carried into dogs
sits in both of them and separates nothing, which is why the German Shepherd at
the foot paints solid dog.

One feature of the painting is not about the dogs at all. Blocks break up
towards the end of chr1, and that is the genetic map rather than the animals.
The build script tiles the chromosome and prints both the block-edge count and
the map's recombination per window, and the busiest window on one is the busiest
on the other. Where the map puts more recombination a block has more places to
end, so block density in a window is worth reading against the map before it is
read against the breed.

### Where the painting and the alleles disagree

Most of the held-out wolves paint essentially all wolf. Two do not: the two
Swedish museum specimens come out about half dog, which is a result about the
method rather than about the animals. The build script prints a second, cruder
measurement beside FLARE's: the fraction of chr1 sites where the two panels are
nearly fixed for different alleles at which the animal carries the wolf one. The
two Swedish wolves score highest of all eight on that one, far above the German
Shepherd. So the alleles say plainly that they are wolves while the painting
says half dog, and this tutorial does not resolve which part of the inference
gives way: the two measurements ask different questions, one about alleles one
at a time and one about whole haplotypes matched against a panel of
twenty-eight. What it does settle is which way to read the disagreement. Where a
painting and the raw alleles disagree, the painting is the model's answer, and
the reason to run the cruder measurement at all is that it has no model to be
the answer of.

### What the two wolf-like breeds do

The build script prints a count of wolf blocks with their median and longest,
one line per animal, which is the same reading the figure asks for in numbers.

The Tamaskan behaves like a dog that merely looks like a wolf. Its wolf
assignments are many and short, and its longest is 1.5 Mb, inside the range an
ordinary breed reaches anyway, since the Kars, the Eurasier and the Spanish
Mastiff all land between 1.7 and 2.0 Mb with no wolf story attached to any of
them. That is what having 219 breeds in the run buys: "short flecks" is a
comparison, and the sweep is what it gets compared against. Appearance carries
no ancestry.

The Shiloh Shepherd does not. Its longest wolf block on chr1 is 17.5 Mb, against
a sweep in which every breed but one stops at 2.4 Mb. The Dog10K paper's own
D-statistics find no significant excess of wolf allele sharing in this breed
over German Shepherd Dogs, and the collection holds a single Shiloh Shepherd,
painted here on a single chromosome. A later genome-wide run over the same
collection puts it among the three dogs with the longest, most recent wolf
tracts ([Lin et al. 2025](https://doi.org/10.1073/pnas.2421768122)).

Those readings are all row-order arguments, and the order above came out of
FLARE's per-sample summary, so it can only rank what the summary already ranked.
The track menu's **Clustering** → **Cluster rows by similarity** derives the
order from the blocks instead, and on the full 243-animal painting it puts the
held-out wolves and the wolfdogs on their own branch with no access to the breed
names. The chip in the tree's corner names the locus the tree came from, which
is load-bearing rather than decorative: the clustering runs over the region in
view, so panning to a 5 Mb window and re-clustering gives a different order for
the same rows.

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
either side of it. That is the check on the painting itself, and it is worth
reading before building anything on a block: the long wolfdog blocks hold at
their edges, and the short blocks in ordinary breeds do not.

## See also

- [](/docs/tutorials/dog10k_svs)
- [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof)
- [Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection)
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
