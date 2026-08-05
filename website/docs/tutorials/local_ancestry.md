---
title: Local ancestry (Dog10K)
sidebar_label: Local ancestry (Dog10K)
description:
  Paint wolf-derived haplotype blocks in two wolfdog breeds, against 219 other
  breeds and eight held-out wolves, from the Dog10K phased panel
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

On Debian/Ubuntu, `apt install bcftools tabix curl python3 default-jre` covers
all of it, and the packaged `bcftools` is linked against libcurl, so it can
slice the panel over HTTP. `flare.jar` is a single download from FLARE's
[releases page](https://github.com/browning-lab/flare/releases). The painted BED
the build writes is a local file, so [JBrowse Desktop](/docs/quickstart_desktop)
opens it by path with no web server.

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

Then the rest of the dog world, because two wolfdog breeds on their own can only
show that a documented cross leaves blocks. One dog from each of the 219 breeds
the collection sequenced four or more of goes in as well — chosen on how well
the breed was sequenced and on nothing about the breed — so the same run also
says what a dog with no such cross looks like, and any breed that turns out to
carry something is found rather than nominated. Eight European gray wolves are
held out of the wolf panel and painted as targets, which is the only thing in
the figure that says what a correct all-wolf call looks like.

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
                        chr1.map                            (Campbell, canFam4)
                              │
                              v  FLARE
                        wolfdog_chr1.anc.vcf.gz   per-marker AN1/AN2 calls
                        wolfdog_chr1.global.anc.gz  per-sample summary
                              │
                              v  flare_anc_to_bed.py + labels.tsv / named.tsv
                        dog10k_wolfdog_ancestry.chr1.bed.gz  all 243 animals
                        dog10k_wolfdog_named.chr1.bed.gz     the named subset
                              │
                              v  BedTabixAdapter + LinearMultiRowFeatureDisplay
                        one painted row per haplotype
```

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
that get handled explicitly. The eight gray wolves are **removed from the wolf
panel** before the run — a target matched against itself paints solid by
construction and says nothing. The sweep is the same problem in reverse: each
swept animal comes out of the dog panel, but its **breed** does not, because the
targets are drawn from breeds with several sequenced animals and the panel takes
one of the others. That is what makes a flat-dog painting of a Chow Chow or an
Alaskan Malamute a result rather than an artifact of a missing panel entry.

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
targets: 243 animals — the eight wolfdogs, the Shiloh Shepherd and Tamaskan, the
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

Of the 219 swept breeds, 193 come in under 1% wolf on this chromosome, which
gives the wolfdogs' fractions a scale to be read against: seven of the eight
land between 15% and 45%. The eighth, Czechoslovakian 2, is at 1.5% with no
block over 0.8 Mb, which puts it inside the range the sweep occupies. That is
not a failure of the inference — both breeds have been bred back to dogs for
decades, so how much wolf an individual carries varies, and the unit here is the
animal rather than the breed.

### Collapsing calls into blocks

FLARE writes per-marker calls into the `AN1`/`AN2` `FORMAT` fields of
`wolfdog_chr1.anc.vcf.gz`.
[`flare_anc_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/flare_anc_to_bed.py)
collapses each haplotype's run of identical calls into one BED9 line, taking row
labels from a two-column `labels.tsv` and coloring by ancestry via `itemRgb`:

```
#chrom	chromStart	chromEnd	name	score	strand	thickStart	thickEnd	itemRgb	sample	ancestry
chr1	49135137	57939479	Wolf	0	.	49135137	57939479	230,159,0	Czechoslovakian 1 hap1	Wolf
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

<Figure caption="Dog10K chr1 painted by FLARE against gray wolf and breed-dog panels, two rows per animal, in descending order of wolf fraction. Six of the eight held-out gray wolves paint near-solid wolf (orange); the wolfdogs below carry megabase blocks; the sweep breeds carry flecks, bar the Great Anglo-French Tricolour Hound's 11.4 Mb block; the German Shepherd lineage at the foot is solid dog." src="/img/dog10k-wolfdog-ancestry.png" />

Read each pair of rows as one animal's two chromosome copies. Wolf on one row
and dog on the other is a heterozygous stretch; both orange is homozygous
wolf-derived. The breeds separate on block length as well as on total wolf
fraction, and length is the more informative of the two: a recent cross leaves
long founder haplotypes because recombination has had few generations to break
them up.

One feature of the painting is not about the dogs at all. Blocks break up
towards the end of chr1, and that is the genetic map rather than the animals.
The build script tiles the chromosome and prints both the block-edge count and
the map's recombination per window, and the busiest window on one is the busiest
on the other. Where the map puts more recombination a block has more places to
end, so block density in a window is worth reading against the map before it is
read against the breed.

Both ends of the figure are checks. The German Shepherd lineage at the foot
takes almost no wolf on this chromosome under the same panel and the same run,
so the orange elsewhere is signal rather than an artifact of the panels. The
gray wolves at the head are the other end of the same check, and they are
painted rather than asserted: each was removed from the wolf panel before the
run, so it is painted by the twenty-eight that remain.

Six of those eight paint 98% wolf or better. **Two do not** — the two Swedish
museum specimens come out about half dog, and that is a result about the method
rather than about the animals. The build script prints a second, cruder
measurement beside FLARE's: the fraction of chr1 sites where the two panels are
nearly fixed for different alleles at which the animal carries the wolf one. The
two Swedish wolves score 0.92 and 0.92 there, the highest of all eight, against
0.06 for the German Shepherd. So the alleles say plainly that they are wolves
while the painting says half dog, and this tutorial does not resolve which part
of the inference gives way — the two measurements ask different questions, one
about alleles one at a time and one about whole haplotypes matched against a
panel of twenty-eight. What it does settle is which way to read the
disagreement: where a painting and the raw alleles disagree, the painting is the
model's answer, and the reason to run the cruder measurement at all is that it
has no model to be the answer of.

### What the two wolf-like breeds do

Read the rows on block length as well as on colored fraction. The build script
prints both, one line per animal, as a count of wolf blocks with their median
and longest.

The Tamaskan behaves like a dog that merely looks like a wolf. Its wolf
assignments are many and short, and its longest is 1.5 Mb — inside the range an
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

The one breed the sweep turns up that has no wolf in its account of itself is
the Great Anglo-French Tricolour Hound, which carries a wolfdog-scale block on
one haplotype and almost nothing on the rest of the chromosome. One long block
in one animal is what a recent introgression looks like and also what a phasing
error looks like, and one animal on one chromosome cannot separate those. The
same paper reports this breed as the one with the most within-breed spread in
wolf ancestry it found, which is a claim a one-dog-per-breed sweep cannot check,
so the section below paints the breed again, beside the breeds it was
made from.

Those readings are all row-order arguments, and the order above came out of
FLARE's per-sample summary, so it can only rank what the summary already ranked.
Switch to the 243-animal painting and let the display derive the order from the
blocks themselves: the track menu's **Clustering** → **Cluster rows by
similarity** reorders rows by how alike their painting is across the region in
view, and draws the tree it built beside them.

<Figure caption="486 haplotype rows — 219 breeds at one dog each, the eight wolfdogs, the two wolf-lookalike breeds, the German Shepherd lineage and eight held-out gray wolves — clustered on their chr1 painting, beside the tree that ordered them. The wolf-carrying rows come off a deep branch at the top; the rest merge at almost no height into the dog field 193 of the 219 breeds sit in. No row labels at 2px a row." src="/img/dog10k-wolfdog-ancestry-clustered.png" />

Nothing in that order was declared. The clustering has no access to the breed
names, and it still puts the held-out wolves at one end, the wolfdogs under
them, and the German Shepherd lineage in the field with every other breed.

The chip in the tree's corner names the locus the tree was computed from, and it
is load-bearing rather than decorative: the clustering runs over the region in
view, so panning to a 5 Mb window and re-clustering gives a different order for
the same rows. A dendrogram beside a painting is an answer to a question that
includes where you were looking.

## One breed, and the breeds it came from

A sweep that draws one dog per breed reports a breed as whatever that dog is,
which is the wrong instrument for a breed whose individuals disagree. Running
local ancestry across the whole Dog10K collection,
[Lin et al. (2025)](https://doi.org/10.1073/pnas.2421768122) report the Great
Anglo-French Tricolour Hound as the breed with the widest spread in wolf
ancestry of any they analysed, two of its dogs carrying tracts recent enough to
date the admixture within recorded breed history. The related Great Anglo-French
White and Orange Hound is lower but also variable. Where that ancestry came from
is not known.

One alternative has to be closed off before a painting of that breed means
anything, and it is the panels that open it. A block is called wolf by comparing
against a dog panel that holds one dog per breed, so a haplotype carried by a
single breed is rare in that panel too. "These hounds carry wolf haplotypes" and
"these hounds carry a hound haplotype the panel barely samples" predict the same
picture, and nothing above tells them apart.

What separates them is the rest of the clade. The Great Anglo-French hounds were
made by crossing French pack hounds with English foxhounds, and the collection
holds both stocks along with the smaller Anglo-Francais form of the same cross.
A breed haplotype would be in them. So the build script paints them: every dog
of the clade the reference panel does not already hold, run as a second FLARE
job against the same two panels, the same map and the same held-out wolf as
everything above.

<Figure caption="The Anglo-French hound clade on chr1: both Great Anglo-French forms above the French pack hounds and English foxhounds they were made from, between a held-out gray wolf and a German Shepherd. Top: named. Middle: the same view unlabelled, since the labels cover the chromosome start. Bottom: chr38. Wolf blocks sit in the Great Anglo-French rows and nowhere else in the clade." src="/img/dog10k-anglofrench-hounds.png" links="chr1=dog10k-anglofrench-hounds-chromosome,chr1 unlabelled=dog10k-anglofrench-hounds-unlabelled,chr38=dog10k-anglofrench-hounds-chr38" />

The blocks stop at the breed. The stocks the Great Anglo-French hounds were
crossed from run dog end to end, like the German Shepherd at the foot, and so
does the smaller form of the same cross; what the Great Anglo-French rows carry
is not something their clade carries. Within those rows the painting is uneven,
which is the spread the paper reports arriving as a picture rather than as a
statistic.

The row labels are an overlay on the plot rather than a gutter beside it, so on
a whole-chromosome view they cover the left of the rows they name. Two of these
dogs carry a block inside the covered span, which is why the middle panel draws
the same view with
[`showRowLabels`](/docs/config/LinearMultiRowFeatureDisplay/#slot-showrowlabels)
off.

Then read the bottom panel against the top one. The two Tricolour Hounds that
carry most of the wolf on chr1 are the two that carry almost none on chr38, and
the pair that carries it there is a different pair, while the clade around them
stays empty on both. A few percent of a genome, scattered in blocks, lands on
some chromosomes and not others, so which individual looks wolfish is a property
of the chromosome you happened to open. The paper's ranking is genome-wide; a
single chromosome cannot reproduce it, and this pair of panels is what that
costs.

Which is the same reading the eighth wolfdog forced above, one level up: what
carries ancestry is an animal rather than a breed, and what carries a number is
a genome rather than a chromosome.

## Checking a block against the genotypes

A painted block is an inference, and the genotypes it was inferred from are
right there in the panel. The check has to be run at a block's **edge** rather
than in its middle. Inside a block, finding wolf alleles on a wolf-called
haplotype is close to circular: those alleles are what the call was made on, so
the check cannot come out wrong. At an edge the painting commits to something
that can be: it says the wolf alleles stop at a particular coordinate, and they
either do, or run past it, or stop well short of it.

Any 1.5 Mb of chr1 holding a few edges will do, and the one below is an ordinary
one. Underneath the gene track and the painting, its phased genotypes go in as a
matrix, filtered to the markers that carry ancestry information at all — the
ones whose alt allele is common in the wolf panel and rare in the dog panel:

```
"jexlFilters": [
  "jexl:get(feature,'INFO').AF_wolf[0] >= 0.8 && get(feature,'INFO').AF_dog[0] <= 0.15"
]
```

Both frequencies were written per site by the build script over the full panels,
before the sample subset, so they are panel-wide estimates rather than a
description of the 32 animals in the file. Without the filter the lane draws
every common site in 1.5 Mb, nearly all of them shared between wolves and dogs,
and the figure is a wall of salt-and-pepper.

<Figure caption="1.5 Mb of chr1: its genes, FLARE's painting for 32 named animals, and their phased genotypes at the 49 markers separating the panels, one column per marker, orange for the wolf allele. A wolfdog's row carries the markers up to its painted edge and none after; a sweep breed's short block is only half-carried." src="/img/dog10k-wolfdog-block-genotypes.png" />

The matrix draws one column per marker rather than placing each at its
coordinate, so a run of carriers reads as a band instead of as speckle; the
lines above the rows tie each column back to where it actually is, which is how
a column is matched to the block edge in the painting above it.

The build script does the same comparison as a count, one line per edge, so the
figure is not the only place the claim lives:

```
Wolf alleles carried either side of a painted block edge:
  Thai Ridgeback hap1        edge 112,044,711   wolf side     n/a   dog side    4/49
  Saarloos 2 hap2            edge 112,136,175   wolf side     3/5   dog side    6/44
  Chow Chow hap2             edge 112,453,902   wolf side   13/23   dog side    0/26
  Tamaskan hap2              edge 112,563,501   wolf side   16/23   dog side    0/26
  Czechoslovakian 4 hap1     edge 112,576,175   wolf side   23/23   dog side    0/26
  Saarloos 3 hap1            edge 112,576,175   wolf side   23/23   dog side    0/26
  Kai Ken hap1               edge 112,846,876   wolf side   13/23   dog side    0/26
  Caucasian Ovcharka hap2    edge 113,109,578   wolf side   19/36   dog side    1/13
  Saarloos 1 hap1            edge 113,251,574   wolf side   41/43   dog side     0/6
```

**The long blocks hold at their edges and the short ones do not.** Both wolfdog
haplotypes ending at 112,576,175 carry every one of the 23 markers before it and
none of the 26 after; Saarloos 1 hap1 carries 41 of 43 and then none. The sweep
breeds' edges sit in the same window under the same markers and are nothing like
as sharp: the Chow Chow and the Kai Ken carry 13 of 23 on the side the painting
calls wolf, and the Thai Ridgeback's block ends before the first marker, so
nothing in the window supports it at all.

That is the block-length argument from the previous section arriving as a
second, independent measurement. A boundary left by a recent cross is a real
boundary in the genotypes; a short assignment in an ordinary breed is a stretch
where the model had little to go on, and it is worth knowing which of the two a
given block is before building anything on it. Saarloos 2 hap2's edge, at 3 of 5
then 6 of 44, is the honest middle: a real drop, but not one you would put a
coordinate on.

This is the check worth running on any local-ancestry call before building
anything on top of it: the painting is a summary, and the summary should be
visible in the raw genotypes. It is also how you would follow up the Shiloh
Shepherd's blocks, or the Great Anglo-French Tricolour Hound's.

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
plus their indexes and the genotype slice the last figure uses.

## See also

- [](/docs/tutorials/dog10k_svs),
  [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof) and
  [Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection), the other
  Dog10K tutorials, on the same assembly
- [](/docs/tutorials/analyze_trio), the same display painted from hap-ibd
  inheritance blocks
- [](/docs/tutorials/bxd_qtl), the same display partitioned by strain
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)

## References

- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
- Browning et al. (2023).
  [Fast, accurate local ancestry inference with FLARE](https://doi.org/10.1016/j.ajhg.2023.02.010)
- Lin et al. (2025).
  [A legacy of genetic entanglement with wolves shapes modern dogs](https://doi.org/10.1073/pnas.2421768122),
  local ancestry over the same collection, and the source of the Great
  Anglo-French result the last section paints
- Campbell et al. (2016).
  [A pedigree-based map of recombination in the domestic dog genome](https://doi.org/10.1534/g3.116.034678),
  the genetic map used here, in the
  [canFam4 transition](https://doi.org/10.5281/zenodo.17095604) published with
  Wang et al. (2025),
  [Fine-scale recombination rates inferred using the canFam4 assembly](https://doi.org/10.1007/s00335-025-10178-0)
