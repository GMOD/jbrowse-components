---
title: Structural variants (Dog10K)
sidebar_label: SVs (Dog10K)
description:
  Genotype four classes of structural variant across dog breeds and read each
  against the gene it sits in
guide_category: Tutorials
tutorial_category: Structural variation
data: pipeline
---

**TL;DR:** slice a locus out of the Dog10K structural-variant callsets over
HTTP, load it as a `VariantTrack` in the multi-sample variant display with breed
labels, and read the genotypes against the gene model above it. Four loci, one
recipe, a different class of variant each time.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4,
  see the [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)
- `minimap2` and `samtools`, for the
  [FGF4 synteny half](#the-retrocopy-itself-as-sequence)
- the UCSC `liftOver` binary for the OMIA lane, which the build script fetches
  itself

On Debian/Ubuntu, `apt install bcftools samtools minimap2 tabix curl python3`
covers the rest. The scripts write local files, which
[JBrowse Desktop](/docs/quickstart_desktop) opens by path and JBrowse Web takes
through **Add track**.

## Where the data comes from

Two Dog10K structural-variant callsets from Schall & Kidd
([2025](https://doi.org/10.1093/gbe/evaf173)), read directly over HTTP, plus
supporting UCSC and OMIA tracks and two sequenced retrocopies from GenBank.

- the Zenodo Paragraph callset, 5.9 GB, carrying the _NHEJ1_ deletion and the
  _RNASE1_ insertion:
  https://zenodo.org/api/records/14968874/files/Dog10k_manta_paragraph.vcf.gz/content
- the Michigan Manta aggregate callset, 1.08 GB, carrying the _AMY2B_
  duplication and the _FGF4_ intron records:
  https://kiddlabshare.med.umich.edu/dog10K/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
- the sample table, breed and category per animal, behind every panel on this
  page:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
- OMIA's own dump, curating the Collie eye anomaly record independently of
  either callset: https://omia.org/static/omia.sql.gz
- the canFam3-to-canFam4 chain that lifts OMIA's coordinates:
  https://hgdownload.soe.ucsc.edu/goldenPath/canFam3/liftOver/canFam3ToCanFam4.over.chain.gz
- the `UU_Cfam_GSD_1.0` gene annotation, checking the _FGF4_ records against the
  gene's introns and drawing the parent-gene track in the synteny figure:
  https://jbrowse.org/ucsc/canFam4/ncbiRefSeq.gff.gz
- the CFA18 retrocopy, MF040222, fetched from GenBank:
  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=MF040222&rettype=fasta&retmode=text
- the CFA12 retrocopy, MF040221, fetched from GenBank:
  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=MF040221&rettype=fasta&retmode=text
- the _FGF4_ parent-locus sequence the two retrocopies are aligned against, over
  UCSC's canFam4 REST API:
  https://api.genome.ucsc.edu/getData/sequence?genome=canFam4;chrom=chr18;start=48865000;end=48876000

## A 7.8 kb deletion in NHEJ1

Schall and Kidd genotyped long-read-discovered structural variants across the
Dog10K collection and flagged those whose allele frequencies track breed clades.
One is a 7.8 kb deletion in an intron of _NHEJ1_, the variant
[Parker et al. (2007)](https://doi.org/10.1101/gr.6772807) tied to Collie eye
anomaly. If it is what the literature says, it should be common in Collies and
their relatives and absent from unrelated breeds and from wolves. The anomaly is
recessive, so the darker cells below are affected animals and the lighter ones
unaffected carriers.

## Slicing one locus out of the callset

The genotype VCF is 5.9 GB across 1,879 dogs and wolves, published on
[Zenodo](https://doi.org/10.5281/zenodo.14968873) with a tabix index, and
`bcftools` fetches only the locus. Zenodo serves the data and index from
separate content URLs, so the index is named explicitly:

<!-- from: scripts/build_dog10k_nhej1_sv.sh -->

```bash
Z=https://zenodo.org/api/records/14968874/files
SV=$Z/Dog10k_manta_paragraph.vcf.gz/content
SVI=$Z/Dog10k_manta_paragraph.vcf.gz.tbi/content
bcftools view -r chr37:25500000-25620000 -S sv.samples --force-samples \
  -Oz -o dog10k_nhej1_svs.vcf.gz "$SV##idx##$SVI"
tabix -p vcf dog10k_nhej1_svs.vcf.gz
```

`sv.samples` is derived from the Dog10K sample table: every Collie, Shetland
Sheepdog, and Silken Windhound in the analysis set, four Lancashire Heelers,
then Australian Shepherds, German Shepherds, and Labrador Retrievers as breeds
with no reported association, and four Greek gray wolves as the outgroup.

Before drawing anything, read the genotypes directly:

```bash
bcftools query -r chr37:25574005-25574006 -f '[%SAMPLE=%GT ]\n' \
  dog10k_nhej1_svs.vcf.gz | tr ' ' '\n' | grep -v '=0/0'
```

Eleven of the thirteen Collies carry it, four of them homozygous, along with two
of four Shetland Sheepdogs and one of two Silken Windhounds. Nothing else in the
set carries a copy.

## Loading the slice with breed labels

An SV VCF loads as an ordinary `VariantTrack`. The multi-sample variant display
draws one row per sample across the variant's real genomic span, so a 7.8 kb
deletion is a 7.8 kb block.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_nhej1_svs",
  "name": "Dog10K structural variants at NHEJ1",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_nhej1_svs.vcf.gz"
  }
}
```

The sample rows keep the Dog10K IDs, which say nothing to a reader. `layout`
renames them for the sidebar and gives each group a swatch without touching the
VCF.

`layout` is display **state**, the same thing the tree sidebar writes when you
rearrange rows by hand, so it belongs on a session's track entry. A display
config accepts only its declared slots, so a `layout` put in `displays` is
ignored with no error:

```json session config=test_data/dog10k/config.json
{
  "defaultSession": {
    "name": "NHEJ1 deletion",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "UU_Cfam_GSD_1.0",
          "loc": "chr37:25,570,000-25,580,000",
          "tracks": [
            {
              "trackId": "dog10k_nhej1_svs",
              "type": "LinearMultiSampleVariantDisplay",
              "layout": [
                {
                  "name": "COLL000001",
                  "label": "Collie 1",
                  "color": "#0072B2"
                },
                {
                  "name": "CLUPGR000001",
                  "label": "Wolf 1",
                  "color": "#E69F00"
                }
              ]
            }
          ]
        }
      }
    ]
  }
}
```

Add the assembly's gene annotation above it, since calling the deletion intronic
means reading it against _NHEJ1_'s exons.

## Reading the NHEJ1 deletion

<Figure caption="A 7.8 kb deletion inside an NHEJ1 intron, genotyped across breeds from the Dog10K structural-variant callset. Every carrier is a Collie-clade breed; the other breeds and the four wolves are homozygous reference. The lane between the genes and the genotypes is OMIA's curated record of the same variant." src="/img/dog10k-nhej1-cea-deletion.png" />

The deletion falls inside an intron and clears no exon, which is how a variant
this large can be common in a breed.

### Checking the call against a curated source

The middle lane is [OMIA](https://omia.org), which curates the published causal
variants of Mendelian traits in animals, one record per variant with its
phenotype, mode of inheritance and reported coordinates; its Collie eye anomaly
record (OMIA 000218-9615) is this deletion. Its span was published on CanFam3.1
and lifted here with UCSC's chain, so the bar and the genotype column below it
come from two publications by two routes:

<!-- from: scripts/build_omia_dog_variants.sh -->

```bash
curl -fO https://hgdownload.soe.ucsc.edu/goldenPath/canFam3/liftOver/canFam3ToCanFam4.over.chain.gz
./liftOver omia_canFam3.bed canFam3ToCanFam4.over.chain.gz lifted.bed unmapped.bed
wc -l < unmapped.bed   # records the chain could not place
```

An interval lifts as a unit, so a plain `liftOver` is enough. A BND carries its
partner coordinate inside `ALT` and needs more; the
[cancer SV tutorial](/docs/tutorials/cancer_sv) covers that.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "omia_dog_variants",
  "name": "OMIA causal variants (dog)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "omia_dog_variants.gff3.gz"
  },
  "displayDefaults": {
    "labels": { "description": "jexl:feature.inheritance" }
  }
}
```

The mode of inheritance is drawn as the feature's description.

Click the bar for the rest of the record, including whether it reached canFam4
through a chain. A lifted record can be right about the locus and wrong about
the base.

### Filtering to one record

The window holds nine SV records, and the figure filters to this one:

```json
{
  "type": "VariantTrack",
  "trackId": "dog10k_nhej1_svs",
  "name": "Dog10K structural variants at NHEJ1",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_nhej1_svs.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "dog10k_nhej1_svs-LinearMultiSampleVariantDisplay",
      "jexlFilters": ["feature.start == 25574004"]
    }
  ]
}
```

Unfiltered, a second deletion nested inside the 7.8 kb one paints yellow
no-calls against the darkest blue and the two records read as one striped block.
The nested deletion is missing in exactly the four dogs homozygous for the
larger one:

```bash
# -i POS=… because -r is END-aware and would also return the deletion this one
# sits inside
bcftools query -r chr37:25578185-25578186 -i 'POS=25578185' \
  -f '[%SAMPLE=%GT ]\n' dog10k_nhej1_svs.vcf.gz \
  | tr ' ' '\n' | grep -v '=0/0'
```

A dog with no copy of the surrounding sequence has no reads to genotype the
nested call from, so the genotyper returns missing.

### The Lancashire Heelers

Collie eye anomaly is reported in Lancashire Heelers, and none of the four
sampled here carry the deletion. Four dogs is not a frequency estimate.

## Two diet genes that run opposite ways

A 14.9 kb `DUP` at chr6:47,375,677 in the Michigan Manta callset spans the
pancreatic amylase gene end to end. Extra copies of it are the starch-digestion
signature of domestication
([Axelsson et al. 2013](https://doi.org/10.1038/nature11837)), and the record
separates dogs from wolves almost completely:

```
  Breed_Dogs      1575 canids: 1568 hom alt, 6 hom ref, 1 het
  Mixed/Other       12 canids: 12 hom alt
  Village_Dogs     237 canids: 236 hom alt, 1 hom ref
  Wolf              55 canids: 50 hom ref, 4 het, 1 hom alt
```

A 223 bp SINE insertion in pancreatic ribonuclease, chr15:18,164,072 in the
Zenodo Paragraph set, runs the other way:

```
  Breed_Dogs      1575 canids: 1574 hom ref, 1 het
  Mixed/Other       12 canids: 12 hom ref
  Village_Dogs     237 canids: 236 hom ref, 1 het
  Wolf              55 canids: 29 hom ref, 26 het
```

One panel is sliced from both callsets in the same order so the two lanes read
row for row: two ordinary breeds, the three Arctic breeds, the two other breeds
holding a dog that departs from the amylase rule, the Alaskan village dogs, and
every gray wolf in the analysis set labelled by country.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_amy2b_svs",
  "name": "Dog10K structural variants at AMY2B (dogs and every wolf)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_amy2b_svs.vcf.gz",
    "samplesTsvLocation": { "uri": "dog10k_amy2b_samples.tsv" }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "colorBy": "group",
      "height": 900
    }
  ]
}
```

Too many rows for a `layout` entry each, so the labels come from a TSV: first
column the sample name, every other column an attribute, and `colorBy` naming
the one that paints the swatch. The _RNASE1_ track is that same config with the
other slice's `uri`.

<Figure caption="Left: a 14.9 kb duplication over pancreatic amylase. Right: a 223 bp insertion in pancreatic ribonuclease. Same 86 animals in the same order in both, so a row reads straight across: the dogs carry the amylase duplication and the wolves the ribonuclease insertion." src="/img/dog10k-diet-genes.png" />

Two of the three Greenland Dogs lack the duplication; the third carries it, as
does every Alaskan Malamute and every Samoyed. The grey Czechoslovakian Wolfdog
row is CZEC000003, the animal
[the local-ancestry tutorial](/docs/tutorials/local_ancestry) paints
wolf-derived blocks on.

Every wolf carrying the insertion is heterozygous, so the lower lane is one
shade where the upper one has two. Three of the six Iranian wolves carry the
amylase duplication and none the ribonuclease insertion, while the Greek and
Swedish wolves do the reverse.

Copy number is what amylase is known for, and a genotype column does not carry
it: four copies and twenty are both `1/1`.
[The CYP1A2 tutorial](/docs/tutorials/dog10k_lof) builds that measurement from
the SNV callset's per-sample `DP`, and `dog10k_slc28a3_breed_cn` and
`dog10k_slc28a3_cohort_cn` in this tutorial's config are the same pair of lanes
over a second duplication.

## The FGF4 retrogene, read at its parent gene

The variant here is an insertion somewhere else in the genome, and what the
callset holds at _FGF4_ is its footprint.

[Parker et al. (2009)](https://doi.org/10.1126/science.1173275) tied
breed-defining short legs to an expressed _FGF4_ retrogene, a processed copy of
the _FGF4_ transcript reinserted elsewhere. Processed means it was made from the
spliced mRNA, so it has no introns: short reads from the retrocopy map to the
parent's exons and stop at each splice site, and a short-read caller reads that
pileup as a deletion of each intron.

The retrocopy interpretation comes from Parker et al.; the callset cannot tell a
retrocopy's footprint from a real deletion.

### Checking the records against the FGF4 introns

_FGF4_ has two introns, so a retrocopy should leave two records, each spanning
one intron end to end.
[`build_dog10k_fgf4_retrogene.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_retrogene.sh)
derives the introns from the RefSeq annotation and asserts each record against
them, allowing one base of slack at each breakpoint, before it writes any track:

```
FGF4 RefSeq exons:  48869443-48869782, 48870315-48870418, 48870953-48873311
FGF4 RefSeq introns: 48869783-48870314 (532 bp),  48870419-48870952 (534 bp)

intron 48869783-48870314: called as a DEL of 532 bp at 48869783-48870314
intron 48870419-48870952: called as a DEL of 534 bp at 48870418-48870951
```

### Slicing the two records out

This locus comes from the Michigan aggregate Manta callset, 1.08 GB over the
same collection, which carries `DUP` and `INV` records too. Selecting on `POS`
keeps the two intron records and drops everything else called nearby:

<!-- from: scripts/build_dog10k_fgf4_retrogene.sh -->

```bash
SHARE=https://kiddlabshare.med.umich.edu/dog10K
SV=$SHARE/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
bcftools view -r chr18:48865000-48876000 -S fgf4.samples --force-samples \
  -i 'POS=48869782 || POS=48870417' \
  -Oz -o dog10k_fgf4_svs.vcf.gz "$SV"
tabix -p vcf dog10k_fgf4_svs.vcf.gz
```

`fgf4.samples` is whole breeds again: three breeds whose short legs are the
trait Parker et al. mapped, two spaniel breeds, two standard-proportioned breeds
with no reported association, and the Greek gray wolves. Labelled through a
samples TSV as above, with `colorBy` on the breed group.

```json
{
  "type": "VariantTrack",
  "trackId": "dog10k_fgf4_svs",
  "name": "Dog10K structural variants at FGF4 (named breeds)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_fgf4_svs.vcf.gz",
    "samplesTsvLocation": { "uri": "dog10k_fgf4_samples.tsv" }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "colorBy": "group",
      "height": 690
    }
  ]
}
```

The positional display draws each record at its own coordinates, so the two
blocks sit where they fall against the exons.

Every carrier is heterozygous: the parent gene's introns are still on both
chromosomes, so a carrier's pileup is always a mixture.

### The two known FGF4 retrocopies

Two _FGF4_ retrocopies are known in dogs. Parker et al. tied one to short legs;
[Brown et al. (2017)](https://doi.org/10.1073/pnas.1709082114) tied a second, on
a different chromosome, to chondrodystrophy and intervertebral disc disease,
which is why breeds of ordinary proportions carry a copy too.

Both are copies of the same transcript, so both leave the same footprint at the
parent gene and one record cannot say which. The swatch names a breed's
proportions, and the spaniels are the rows where proportions and genotype
disagree. Placing either insertion needs the other side of the junction, a
different query against a different callset.

### The retrocopy itself, as sequence {#the-retrocopy-itself-as-sequence}

Both copies were amplified, Sanger-sequenced and deposited, as
[MF040222](https://www.ncbi.nlm.nih.gov/nuccore/MF040222) for the CFA18
insertion and [MF040221](https://www.ncbi.nlm.nih.gov/nuccore/MF040221) for the
CFA12 one. Most candidate retrocopies have no sequenced insert.

One alignment per retrocopy, against the parent locus cut out as its own FASTA:

<!-- from: scripts/build_dog10k_fgf4_synteny.sh -->

```bash
# `splice` chains across the parent's introns so both gaps land on the annotated
# ones; -c writes the base-level CIGAR the ribbons are drawn from. Rewrite the
# N operations it emits to D afterwards: those bases really are absent here.
samtools faidx parent.fa
minimap2 -x splice -c parent.fa FGF4retro-CFA12.fa > FGF4retro-CFA12.paf
```

Load each retrocopy as a one-contig assembly and its alignment as a
`SyntenyTrack`:

```json
{
  "type": "SyntenyTrack",
  "trackId": "dog10k_fgf4_retro_cfa12",
  "name": "FGF4 CFA12 retrocopy (MF040221) vs its parent gene",
  "assemblyNames": ["FGF4retro-CFA12", "UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "PAFAdapter",
    "uri": "dog10k_fgf4_retro_cfa12.paf",
    "queryAssembly": "FGF4retro-CFA12",
    "targetAssembly": "UU_Cfam_GSD_1.0"
  }
}
```

`assemblyNames` is ordered `[query, target]`, which is the reverse of the order
minimap2 takes its inputs.

Each GenBank record carries a feature table, so the gene model on a retrocopy
row is the submitters' annotation. The build script writes it out as GFF3 and
requires the CDS to be a single interval: the parent's CDS is three boxes and a
processed copy's is one.

Put the parent gene between the two retrocopies. Both align to the same three
exons, so from above and below each intron is one gap seen twice.

<Figure caption="Two independent FGF4 retrocopies aligned to the parent gene between them, with the Manta calls at their own coordinates and then across 55 Dog10K genomes. Every ribbon gap falls on a parent intron and the blue blocks sit in those same two places." src="/img/dog10k-fgf4-retrogene-synteny.png" />

The window stops where the CFA18 alignment does, so that retrocopy is on screen
end to end and the CFA12 ribbon runs on past it.

Set the synteny view's indel drawing to **Transparent indels**. Colored indels
name each CIGAR operation from the side it is read, so one gap is a deletion
above the parent row and an insertion below it, taking two colors by stacking
order.

The two records agree at 207 codons but their spans against chr18 differ, so the
two retrocopies took the same coding sequence and different amounts of UTR.
Neither places the insertion: the deposited sequence ends at the poly(A) tail,
so none of the landing site comes with it.

### Genotypes across the collection

The same two records genotyped over every canid the callset carries, printed by
the build script:

```
Genotype counts per group, at the intron 1 record (chr18:48869782):
  Breed_Dogs     1575 canids: 1177 hom ref, 381 het, 12 no call, 5 hom alt
  Mixed/Other      12 canids: 10 hom ref, 2 het
  Village_Dogs    237 canids: 198 hom ref, 39 het
  Wolf             55 canids: 55 hom ref

  of 290 breeds with two or more animals: 52 carry it in every animal, 198 in none

  1831 of 1879 canids get the same call from both: 97.4%
  most common (intron 1, intron 2) pairs: (0/0, 0/0) x1422  (0/1, 0/1) x409
```

No wolf in the collection carries it. Manta called the two introns
independently, so the same animals landing on both records is a check: one
retrocopy takes both introns out of the pileup at once.

The whole-collection track is in the config as `dog10k_fgf4_cohort_svs`. 1,879
rows in a few hundred pixels puts each row well under a pixel, where rows alias.

## Where to go next

The same recipe reaches every other variant in the callset. Schall and Kidd's
table of clade-associated SVs is the place to pick the next locus. For the
retrogene shape specifically, any gene whose introns are all called deleted in
some animals and not others is a candidate, and the check is the one the script
runs: do the records match the annotated introns to the base.

## Reproduce it end to end

[`build_dog10k_nhej1_sv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_nhej1_sv.sh)
builds the track:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_nhej1_sv.sh
bash build_dog10k_nhej1_sv.sh   # writes ./dog10k_sv_build/
```

It downloads the Dog10K sample table, derives the breed lists from it, slices
the locus out of the Zenodo genotype VCF, and prints the deletion's genotypes.

[`build_omia_dog_variants.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_omia_dog_variants.sh)
builds the OMIA lane:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_omia_dog_variants.sh
bash build_omia_dog_variants.sh   # writes ./omia_dog_build/
```

OMIA publishes no coordinate API, so this reads the nightly mysqldump the site
offers, keeps the dog records, lifts the CanFam3.1 majority with UCSC's chain,
and prints how many records each assembly contributed and how many the lift
dropped. Rerunning it on another day gives a different count: the database is
curated continuously.

[`build_dog10k_amy2b_sv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_amy2b_sv.sh)
builds the amylase track:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_amy2b_sv.sh
bash build_dog10k_amy2b_sv.sh   # writes ./dog10k_amy2b_build/
```

It derives the panel and the label TSV from the sample table, slices the one
duplication record out of the Manta callset, then genotypes it over every canid
in the callset: the tally quoted above, all eight non-carrier dogs by name, all
five carrier wolves, and the wolves by country.

[`build_dog10k_slc28a3_cn.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_slc28a3_cn.sh)
builds the copy-number tracks the same way:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_slc28a3_cn.sh
bash build_dog10k_slc28a3_cn.sh   # writes ./dog10k_slc28a3_cn_build/
```

It prints each panel animal's copy number over the duplication. Its first route
needs only `bcftools`; the second re-measures six of those animals from their
SRA runs, which needs an aligner and about 35 GB of scratch.

Two more build the _FGF4_ locus:

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_dog10k_fgf4_retrogene.sh
curl -fO $BASE/build_dog10k_fgf4_synteny.sh
bash build_dog10k_fgf4_retrogene.sh   # writes ./dog10k_fgf4_build/
bash build_dog10k_fgf4_synteny.sh     # writes ./dog10k_fgf4_synteny_build/
```

[`build_dog10k_fgf4_retrogene.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_retrogene.sh)
derives the panel and the label TSV from the sample table, checks both records
against the RefSeq introns, slices them out of the callset for the panel and for
the whole collection, and prints the genotype counts quoted above.
[`build_dog10k_fgf4_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_synteny.sh)
fetches both GenBank records and the parent locus, writes each record's feature
table out as GFF3, aligns each retrocopy, and rewrites the PAF into absolute
`chr18` coordinates. It exits non-zero unless every gap in both alignments lands
on an annotated _FGF4_ intron and each deposited CDS is a single interval.

## See also

- [](/docs/tutorials/dog10k_lof)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/local_ancestry)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/population_cnv)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/linear_synteny_view)

## References

- Axelsson et al. (2013).
  [The genomic signature of dog domestication reveals adaptation to a starch-rich diet](https://doi.org/10.1038/nature11837)
- Schall & Kidd (2025).
  [Integrative genotyping and analysis of canine structural variation using long-read and short-read data](https://doi.org/10.1093/gbe/evaf173)
- Parker et al. (2007).
  [Breed relationships facilitate fine-mapping studies: a 7.8-kb deletion cosegregates with Collie eye anomaly across multiple dog breeds](https://doi.org/10.1101/gr.6772807)
- Parker et al. (2009).
  [An expressed fgf4 retrogene is associated with breed-defining chondrodysplasia in domestic dogs](https://doi.org/10.1126/science.1173275)
- Brown et al. (2017).
  [FGF4 retrogene on CFA12 is responsible for chondrodystrophy and intervertebral disc disease in dogs](https://doi.org/10.1073/pnas.1709082114)
- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
