---
title: A selected haplotype (Dog10K)
sidebar_label: Selected haplotype (Dog10K)
description:
  Slice one locus out of the Dog10K SNV callset for breeds at both ends of a
  trait and cluster the genotype matrix
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** slice a few hundred kb of the 397 GB Dog10K SNV callset over HTTP for
every animal of fourteen toy breeds and eleven giant breeds, load it as a
multi-sample variant track with a sample-metadata TSV, and cluster the rows.

## Prerequisites

The figure has an "Open this view in JBrowse ↗" link that loads the finished
track, so reading needs only a browser. To build it yourself:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all this track needs, see the
  [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3` covers it. The
packaged `bcftools` is linked against libcurl, so it can read the remote
callset.

## The locus

_IGF1_ is a major determinant of body size in dogs: small breeds share a
haplotype at the locus that large breeds largely lack
([Sutter et al. 2007](https://doi.org/10.1126/science.1137045)). This tutorial
draws that haplotype per animal rather than as an allele frequency, which shows
how far along the chromosome it extends, which animals depart from their breed,
and where wolves fall.

## Choosing the panel

The panel is every animal of fourteen toy or small breeds, every animal of
eleven giant breeds, and the twelve Greek gray wolves, taken from the Dog10K
sample table by breed name.

The rows are selected on breed rather than on genotype. Rows selected by what
they carry would group by what they carry, so the clustering below would
reproduce the selection rather than test it.

Whole breeds are used rather than a few animals each, because the variation
within a breed is part of the result and several breeds depart from the pattern
one animal at a time.

## Slicing the locus out of the callset

The SNV callset is a single 397 GB VCF over 1,987 canids with a tabix index
beside it. `bcftools` reads only the window:

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
bcftools view -r chr15:41350000-41750000 -S igf1.samples --force-samples \
  -f PASS "$SNVS" \
  | bcftools view -q 0.05:minor -Oz -o dog10k_igf1.vcf.gz
tabix -p vcf dog10k_igf1.vcf.gz
```

The window extends past both ends of _IGF1_ so that the haplotype's boundaries
fall inside the view.

The second `bcftools view` keeps sites that are common within the panel. Most
sites in a callset this size are rare, and a site that is reference in all 167
animals draws an empty column.

## Loading it with sample metadata

The display draws one row per sample. Instead of a `layout` entry per animal,
point the adapter at a TSV whose first column is the sample name and whose other
columns are attributes; the display can then color and order rows by any of
them:

```
name	breed	size
CHIH000005	Chihuahua	Toy/small
STBD000001	Saint Bernard	Giant
CLUPGR000001	Greek gray wolf	Gray wolf
```

`colorBy` names the column that paints the sidebar swatch:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_igf1_haplotype",
  "name": "Dog10K SNVs across IGF1 (toy, giant, wolf)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_igf1.vcf.gz",
    "samplesTsvLocation": { "uri": "dog10k_igf1_samples.tsv" }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "colorBy": "size",
      "height": 760
    }
  ]
}
```

## Clustering the rows

Rows arrive in the VCF's order, which is the order the panel was built in, so
they start out grouped by breed. **Sort/cluster by...** in the track menu
reorders them by genotype similarity and draws a dendrogram in the sidebar.

The clustering reads genotypes only. The swatch is applied afterwards from the
sample table, so the two are independent.

## Reading it

<Figure caption="SNVs across 400 kb at IGF1 as a matrix, one row per canid and one column per variant, clustered by genotype with size class as the sidebar swatch. The upper cluster is the toy and small breeds and the lower one the giant breeds. Even column widths are what make the shared haplotype a solid block rather than speckle; the lines above the rows tie each column back to its position." src="/img/dog10k-igf1-haplotype.png" />

The panel separates into two clusters that correspond to the size classes.

The block's boundaries fall within the window, so its extent can be read against
the gene track above it rather than inferred.

Rows depart from their swatch in both directions: single orange rows sit within
the giant cluster and single blue rows within the small one. The build script
prints the range within each size class alongside its median, so the extent of
that overlap is available as a number.

The wolves form a contiguous band, and it sits within the toy and small side of
the split rather than with the giants. The other two Dog10K tutorials use wild
canids as a control that carries none of the allele under study; here they carry
part of the haplotype, which bears on its origin but does not establish it.

## Where to go next

The Dog10K paper's selection scan (its Fig. 8) lists peaks for five ancestry
components, and the structural-variant paper lists more. Each is a region and a
set of breeds, which is the input this recipe takes: change the region, the
breed lists, and the metadata column.

## Reproduce it end to end

[`build_dog10k_igf1.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_igf1.sh)
runs every step:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_igf1.sh
bash build_dog10k_igf1.sh   # writes ./dog10k_igf1_build/
```

It downloads the Dog10K sample table, derives the breed lists and the metadata
TSV from it, slices the window out of the callset, and reports the alt-allele
dosage per size class over the sites inside _IGF1_ that separate the two dog
classes, so the split can be checked numerically as well as read from the
figure.

## See also

- [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof),
  [SVs (Dog10K)](/docs/tutorials/dog10k_svs) and
  [Local ancestry (Dog10K)](/docs/tutorials/local_ancestry), the other Dog10K
  tutorials, on the same assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

Sutter, N. B., Bustamante, C. D., Chase, K., et al. (2007).
[A single IGF1 allele is a major determinant of small size in dogs](https://doi.org/10.1126/science.1137045).
_Science_, _316_(5821), 112-115.

Meadows, J. R. S., Kidd, J. M., Wang, G.-D., et al. (2023).
[Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7).
_Genome Biology_, _24_(1), 187.
