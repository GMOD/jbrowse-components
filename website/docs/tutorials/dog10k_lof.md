---
title: A loss-of-function allele across breeds (Dog10K)
sidebar_label: Dog10K (loss-of-function allele)
description:
  Locate a nonsense variant from the reference sequence, then read its genotypes
  across dog breeds and wolves
guide_category: Tutorials
tutorial_category: Population genomics
tutorial_subcategory: Dog10K
---

Some dogs are poor metabolizers of the drugs the liver enzyme CYP1A2 clears,
because they have a premature stop codon in _CYP1A2_. The literature names the
variant only by its protein change, so we derive its genome coordinate by
translating the reference coding sequence, slice the gene out of the 397 GB
Dog10K SNV callset over HTTP, and read the genotypes across breeds with the wild
canids as the control. A copy-number lane then shows the gene's expansion across
every canid in the collection.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- the `UU_Cfam_GSD_1.0` dog assembly (UCSC's canFam4) set up in JBrowse. The
  [canFam4 hub on genomes.jbrowse.org](https://genomes.jbrowse.org/ucsc/canFam4/)
  is a config that loads it with its gene and repeat tracks, and the
  [assemblies guide](/docs/config_guides/assemblies) builds one by hand.
- `bcftools` built with libcurl
- `curl`
- `python3`
- htslib (`tabix`)
- `samtools` built with libcurl, for the build script's CRAM cross-check on the
  copy-number lane, which is not a step on this page

On Debian/Ubuntu, `apt install bcftools samtools tabix curl python3` covers it;
the packaged builds are linked against libcurl, so both can read the remote
callset and CRAMs. The scripts write local files, which
[JBrowse Desktop](/docs/quickstart_desktop) opens by path and JBrowse Web takes
through **Add track**.

## Where the data comes from

The Dog10K consortium's public share
([Meadows et al. 2023](https://doi.org/10.1186/s13059-023-03023-7)), read
directly over HTTP with no local copy of the 397 GB callset.

- the SNV/indel callset the gene is sliced from, 397 GB over 1,987 canids:
  https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
- the sample table, breed and category per animal:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
- the reference sequence the stop codon is derived from, over UCSC's canFam4
  REST API:
  https://api.genome.ucsc.edu/getData/sequence?genome=canFam4;chrom=chr30;start=38258000;end=38265000
- the RefSeq gene structure that same derivation reads exon boundaries from:
  https://api.genome.ucsc.edu/getData/track?genome=canFam4;track=ncbiRefSeqCurated;chrom=chr30;start=38258000;end=38265000
- the 15 published CRAMs the copy-number lane validates callset depth against:
  https://kiddlabshare.med.umich.edu/dog10K/cram-share/

## The genome

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

## The CYP1A2 nonsense variant

_CYP1A2_ is a drug-metabolizing cytochrome P450 in which dogs have a nonsense
variant. This tutorial draws one half of the Dog10K paper's figure for the gene:
the truncating variant and who has it.

The consequence is recessive: liver microsomes from dogs homozygous for the
truncating allele have no CYP1A2 protein and those dogs are poor metabolizers of
drugs the enzyme clears, while heterozygotes express it normally
([Mise et al. 2004](https://pubmed.ncbi.nlm.nih.gov/15564884/)).

The questions are which breeds have it and whether it is present in wild canids,
which are the control: an allele shared with wolves predates domestication.

## Deriving the variant's coordinate

The literature names this variant by its protein consequence, p.Arg373Ter, which
is enough to locate it against whichever assembly is in use.

The build script rebuilds _CYP1A2_'s coding sequence from the reference and the
RefSeq exon structure, translates it, and reports codon 373:

```text
NM_001008720.1 CDS 1539 bp, 513 aa
codon 373 = CGA (R) at chr30:38261635
C>T at that first base makes TGA, a stop
```

`CGA` to `TGA` is one substitution and it is a stop codon, so a C>T at
chr30:38,261,635 truncates the protein at 373 of 513 residues. Checking the
callset at exactly that position finds it, passing every filter:

<!-- from: scripts/build_dog10k_cyp1a2.sh -->

```bash
bcftools query -r chr30:38261635-38261636 -f '%POS\t%REF\t%ALT\t%FILTER\t%AC\t%AN\n' \
  "$SNVS"
# chr30  38261635  C  T  PASS  174  3974
```

## Slicing the gene out of the callset

The Dog10K SNV callset is a single 397 GB VCF over 1,987 canids with a tabix
index, so `bcftools` fetches one gene over HTTP:

<!-- from: scripts/build_dog10k_cyp1a2.sh -->

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
# --force-samples: proceed even if a name in cyp.samples isn't in the VCF's
# sample list, instead of exiting
bcftools view -r chr30:38258000-38265000 -S cyp.samples --force-samples \
  -Oz -o dog10k_cyp1a2_snvs.vcf.gz "$SNVS"
tabix -p vcf dog10k_cyp1a2_snvs.vcf.gz
```

`cyp.samples` holds breeds that have the allele, two that do not, and four Greek
gray wolves.

## Loading the slice with breed labels

An SNV VCF loads as an ordinary `VariantTrack`:

```json addtrack
{
  "trackId": "dog10k_cyp1a2_snvs",
  "name": "Dog10K SNVs at CYP1A2",
  "uri": "dog10k_cyp1a2_snvs.vcf.gz",
  "assemblyNames": ["UU_Cfam_GSD_1.0"]
}
```

The display draws one row per sample, labelled with the Dog10K IDs. Two settings
relabel the rows without touching the VCF: the display's `rows` labels for named
animals ([](/docs/tutorials/dog10k_svs)), or a `samplesTsvLocation` for a larger
panel ([Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection)).

A whole-gene view of the slice is a field of one-pixel ticks, so zoom to the
codon. At base level each sample's call is a block, and the gene track shows
which exon it sits in.

## Reading the CYP1A2 genotypes

<Figure caption="The CYP1A2 stop-gained variant at base level: the reference sequence and its translation, the site as an ordinary variant lane, then one row per dog. Five breeds have it; the Labrador Retrievers, Boxers and all four wolves are homozygous reference." src="/img/dog10k-cyp1a2-nonsense.png" />

The build script genotypes the same site over every canid in the callset. Dozens
of breeds have the allele and it reaches homozygosity in several: every German
Hound and every Shetland Sheepdog sampled here has at least one copy, while
every wolf and every coyote in the collection is homozygous reference.

Three neighbours sit within about a hundred bases, and the display filters them
out:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_cyp1a2_snvs",
  "name": "Dog10K SNVs at CYP1A2",
  "uri": "dog10k_cyp1a2_snvs.vcf.gz",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "filter": ["jexl:feature.start == 38261634"]
    }
  ]
}
```

Drop the filter to see them. Two are reference in every animal of this panel,
including the one at the same codon's second base, so each draws an empty
column. The third sits 15 bp along, and every wolf here has it.

## Copy number at CYP1A2

The paper reports half the collection at three or more copies of _CYP1A2_, in
the other half of its figure. The per-animal estimates are unpublished, but the
SNV callset has a per-sample `DP` at every site, so one slice of it, stripped to
the depth field, covers every canid in the collection:

<!-- from: scripts/build_dog10k_cyp1a2_cn.sh -->

```bash
# -r reads only the locus over HTTP; -x keeps FORMAT/DP and drops the rest
bcftools view -r chr30:38205000-38400000 -Ou "$SNVS" |
  bcftools annotate -x 'INFO,^FORMAT/DP' -Oz -o dp.vcf.gz
bcftools query -l dp.vcf.gz > cohort.samples
bcftools query -f '%POS[\t%DP]\n' dp.vcf.gz > cohort.dp
```

The build script converts depth to copy number within each dog, taking the
sequence around the element in that dog as two copies:

```text
CN = 2 * depth over the element / depth over the sequence around it
```

Copy number comes from depth alone; the flanking sequence has to come back at
two copies in every dog, which checks the ratio.

Each window is 5 kb of depth stepped by 1 kb, so a call rests on 5 kb of
evidence and is painted at 1 kb resolution.

The callset records depth only where a variant was called, so the build script
checks it against the 15 CRAMs the Dog10K share publishes. Over the shared
windows the two depth sources agree closely, with no bias. The CRAM-based
painting is in the config as `dog10k_cyp1a2_cn`.

The output is a BED with the colour in the itemRgb column, a `sample` column and
the rounded call in `copyNumber`. The multi-row display gives each sample a row,
and the identity colour scale lists the colours in the file with a copy number
label for each, so the legend reads as copy number:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dog10k_cyp1a2_cohort_cn",
  "name": "CYP1A2 copy number, every canid",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "dog10k_cyp1a2_cohort_cn.bed.gz",
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
      "copyNumber"
    ]
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": "sample",
      "color": {
        "scale": "identity",
        "title": "Copy number",
        "domain": [
          "rgb(33,102,172)",
          "rgb(146,197,222)",
          "rgb(224,224,224)",
          "rgb(244,165,130)",
          "rgb(214,96,77)",
          "rgb(178,24,43)",
          "rgb(103,0,31)"
        ],
        "labels": ["CN 0", "CN 1", "CN 2", "CN 3", "CN 4", "CN 5", "CN 6+"]
      }
    }
  ]
}
```

The build script prints this `color` block from the palette it painted with. For
named animals in a chosen order, `rows` takes
`{ "field": "sample", "domain": [...] }` with the row names listed.

The figure has two lanes, each window coloured by its rounded call and grey at
two copies: named animals above, and all 1,987 canids clustered on their
profiles below.

<Figure caption="Copy number over CYP1A2 and 185 kb around it, named animals above and the whole collection below. The expansion is a breed-level fact in some breeds and segregates one dog to the next in others." src="/img/dog10k-cyp1a2-cohort-copy-number.png" />

The upper lane holds every Golden Retriever, Labrador Retriever and Boxer in the
collection, plus the four wolves from the genotype figure. Every Golden has the
expansion, every Boxer has two copies, and the Labradors split one dog to the
next. Row labels come from the sample column, the order from `domain`.

The four wolves, the control, all have the expansion, so unlike the stop-gained
allele it is shared with wild canids and predates domestication. Their calls
rest on callset depth alone, since none of the dogs with published reads is a
wolf.

The white stripes through both lanes are windows with no call. A window whose
median across the whole collection is not two copies measures a quirk of the
reference, so the build script drops it from every row. The widest stripe sits
on a CpG island: high GC lowers read depth in every canid, and each 5 kb window
spreads that over the blocks around it.

The lower lane is the same estimate over every canid, clustered on each animal's
profile across the window with **Clustering → Cluster rows by similarity** in
the track menu, or `runClustering`. Clustering groups animals whose expansion
starts and ends in the same place, and the blocks on either side of the gene are
deletion polymorphisms.

The depth-based estimate puts far more of the collection at three or more copies
than the paper reports, and the two depth sources agree too closely for the gap
to be noise. The two counts cover different intervals: the paper ran QuicK-mer2
over an element whose extent is unpublished, and the build script counts the
windows the collection puts above two.

## Reproduce it end to end

[`build_dog10k_cyp1a2.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_cyp1a2.sh)
runs every step:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_cyp1a2.sh
bash build_dog10k_cyp1a2.sh   # writes ./dog10k_cyp1a2_build/
```

The script derives the stop codon's position from the reference, builds the
sample list from the Dog10K sample table, slices the gene out of the callset,
prints the genotypes at the stop so you can check the figure against the data,
then genotypes that one site over all 1,987 canids for the breed and wild-canid
counts quoted above.

[`build_dog10k_cyp1a2_cn.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_cyp1a2_cn.sh)
builds the copy-number tracks. It:

1. reads depth over the gene and the sequence around it from each of the 15
   published CRAMs, counting only positions RepeatMasker leaves unmasked, the
   same restriction QuicK-mer2's unique k-mers make
2. scales each window against that dog's own flanks, taken as two copies, and
   prints each dog's copy number over the element beside the spread of its
   flanks around two
3. takes the same ratio from the callset's per-sample depth for every canid, and
   prints how closely it agrees with the CRAM estimate in the 15 dogs
4. drops any flanking window whose median across the animals is off two, rounds
   the rest to whole copies, and writes one painted row per animal

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_cyp1a2_cn.sh
bash build_dog10k_cyp1a2_cn.sh   # writes ./dog10k_cyp1a2_cn_build/
```

## See also

- [](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/local_ancestry)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## Citations

- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
- Court (2013).
  [Canine cytochrome P450 pharmacogenetics](https://doi.org/10.1016/j.cvsm.2013.05.001)
