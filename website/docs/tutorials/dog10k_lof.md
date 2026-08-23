---
title: A loss-of-function allele across breeds (Dog10K)
sidebar_label: Loss-of-function allele (Dog10K)
description:
  Locate a nonsense variant from the reference sequence, then read its genotypes
  across dog breeds and wolves
guide_category: Tutorials
tutorial_category: Population genomics
data: pipeline
---

**TL;DR:** derive a stop-gained variant's coordinate by translating the
reference CDS, slice that gene out of the 397 GB Dog10K SNV callset over HTTP,
and read the genotypes across breeds with the wild canids as the control.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4,
  see the [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)
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

## The CYP1A2 nonsense variant

_CYP1A2_ is a drug-metabolizing cytochrome P450 in which dogs carry a nonsense
variant. This tutorial draws one half of the Dog10K paper's figure for the gene:
the truncating variant and who carries it.

The consequence is recessive: liver microsomes from dogs homozygous for the
truncating allele carry no CYP1A2 protein and those dogs are poor metabolizers
of drugs the enzyme clears, while heterozygotes express it normally
([Mise et al. 2004](https://pubmed.ncbi.nlm.nih.gov/15564884/)).

The questions are which breeds carry it and whether it is present in wild
canids, which are the control: an allele shared with wolves predates
domestication.

## Deriving the variant's coordinate

The literature names this variant by its protein consequence, p.Arg373Ter, which
is enough to locate it against whichever assembly is in use.

The build script rebuilds _CYP1A2_'s coding sequence from the reference and the
RefSeq exon structure, translates it, and reports codon 373:

```
NM_001008720.1 CDS 1539 bp, 513 aa
codon 373 = CGA (R) at chr30:38261635
C>T at that first base makes TGA, a stop
```

`CGA` to `TGA` is one substitution and it is a stop codon, so a C>T at
chr30:38,261,635 truncates the protein at 373 of 513 residues. Checking the
callset at exactly that position finds it, at 4.4% allele frequency and passing
every filter:

```bash
bcftools query -r chr30:38261635-38261636 -f '%POS\t%REF\t%ALT\t%FILTER\t%AC\t%AN\n' \
  "$SNVS"
# chr30  38261635  C  T  PASS  174  3974
```

## Slicing the gene out of the callset

The Dog10K SNV callset is a single 397 GB VCF over 1,987 canids, with a tabix
index beside it, so one gene reads straight out of it:

<!-- from: scripts/build_dog10k_cyp1a2.sh -->

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
bcftools view -r chr30:38258000-38265000 -S cyp.samples --force-samples \
  -Oz -o dog10k_cyp1a2_snvs.vcf.gz "$SNVS"
tabix -p vcf dog10k_cyp1a2_snvs.vcf.gz
```

That is 490 SNVs across the gene for the chosen samples, in a few seconds.
`cyp.samples` holds breeds that carry the allele, two that do not, and four
Greek gray wolves.

## Loading the slice with breed labels

An SNV VCF goes in as an ordinary `VariantTrack`, and the work is in what gets
attached to the rows afterwards:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_cyp1a2_snvs",
  "name": "Dog10K SNVs at CYP1A2",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_cyp1a2_snvs.vcf.gz"
  }
}
```

The display draws one row per sample, and the rows keep the Dog10K IDs, which
say nothing to a reader. Two mechanisms relabel them without touching the VCF: a
`layout` array for named animals ([](/docs/tutorials/dog10k_svs)), or a
`samplesTsvLocation` for a panel too large to write one entry each for
([Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection)).

A SNV is one base wide however far you zoom out, so a whole-gene view of 490 of
them is a field of ticks. Zoom to the codon: at base level each sample's call is
a block, and the gene track still shows which exon it sits in.

## Reading the CYP1A2 genotypes

<Figure caption="The CYP1A2 stop-gained variant at base level: the reference sequence and its translation, the site as an ordinary variant lane, then one row per dog. Five breeds carry it; the Labrador Retrievers, Boxers and all four wolves are homozygous reference." src="/img/dog10k-cyp1a2-nonsense.png" />

The build script genotypes the same site over every canid in the callset. Dozens
of breeds carry the allele and it reaches homozygosity in several: among the
dogs sampled here, no German Hound and no Shetland Sheepdog is homozygous
reference. It is absent from every wolf and every coyote in the collection.

Three neighbours sit inside the same 101 bp, and the display filters them out:

```json
{
  "type": "VariantTrack",
  "trackId": "dog10k_cyp1a2_snvs",
  "name": "Dog10K SNVs at CYP1A2",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_cyp1a2_snvs.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "dog10k_cyp1a2_snvs-LinearMultiSampleVariantDisplay",
      "jexlFilters": ["feature.start == 38261634"]
    }
  ]
}
```

Drop the filter to see them. Two are reference in every animal of this panel,
including the one at the same codon's second base, so each draws an empty
column. The third sits 15 bp along, and every wolf here carries it.

## Copy number at CYP1A2

The paper reports half the collection at three or more copies of _CYP1A2_, which
is the other half of its figure. Those copy-number estimates were never
published, and the SNV callset already carries a per-sample `DP` at every site,
so one tabix slice of it, stripped to the depth field, covers every canid in the
collection:

<!-- from: scripts/build_dog10k_cyp1a2_cn.sh -->

```bash
# -r reads only the locus over HTTP; -x drops everything but FORMAT/DP, which
# is what keeps a 397 GB callset to a slice
bcftools view -r chr30:38205000-38400000 -Ou "$SNVS" |
  bcftools annotate -x 'INFO,^FORMAT/DP' -Oz -o dp.vcf.gz
bcftools query -l dp.vcf.gz > cohort.samples
bcftools query -f '%POS[\t%DP]\n' dp.vcf.gz > cohort.dp
```

Depth is converted to copy number by comparison within each dog. The sequence
around the element in that same dog is copy number two, so it serves as the
denominator:

```
CN = 2 * depth over the element / depth over the sequence around it
```

No copy-number caller is involved, and the check is built in: that surrounding
sequence has to come back out at two.

Each window is 5 kb of depth stepped by 1 kb, so a call rests on 5 kb of
evidence and is painted at 1 kb resolution.

Callset depth is taken only where a variant was called, so the build script
validates it against the 15 CRAMs the Dog10K share publishes: over the shared
windows the two agree at r = 0.92 with no bias. That painting is in the config
as `dog10k_cyp1a2_cn`.

Two lanes read below, each window colored by its rounded call with grey being
two copies: named animals above, then all 1,987 canids clustered on their
profiles.

<Figure caption="Copy number over CYP1A2 and 185 kb around it, named animals above and the whole collection below. The expansion is a breed-level fact in some breeds and segregates one dog to the next in others." src="/img/dog10k-cyp1a2-cohort-copy-number.png" />

The upper lane is whole groups: every Golden Retriever, Labrador Retriever and
Boxer in the collection, plus the four wolves the figure above draws. Every
Golden carries the expansion, every Boxer carries two copies, and the Labradors
split one dog to the next. Row labels come from the sample column, the order
from `rowOrder`. The wolves rest on callset depth alone, since none of the dogs
with published reads is a wolf.

The white stripes through both lanes are windows with no call. A window whose
median across the whole collection is not two is measuring the reference, so the
build script drops it from every row. The widest one has its cause on the CpG
island lane: high GC means low read depth in every canid, and a 5 kb window
carries that over the blocks around it.

The lower lane is the same estimate over every canid, clustered on the profile
each one carries across the window: **Clustering → Cluster rows by similarity**
in the track menu, or `runClustering`. That groups on extents, so animals whose
expansion starts and ends in the same place land together, and the blocks either
side of the gene are the deletion polymorphisms there.

One number does not reproduce: this estimate puts far more of the collection at
three or more copies than the paper reports, and the two depth sources agree too
closely for that to be noise. The difference is which interval is counted:
QuicK-mer2 over an element whose extent was never published, against the windows
the collection itself puts above two.

## Reproduce it end to end

[`build_dog10k_cyp1a2.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_cyp1a2.sh)
runs every step:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_cyp1a2.sh
bash build_dog10k_cyp1a2.sh   # writes ./dog10k_cyp1a2_build/
```

It derives the stop codon's position from the reference, builds the sample list
from the Dog10K sample table, slices the gene out of the callset, prints the
genotypes at the stop so you can check the figure against the data, then
genotypes that one site over all 1,987 canids for the breed and wild-canid
counts quoted above.

[`build_dog10k_cyp1a2_cn.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_cyp1a2_cn.sh)
builds the copy-number tracks:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_cyp1a2_cn.sh
bash build_dog10k_cyp1a2_cn.sh   # writes ./dog10k_cyp1a2_cn_build/
```

It reads depth over this gene straight out of each published CRAM, paints the 15
dogs, then slices the callset's own depth field and paints the other 1,972. It
prints each dog's copy number over the element beside the spread of the sequence
around it, and the agreement between the two measurements.

## See also

- [](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/local_ancestry)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
- Court (2013).
  [Canine cytochrome P450 pharmacogenetics](https://doi.org/10.1016/j.cvsm.2013.05.001)
