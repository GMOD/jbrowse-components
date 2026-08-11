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
- `samtools` built with libcurl, for the copy-number section

On Debian/Ubuntu, `apt install bcftools samtools tabix curl python3` covers it.
The packaged `bcftools` and `samtools` are linked against libcurl, so both can
read the remote callset and CRAMs. Everything the scripts write is a local file,
so [JBrowse Desktop](/docs/quickstart_desktop) opens the result by path with no
web server; on JBrowse Web the same files go in through **Add track** or a
`config.json`.

## The gene and the question

_CYP1A2_ is a drug-metabolizing cytochrome P450 in which dogs carry a nonsense
variant. This tutorial reproduces the part of the Dog10K paper's figure that the
published callset supports: the truncating variant and who carries it.

The consequence is recessive, which is why the two shades of blue in the figure
mean different things: liver microsomes from dogs homozygous for the truncating
allele carry no CYP1A2 protein and those dogs are poor metabolizers of drugs the
enzyme clears, while heterozygotes express it normally
([Mise et al. 2004](https://pubmed.ncbi.nlm.nih.gov/15564884/)).

For a loss-of-function allele at appreciable frequency, the questions are which
breeds carry it and whether it is present in wild canids. The wild canids are
the control: a dog-only allele arose after domestication, while one shared with
wolves did not.

## Finding the variant without looking up its coordinate

The literature names this variant by its protein consequence, p.Arg373Ter, which
is enough to locate it. Deriving the coordinate rather than copying it from a
paper lets it be re-checked against the assembly in use.

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
index beside it. That size is irrelevant to reading one gene:

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
bcftools view -r chr30:38258000-38265000 -S cyp.samples --force-samples \
  -Oz -o dog10k_cyp1a2_snvs.vcf.gz "$SNVS"
tabix -p vcf dog10k_cyp1a2_snvs.vcf.gz
```

That is 490 SNVs across the gene for the chosen samples, in a few seconds.
`cyp.samples` holds breeds that carry the allele, two that do not, and four
Greek gray wolves.

## Loading it with breed labels

Nothing about the track config is special to this dataset; an SNV VCF goes in as
an ordinary `VariantTrack`, and the work is all in what gets attached to the
rows afterwards:

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
say nothing to a reader. Either mechanism relabels them without touching the
VCF: a `layout` array for named animals ([](/docs/tutorials/dog10k_svs)), or a
`samplesTsvLocation` for a panel too large to write one entry each for
([Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection)).

Framing matters here. A SNV is one base wide however far you zoom out, so a
whole-gene view of 490 of them is a field of ticks in which the interesting one
is invisible. Zoom to the codon instead: at base level each sample's call is a
block, and the gene track still shows which exon it sits in.

## Reading it

<Figure caption="The CYP1A2 stop-gained variant at base level: the reference sequence and its translation, the site itself as an ordinary variant lane (C → T), then one row per dog. Five breeds carry it heterozygous (light blue) or homozygous (dark blue); the Labrador Retrievers, Boxers, and all four wolves are homozygous reference." src="/img/dog10k-cyp1a2-nonsense.png" />

The build script genotypes the same site over every canid in the callset. The
allele is carried by 74 of the collection's 324 breeds and reaches homozygosity
in several: among the dogs sampled here, no German Hound and no Shetland
Sheepdog is homozygous reference. It is absent from all 63 wolves and all four
coyotes, which is the answer to the second question. The allele arose in dogs.

Two neighbours sit inside the same 101 bp, and the display filters them out:

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

Drop the filter to see them as a contrast. One is the same codon's second base.
The other has its own distribution across these breeds, with one of the wolves
carrying it, so tracking breed structure is a property of a particular variant
rather than of the locus. The figure shows a single column because three
unlabelled columns in one frame invite reading that wolf as a counterexample to
the stop-gained allele.

## The gene is also copy-number variable

The paper reports half the collection at three or more copies of _CYP1A2_, which
is the other half of its figure and the reason a genotype at this locus is
harder to read than it looks. Those copy-number estimates were never published,
but they do not have to be: the SNV callset already carries a per-sample `DP` at
every site, so one tabix slice of it, stripped to the depth field, covers every
canid in the collection.

Depth is converted to copy number by comparison within each dog. That dog's own
flanking sequence is copy number two, so it serves as the denominator:

```
CN = 2 * depth over the element / depth over that dog's flanks
```

This needs no copy-number caller, and it carries its own check: the flanks have
to come back out at two.

Each window is 5 kb of depth stepped by 1 kb, so a call rests on 5 kb of
evidence and is painted at 1 kb resolution. A narrower window would buy that
resolution by speckling the baseline, which sliding a wide one avoids.

Callset depth is a different measurement from read depth, taken only where a
variant was called, so the build script validates it rather than assuming. The
Dog10K share also publishes 15 CRAMs, and running the same ratio over their
reads gives an independent estimate for those dogs; over the shared windows the
two agree at r = 0.92 with no bias. That painting is in the config as
`dog10k_cyp1a2_cn` if you want to add it, but it is not shown here: which 15
dogs have CRAMs is an accident of what the share published, so the picture
invites a question about those breeds that the data cannot answer.

Two lanes read below, each window colored by its rounded call with grey being
two copies: named animals above, then all 1,987 canids clustered on their
profiles.

<Figure caption="Copy number over CYP1A2 and 185 kb around it, named animals above and the whole collection below. The expansion is a breed-level fact in some breeds and segregates one dog to the next in others." src="/img/dog10k-cyp1a2-cohort-copy-number.png" />

The upper lane is whole groups, not picked animals: every Golden Retriever,
Labrador Retriever and Boxer in the collection, plus the four wolves the figure
above draws. Every Golden carries the expansion, every Boxer carries two copies,
and the Labradors split one dog to the next. Row labels come from the sample
column, the order from `rowOrder`. The wolves rest on callset depth alone, since
none of the dogs with published reads is a wolf.

The white stripes through both lanes are windows with no call, not gaps in the
rendering. A window whose median across the whole collection is not two is
measuring the reference rather than any dog, so the build script drops it from
every row instead of painting it grey, which would claim a copy number that was
never measured. The widest one has its cause on the CpG island lane: high GC
means low read depth in every canid, and a 5 kb window carries that over the
blocks around it.

The lower lane is the same estimate over every canid, clustered on the profile
each one carries across the window rather than sorted on one column: **Cluster
rows by similarity** in the track menu, or `runClustering`. What that groups is
extents, so animals whose expansion starts and ends in the same place land
together, and the blocks either side of the gene are the deletion polymorphisms
in the flanking sequence.

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
prints each dog's copy number over the element beside the spread of its flanks,
and the agreement between the two measurements, so both figures can be checked
against the numbers that produced them.

## See also

- [](/docs/tutorials/dog10k_svs),
  [Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection) and
  [](/docs/tutorials/local_ancestry), the other Dog10K tutorials, on the same
  assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
- Court (2013).
  [Canine cytochrome P450 pharmacogenetics](https://doi.org/10.1016/j.cvsm.2013.05.001)
