---
title: Structural variants (Dog10K)
sidebar_label: Dog10K (SVs)
description:
  Genotype four classes of structural variant across dog breeds and read each
  against the gene it sits in
guide_category: Tutorials
tutorial_category: Population genomics
tutorial_subcategory: Dog10K
---

Dog breeds differ by large structural variants, some of them tied to a breed's
traits. We slice four loci out of the Dog10K callsets over HTTP and show each
animal's genotype as one row, labelled by breed, under the gene the variant sits
in: a deletion in _NHEJ1_ behind Collie eye anomaly, a duplication of the
amylase gene _AMY2B_, a SINE insertion in _RNASE1_, and the footprint an _FGF4_
retrogene leaves at its parent gene.

## Prerequisites

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4,
  see the [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl
- `curl`
- `python3`
- htslib (`tabix`)
- `minimap2`, for the [FGF4 alignments](#aligning-the-retrocopies-to-fgf4)
- `samtools`, for the [FGF4 alignments](#aligning-the-retrocopies-to-fgf4)
- the UCSC `liftOver` binary for the OMIA track, which the build script fetches
  itself

On Debian/Ubuntu, `apt install bcftools samtools minimap2 tabix curl python3`
covers the rest. The scripts write local files, which
[JBrowse Desktop](/docs/quickstart_desktop) opens by path and JBrowse Web takes
through **Add track**.

## Where the data comes from

Two Dog10K structural-variant callsets from Schall & Kidd
([2025](https://doi.org/10.1093/gbe/evaf173)), read directly over HTTP, plus
supporting UCSC and OMIA tracks and two sequenced retrocopies from GenBank.

- the Zenodo Paragraph callset, 5.9 GB, with the _NHEJ1_ deletion and the
  _RNASE1_ insertion:
  https://zenodo.org/api/records/14968874/files/Dog10k_manta_paragraph.vcf.gz/content
- the Michigan Manta aggregate callset, 1.08 GB, with the _AMY2B_ duplication
  and the _FGF4_ intron records:
  https://kiddlabshare.med.umich.edu/dog10K/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
- the sample table, breed and category per animal, behind every figure on this
  page:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
- OMIA's own dump, curating the Collie eye anomaly record independently of
  either callset: https://omia.org/static/omia.sql.gz
- the canFam3-to-canFam4 chain that lifts OMIA's coordinates:
  https://hgdownload.soe.ucsc.edu/goldenPath/canFam3/liftOver/canFam3ToCanFam4.over.chain.gz
- the `UU_Cfam_GSD_1.0` gene annotation from
  [genomes.jbrowse.org's canFam4](https://genomes.jbrowse.org/ucsc/canFam4/),
  checking the _FGF4_ records against the gene's introns and drawing the
  parent-gene track in the synteny figure:
  https://jbrowse.org/ucsc/canFam4/ncbiRefSeq.gff.gz
- the CFA18 retrocopy, MF040222, fetched from GenBank:
  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=MF040222&rettype=fasta&retmode=text
- the CFA12 retrocopy, MF040221, fetched from GenBank:
  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=MF040221&rettype=fasta&retmode=text
- the _FGF4_ parent-locus sequence the two retrocopies are aligned against, over
  UCSC's canFam4 REST API:
  https://api.genome.ucsc.edu/getData/sequence?genome=canFam4;chrom=chr18;start=48865000;end=48876000

## Loading the UU_Cfam_GSD_1.0 dog assembly

The tracks name `UU_Cfam_GSD_1.0`, the Dog10K reference that UCSC calls canFam4.
We load it from UCSC's 2bit, with the alias file that maps the `chr` names to
GenBank accessions:

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

## A 7.8 kb deletion in NHEJ1

Schall and Kidd genotyped long-read-discovered structural variants across the
Dog10K collection and flagged those whose allele frequencies track breed clades
(groups of related breeds). One is a 7.8 kb deletion in an intron of _NHEJ1_,
the variant [Parker et al. (2007)](https://doi.org/10.1101/gr.6772807) tied to
Collie eye anomaly. It should be common in Collies and their relatives and
absent from unrelated breeds and wolves. The anomaly is recessive, so the darker
cells below are affected animals and the lighter ones carriers.

## Slicing the NHEJ1 locus out of the Paragraph callset

The Paragraph callset (structural variants genotyped with Paragraph) is a 5.9 GB
VCF across 1,879 dogs and wolves, published on
[Zenodo](https://doi.org/10.5281/zenodo.14968873) with a tabix index, and
`bcftools` fetches only the locus. Zenodo serves the data and index from
separate URLs, so the index is named explicitly:

<!-- from: scripts/build_dog10k_nhej1_sv.sh -->

```bash
Z=https://zenodo.org/api/records/14968874/files
SV=$Z/Dog10k_manta_paragraph.vcf.gz/content
SVI=$Z/Dog10k_manta_paragraph.vcf.gz.tbi/content
# --force-samples: skip names in sv.samples that the VCF lacks
bcftools view -r chr37:25500000-25620000 -S sv.samples --force-samples \
  -Oz -o dog10k_nhej1_svs.vcf.gz "$SV##idx##$SVI"
tabix -p vcf dog10k_nhej1_svs.vcf.gz
```

`sv.samples` comes from the Dog10K sample table: every Collie, Shetland Sheepdog
and Silken Windhound in the analysis set; four Lancashire Heelers, a breed where
Collie eye anomaly is reported; Australian Shepherds, German Shepherds and
Labrador Retrievers as breeds with no reported association; and four Greek gray
wolves as the outgroup. Read the genotypes directly first:

<!-- from: scripts/build_dog10k_nhej1_sv.sh -->

```bash
bcftools query -r chr37:25574005-25574006 -f '[%SAMPLE=%GT ]\n' \
  dog10k_nhej1_svs.vcf.gz | tr ' ' '\n' | grep -v '=0/0'
```

Most of the Collies have it, some homozygous, along with some of the Shetland
Sheepdogs and Silken Windhounds. Every other animal is homozygous reference.

## Loading the NHEJ1 slice with breed labels

An SV VCF loads as an ordinary `VariantTrack`. The multi-sample variant display
draws one row per sample across the variant's genomic span, so a 7.8 kb deletion
is a 7.8 kb block.

```json addtrack
{
  "trackId": "dog10k_nhej1_svs",
  "name": "Dog10K structural variants at NHEJ1",
  "uri": "dog10k_nhej1_svs.vcf.gz",
  "assemblyNames": ["UU_Cfam_GSD_1.0"]
}
```

The VCF names each sample by its Dog10K ID. In the session below, `rows` gives
each sample a label and orders the rows as `domain` lists them, and `rowColor`
gives each row a swatch. The fence names two animals to show the shape, and the
figure names every row the same way. **Edit colors/arrangement...** in the track
menu writes the same two settings as you rename and recolour rows by hand.

```json session config=test_data/dog10k/config.json
{
  "defaultSession": {
    "name": "NHEJ1 deletion",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "UU_Cfam_GSD_1.0",
        "loc": "chr37:25,570,000-25,580,000",
        "tracks": [
          {
            "trackId": "dog10k_nhej1_svs",
            "type": "LinearMultiSampleVariantDisplay",
            "rows": {
              "domain": ["COLL000001", "CLUPGR000001"],
              "labels": { "COLL000001": "Collie 1", "CLUPGR000001": "Wolf 1" }
            },
            "rowColor": {
              "domain": ["COLL000001", "CLUPGR000001"],
              "range": ["#0072B2", "#E69F00"]
            }
          }
        ]
      }
    ]
  }
}
```

## NHEJ1 deletion genotypes across breeds

Open the session above and add the assembly's gene annotation over the variants
to see where the deletion falls in _NHEJ1_.

<Figure caption="A 7.8 kb deletion inside an NHEJ1 intron, genotyped across breeds from the Dog10K structural-variant callset. Every animal with the deletion is a Collie-clade breed; the other breeds and the four wolves are homozygous reference. The track between the genes and the genotypes is OMIA's curated record of the same variant." src="/img/dog10k-nhej1-cea-deletion.png" />

### Checking the NHEJ1 deletion against OMIA's curated record

The middle track is [OMIA](https://omia.org), Online Mendelian Inheritance in
Animals, which curates the published causal variants of Mendelian traits. Its
Collie eye anomaly record (OMIA 000218-9615) is this deletion. OMIA gives the
span on CanFam3.1, and the build script lifts it to canFam4 with the UCSC chain:

<!-- from: scripts/build_omia_dog_variants.sh -->

```bash
curl -fO https://hgdownload.soe.ucsc.edu/goldenPath/canFam3/liftOver/canFam3ToCanFam4.over.chain.gz
./liftOver omia_canFam3.bed canFam3ToCanFam4.over.chain.gz lifted.bed unmapped.bed
wc -l < unmapped.bed   # records the chain could not place
```

```json addtrack
{
  "trackId": "omia_dog_variants",
  "name": "OMIA causal variants (dog)",
  "uri": "omia_dog_variants.gff3.gz",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "displayDefaults": {
    "labels": { "description": "jexl:feature.inheritance" }
  }
}
```

The label under the bar gives the mode of inheritance. Click the bar for the
rest of the record, including whether the build lifted it from CanFam3.1. A
lifted record can place the locus correctly and still be off by a few bases.

### Filtering the NHEJ1 window to the deletion record

The figure filters the window's SV records to the 7.8 kb deletion:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_nhej1_svs",
  "name": "Dog10K structural variants at NHEJ1",
  "uri": "dog10k_nhej1_svs.vcf.gz",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "filter": ["jexl:feature.start == 25574004"]
    }
  ]
}
```

Without the filter, a second deletion nested inside the 7.8 kb one draws yellow
no-calls over the dark blue rows, so the two records look like one striped
block. The no-calls are the dogs homozygous for the larger deletion, because a
dog with no copy of the surrounding sequence has no reads to genotype it from:

```bash
# -r also returns records that span the region, so -i keeps the one starting here
bcftools query -r chr37:25578185-25578186 -i 'POS=25578185' \
  -f '[%SAMPLE=%GT ]\n' dog10k_nhej1_svs.vcf.gz \
  | tr ' ' '\n' | grep -v '=0/0'
```

### Lancashire Heelers, with Collie eye anomaly and no deletion

Collie eye anomaly is reported in Lancashire Heelers, and none of the four
sampled here have the deletion. Four dogs are too few to estimate how common the
deletion is in the breed.

## AMY2B duplication and RNASE1 insertion

A 14.9 kb duplication (`DUP`) at chr6:47,375,677 in the Michigan Manta callset
spans the pancreatic amylase gene _AMY2B_ end to end. Extra copies help dogs
digest starch, a change
[Axelsson et al. (2013)](https://doi.org/10.1038/nature11837) tied to
domestication. Across the whole collection, the record separates dogs from
wolves almost completely: nearly every dog is homozygous for it and nearly every
wolf lacks it.

A 223 bp SINE (short interspersed nuclear element) insertion in pancreatic
ribonuclease (_RNASE1_), at chr15:18,164,072 in the Zenodo Paragraph set, occurs
in wolves and almost no dogs.
[`build_dog10k_amy2b_sv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_amy2b_sv.sh)
prints both records' genotypes tallied by population.

The build script slices the same animals from both callsets in the same order,
so the two tracks line up row for row: two ordinary breeds, the three Arctic
breeds, the English Springer Spaniels and Czechoslovakian Wolfdogs, the Alaskan
village dogs, and every gray wolf, labelled by country.

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
      "rowColor": "group",
      "height": 900
    }
  ]
}
```

A samples TSV supplies the labels for these 86 rows. Its first column is the
sample name and every other column is an attribute; `rowColor` names the
attribute that colours the swatch. The _RNASE1_ track is the same config with
the other slice's `uri`.

<Figure caption="Left: a 14.9 kb duplication over pancreatic amylase. Right: a 223 bp insertion in pancreatic ribonuclease. The same animals are in the same order in both, so each row is one animal: the dogs have the amylase duplication and the wolves the ribonuclease insertion." src="/img/dog10k-diet-genes.png" />

Most of the Greenland Dogs lack the duplication, while every Alaskan Malamute
and Samoyed has it. The grey Czechoslovakian Wolfdog row is CZEC000003, the
animal [the local-ancestry tutorial](/docs/tutorials/local_ancestry) paints
wolf-derived blocks on. Every wolf with the insertion is heterozygous. Some of
the Iranian wolves have the amylase duplication and none the ribonuclease
insertion, while the Greek and Swedish wolves do the reverse.

A genotype records whether an animal has the duplication, so an animal with four
copies and one with twenty are both `1/1`.
[The CYP1A2 tutorial](/docs/tutorials/dog10k_lof#copy-number-at-cyp1a2) measures
copy number from the SNV callset's per-sample `DP`.

## An FGF4 retrogene called as intron deletions

[Parker et al. (2009)](https://doi.org/10.1126/science.1173275) tied
breed-defining short legs to an expressed _FGF4_ retrogene, a copy of the
spliced _FGF4_ mRNA reinserted elsewhere in the genome. The copy has no introns,
so short reads from it map to the parent gene's exons and stop at each splice
site, and a short-read caller reports that pileup as a deletion of each intron.
At _FGF4_ the callset therefore records the retrogene as intron deletions, which
look the same as real ones.

### Checking the records against the FGF4 introns

_FGF4_ has two introns, so a retrocopy should leave two records, each spanning
one intron end to end.
[`build_dog10k_fgf4_retrogene.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_retrogene.sh)
derives the introns from the RefSeq annotation and asserts each record against
them, with one base of slack at each breakpoint:

```text
FGF4 RefSeq exons:  48869443-48869782, 48870315-48870418, 48870953-48873311
FGF4 RefSeq introns: 48869783-48870314 (532 bp),  48870419-48870952 (534 bp)

intron 48869783-48870314: called as a DEL of 532 bp at 48869783-48870314
intron 48870419-48870952: called as a DEL of 534 bp at 48870418-48870951
```

### Slicing the two FGF4 intron records out of the Manta callset

The _FGF4_ records come from the Michigan aggregate Manta callset, which has
`DUP` and `INV` records too. Selecting on `POS` keeps the two intron records:

<!-- from: scripts/build_dog10k_fgf4_retrogene.sh -->

```bash
SHARE=https://kiddlabshare.med.umich.edu/dog10K
SV=$SHARE/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
# --force-samples: skip names in fgf4.samples that the VCF lacks
bcftools view -r chr18:48865000-48876000 -S fgf4.samples --force-samples \
  -i 'POS=48869782 || POS=48870417' \
  -Oz -o dog10k_fgf4_svs.vcf.gz "$SV"
tabix -p vcf dog10k_fgf4_svs.vcf.gz
```

`fgf4.samples` holds whole breeds: three breeds whose short legs are the trait
Parker et al. mapped, two spaniel breeds, two standard-proportioned breeds, and
the Greek gray wolves, labelled through a samples TSV with `rowColor` on the
breed group.

```json addtrack
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
      "rowColor": "group",
      "height": 690
    }
  ]
}
```

Each record draws at the coordinates it names, so the two blocks sit against the
exons. Every animal with the insertion is heterozygous: the parent gene's
introns are still on both chromosomes, so each such animal's pileup is always a
mixture.

### The two known FGF4 retrocopies

Two _FGF4_ retrocopies are known in dogs. Parker et al. tied one to short legs;
[Brown et al. (2017)](https://doi.org/10.1073/pnas.1709082114) tied a second, on
a different chromosome, to chondrodystrophy and intervertebral disc disease,
which is why breeds of ordinary proportions have a copy too. Both retrocopies
leave the same records at the parent gene, so a genotype here cannot say which
copy an animal has. The spaniels are the rows where body proportions and
genotype disagree. Placing either insertion needs the other side of the
junction, from a different callset.

### Aligning the retrocopies to FGF4

Brown et al. deposited Sanger sequences of both retrocopies:
[MF040222](https://www.ncbi.nlm.nih.gov/nuccore/MF040222) for the CFA18
insertion and [MF040221](https://www.ncbi.nlm.nih.gov/nuccore/MF040221) for the
CFA12 one. Align each against the parent locus, cut out as a separate FASTA:

<!-- from: scripts/build_dog10k_fgf4_synteny.sh -->

```bash
# -x splice aligns across the parent's introns; -c writes the base-level CIGAR
samtools faidx parent.fa
minimap2 -x splice -c parent.fa FGF4retro-CFA12.fa > FGF4retro-CFA12.paf
```

Load each retrocopy as a one-contig assembly, from the indexed FASTA the build
script writes:

```json addassembly
{
  "name": "FGF4retro-CFA12",
  "uri": "FGF4retro-CFA12.fa"
}
```

```json addassembly
{
  "name": "FGF4retro-CFA18",
  "uri": "FGF4retro-CFA18.fa"
}
```

Each alignment is a `SyntenyTrack` between its retrocopy and the dog assembly:

```json addtrack
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

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "dog10k_fgf4_retro_cfa18",
  "name": "FGF4 CFA18 retrocopy (MF040222) vs its parent gene",
  "assemblyNames": ["FGF4retro-CFA18", "UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "PAFAdapter",
    "uri": "dog10k_fgf4_retro_cfa18.paf",
    "queryAssembly": "FGF4retro-CFA18",
    "targetAssembly": "UU_Cfam_GSD_1.0"
  }
}
```

`assemblyNames` is ordered `[query, target]`, the reverse of minimap2's argument
order. The build script then turns each `FGF4retro-*.paf` into the file the
track loads, `dog10k_fgf4_retro_cfa12.paf` and its CFA18 twin. For each file it:

- renames the target to `chr18` and shifts its coordinates by the window's start
- rewrites each CIGAR `N` to `D`, since those bases are absent from the
  retrocopy
- writes each GenBank feature table as GFF3 for the gene model, and checks that
  the CDS is a single interval (the parent's has three)

To put the parent gene between the two retrocopies, choose **Add → Linear
synteny view**, switch to **Manual**, and set the rows to `FGF4retro-CFA18`,
`UU_Cfam_GSD_1.0` and `FGF4retro-CFA12`, top to bottom. Give the upper pair the
CFA18 alignment and the lower pair the CFA12 one, then click **Launch**. Open
the view's sliders menu and set **CIGAR indels → Transparent indels**. Colored
indels would show one gap as a deletion above the parent row and an insertion
below it, because each ribbon reads the CIGAR from its own side. Both
retrocopies align to the same three exons, so each intron is a gap in both
ribbons. The window ends where the CFA18 alignment does, and the CFA12 ribbon
runs past it.

<Figure caption="Two independent FGF4 retrocopies aligned to the parent gene between them, with the Manta calls in reference coordinates and then across Dog10K genomes. Every ribbon gap falls on a parent intron and the blue blocks sit in those same two places." src="/img/dog10k-fgf4-retrogene-synteny.png" />

The two GenBank records agree across the coding sequence and differ in how much
UTR they include. Both deposited sequences end at the poly(A) tail, so neither
records where its copy inserted.

## Slicing more clade-associated SVs from Schall and Kidd

Schall and Kidd list the clade-associated SVs they found, and any of them can be
sliced and loaded the same way. Another retrogene shows up as a gene whose
introns are all called deleted in some animals, and the FGF4 build script's
check applies to it: each record should match an annotated intron to the base.

## Reproduce it end to end

Five scripts build the tracks in the figures; see
[Prerequisites](#prerequisites). Each writes a `*_build/` directory.

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_dog10k_nhej1_sv.sh
curl -fO $BASE/build_omia_dog_variants.sh
curl -fO $BASE/build_dog10k_amy2b_sv.sh
curl -fO $BASE/build_dog10k_fgf4_retrogene.sh
curl -fO $BASE/build_dog10k_fgf4_synteny.sh
bash build_dog10k_nhej1_sv.sh
bash build_omia_dog_variants.sh
bash build_dog10k_amy2b_sv.sh
bash build_dog10k_fgf4_retrogene.sh
bash build_dog10k_fgf4_synteny.sh
```

- `build_omia_dog_variants.sh` reads OMIA's nightly mysqldump, since OMIA has no
  coordinate API. OMIA updates the database continuously, so the record count
  changes from day to day.
- `build_dog10k_fgf4_retrogene.sh` also writes `dog10k_fgf4_cohort_svs`, the two
  _FGF4_ intron records over every canid in the callset, which this tutorial's
  config holds as a track.
- `build_dog10k_fgf4_synteny.sh` exits non-zero unless every gap in both
  alignments lands on an annotated _FGF4_ intron and each deposited CDS is a
  single interval.

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

## Citations

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
