---
title: Structural variants (Dog10K)
sidebar_label: SVs (Dog10K)
description:
  Genotype a published structural variant across dog breeds and read it against
  the gene it sits in
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** slice one locus out of the 5.9 GB Dog10K structural-variant genotype
VCF over HTTP, load it as a `VariantTrack` in the multi-sample variant display
with breed labels, and read a deletion's genotype across breeds against the gene
model above it.

## Prerequisites

The figure has an "Open this view in JBrowse ↗" link that loads the finished
tracks, so reading needs only a browser. To build the track yourself:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4)
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

## The variant

Schall and Kidd genotyped long-read-discovered structural variants across the
Dog10K collection and flagged those whose allele frequencies track breed clades.
One is a 7.8 kb deletion in an intron of _NHEJ1_, the variant associated with
Collie eye anomaly. If it is what the literature says, it should be common in
Collies and their relatives and absent from unrelated breeds and from wolves.

## Slicing one locus out of the callset

The genotype VCF is 5.9 GB across 1,879 dogs and wolves, published on
[Zenodo](https://doi.org/10.5281/zenodo.14968873) with a tabix index. Nothing
needs downloading in full: `bcftools` fetches only the locus. Zenodo serves the
data and index from separate content URLs, so the index is named explicitly
rather than guessed from the data URL:

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

## Loading it with breed labels

An SV VCF loads as an ordinary `VariantTrack`; what makes it readable is the
multi-sample variant display, which draws one row per sample across the
variant's real genomic span, so a 7.8 kb deletion is a 7.8 kb block rather than
a tick.

```json
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

The sample rows keep the Dog10K IDs, which are the data's identity but say
nothing to a reader. The display's `layout` renames them for the sidebar and
gives each group a swatch, without touching the VCF:

```json
{
  "type": "LinearMultiSampleVariantDisplay",
  "layout": [
    { "name": "COLL000001", "label": "Collie 1", "color": "#0072B2" },
    { "name": "CLUPGR000001", "label": "Wolf 1", "color": "#E69F00" }
  ]
}
```

Add the assembly's gene annotation above it. The deletion has to be read against
_NHEJ1_'s exons to be identified as intronic rather than coding.

## Reading it

<Figure caption="A 7.8 kb deletion inside an NHEJ1 intron, genotyped across breeds from the Dog10K structural-variant callset. Every carrier is a Collie-clade breed; the other breeds and the four wolves are homozygous reference." src="/img/dog10k-nhej1-cea-deletion.png" />

The picture matches the literature: the deletion is common in the Collie clade,
homozygous in several animals, and absent everywhere else in this set including
the wolves. Reading the gene model with it shows why a deletion this size can
segregate at this frequency, since it removes intronic sequence rather than
coding exons.

### Why the lane shows one record

The window holds nine SV records, and the figure filters to this one:

```json
{
  "type": "LinearMultiSampleVariantDisplay",
  "jexlFilters": ["jexl:get(feature,'start') == 25574004"]
}
```

The filter is not cosmetic. Unfiltered, a second deletion nested inside the 7.8
kb one paints a band of yellow no-calls against the darkest blue, and the two
records read as one striped block rather than as one deletion.

Those no-calls are not noise. The nested deletion is called reference in every
dog in the panel except four, where it is missing, and those four are exactly
the dogs homozygous for the larger deletion:

```bash
# -i POS=… because -r is END-aware and would also return the deletion this one
# sits inside
bcftools query -r chr37:25578185-25578186 -i 'POS=25578185' \
  -f '[%SAMPLE=%GT ]\n' dog10k_nhej1_svs.vcf.gz \
  | tr ' ' '\n' | grep -v '=0/0'
```

A dog with no copy of the surrounding sequence has no reads there to genotype
the nested call from, so the genotyper returns missing. A SNV callset has no
equivalent structure, so a no-call here should not be read as a failed sample.

### What the panel does not say

Lancashire Heelers are among the breeds Collie eye anomaly is reported in, and
none of the four sampled here carry the deletion. Four dogs is not a frequency
estimate. More broadly, this figure is one locus in one set of breeds, chosen
because the variant was already characterized; the same track scrolled anywhere
else in the callset is a screen of variants nobody has interpreted yet.

## A different kind of variant, at DENR

The deletion above is rare, long, and breed-restricted. Most of what an SV
callset holds is the opposite, and the same slice-and-load recipe shows it two
chromosomes away.

Schall and Kidd report two deletions in adjacent introns of _DENR_ in the
Mastiff clade, each removing a SINEC2A1 repeat with an intact poly(A) tail and
target-site duplications. Both SINEs are present in the `UU_Cfam_GSD_1.0`
reference, which is a German Shepherd, so "deletion" here means the repeat is
absent in that dog. Dimorphic SINE and LINE-1 variants like these make up over
45% of all deletions in the callset, which is why a dog SV panel looks nothing
like a SNV panel.

<Figure caption="Two ~220 bp SINEC2A1 deletions in adjacent DENR introns. The Mastiff-clade breeds still carry the repeats (grey homozygous reference, light blue heterozygous); the Labrador Retrievers, Collies, and all four wolves are homozygous for the deletion, meaning the repeats are absent. The reference genome, a German Shepherd, carries them." src="/img/dog10k-denr-sine-deletions.png" />

This contrasts with the Collie eye anomaly figure. That deletion was 7.8 kb, at
a few percent frequency, and present only in one clade. These are 220 bp, at
about 90% frequency, and it is the reference that carries the rare allele. The
wolves have no copy of either repeat, which is what the paper means by calling
the insertions recent. Because a callset mixes both kinds, "how many structural
variants does this dog have" depends on which genome you called against.

The shipped slice keeps only these two variants. The locus carries seven others,
one of which overlaps the first SINE, but a per-sample panel of all of them is
unreadable and adds nothing the two do not already show.

## Where to go next

The same recipe reaches every other variant in the callset. Schall and Kidd's
table of clade-associated SVs is the place to pick the next locus.

## Reproduce it end to end

[`build_dog10k_nhej1_sv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_nhej1_sv.sh)
builds the track:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_nhej1_sv.sh
bash build_dog10k_nhej1_sv.sh   # writes ./dog10k_sv_build/
```

It downloads the Dog10K sample table, derives the breed lists from it, slices
the locus out of the Zenodo genotype VCF, and prints the deletion's genotypes so
you can check the figure against the data before trusting either.

## See also

- [Local ancestry (Dog10K)](/docs/tutorials/local_ancestry), the other Dog10K
  tutorial, on the same assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/user_guides/sv_visualization)

## References

Schall, P. Z., and Kidd, J. M. (2025).
[Integrative genotyping and analysis of canine structural variation using long-read and short-read data](https://doi.org/10.1093/gbe/evaf173).
_Genome Biology and Evolution_, _17_(10), evaf173.

Parker, H. G., Kukekova, A. V., Akey, D. T., et al. (2007).
[Breed relationships facilitate fine-mapping studies: a 7.8-kb deletion cosegregates with Collie eye anomaly across multiple dog breeds](https://doi.org/10.1101/gr.6086307).
_Genome Research_, _17_(11), 1562-1571.
