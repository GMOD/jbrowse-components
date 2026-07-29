---
title: A loss-of-function allele across breeds (Dog10K)
sidebar_label: Loss-of-function allele (Dog10K)
description:
  Locate a nonsense variant from the reference sequence, then read its genotypes
  across dog breeds and wolves
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** derive a stop-gained variant's coordinate by translating the
reference CDS, slice that gene out of the 397 GB Dog10K SNV callset over HTTP,
and read the genotypes across breeds with the wild canids as the control.

## Prerequisites

The figure has an "Open this view in JBrowse ↗" link that loads the finished
tracks, so reading needs only a browser. To build the track yourself:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4)
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

## The gene and the question

_CYP1A2_ is a cytochrome P450 that metabolizes a long list of drugs, and dogs
carry a nonsense variant in it. The Dog10K paper puts the gene under a
microscope, with panels for copy number, every SNV across it, and mammalian
constraint scores. The part reproducible from the published callset, and the
part that matters clinically, is the single truncating variant and who carries
it.

A loss-of-function allele that reaches appreciable frequency is worth asking two
questions about. Which breeds carry it, and is it in wild canids? The second is
the control: a dog-only allele arose after domestication, while one shared with
wolves did not.

## Finding the variant without looking up its coordinate

The literature names this variant by its protein consequence, p.Arg373Ter. That
is enough to find it, and deriving it beats copying a coordinate from a paper
because it can be re-checked against the assembly you are actually using.

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

The multi-sample variant display draws one row per sample. As in the other
Dog10K tutorials, the VCF keeps its own sample IDs and the display's `layout`
supplies the reading labels and a per-group swatch:

```json
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

One framing note that decides whether the figure works. A SNV is one base wide
however far you zoom out, so a whole-gene view of 490 of them is a field of
ticks in which the interesting one is invisible. Zoom to the codon instead: at
base level each sample's call is a block, and the gene track still shows which
exon it sits in.

## Reading it

<Figure caption="The CYP1A2 stop-gained variant at base level, one row per dog. The highlighted column is codon 373, where C>T makes TGA: German Hounds, Bohemian Shepherds, Shetland Sheepdogs, Black Russian Terriers, and Keeshonds carry it heterozygous (light blue) or homozygous (dark blue), while the Labrador Retrievers, Boxers, and all four wolves are homozygous reference. The variant to its right shows a different pattern, including a wolf carrier." src="/img/dog10k-cyp1a2-nonsense.png" />

The allele is carried by 76 of the collection's breeds and reaches homozygosity
in several: among the dogs sampled here, no German Hound and no Shetland
Sheepdog is homozygous reference. It is absent from all 63 wolves and all four
coyotes in the collection, which is the answer to the second question. The
allele arose in dogs.

The variant a little to the right is the useful contrast. It has its own,
different distribution across these breeds and one of the wolves carries it, so
"tracks breed structure" is a property of a particular variant rather than of
the locus.

## Reproduce it end to end

[`build_dog10k_cyp1a2.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_cyp1a2.sh)
runs every step:

```bash
bash scripts/build_dog10k_cyp1a2.sh   # writes ./dog10k_cyp1a2_build/
```

It derives the stop codon's position from the reference, builds the sample list
from the Dog10K sample table, slices the gene out of the callset, and prints the
genotypes at the stop so you can check the figure against the data.

## See also

- [Structural variants (Dog10K)](/docs/tutorials/dog10k_svs) and
  [Local ancestry (Dog10K)](/docs/tutorials/local_ancestry), the other two
  Dog10K tutorials, on the same assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

Meadows, J. R. S., Kidd, J. M., Wang, G.-D., et al. (2023).
[Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7).
_Genome Biology_, _24_(1), 187.

Court, M. H. (2013).
[Canine cytochrome P450 pharmacogenetics](https://doi.org/10.1016/j.cvsm.2013.05.001).
_Veterinary Clinics of North America: Small Animal Practice_, _43_(5),
1027-1038.
