---
title: A selected haplotype (Dog10K)
sidebar_label: Selected haplotype (Dog10K)
description:
  Scan the Dog10K panel for allele-frequency differences between breeds at both
  ends of a trait, then slice one peak out of the SNV callset and cluster its
  genotype matrix
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** score every window of the Dog10K phased panel for how far apart
fourteen toy breeds and eleven giant breeds sit, draw that as a Manhattan track,
then slice one peak out of the 397 GB SNV callset over HTTP, load it as a
multi-sample variant track with a sample-metadata TSV, and cluster the rows.

## Prerequisites

To build the track:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all this track needs, see the
  [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3` covers it. The
packaged `bcftools` is linked against libcurl, so it can read the remote
callset. Everything the scripts write is a local file, so
[JBrowse Desktop](/docs/quickstart_desktop) opens the result by path with no web
server.

## Scanning for a locus

Body size is the trait, so the two groups are the breeds at its extremes: every
animal of fourteen toy or small breeds against every animal of eleven giant
breeds. Hudson Fst per window over the Dog10K phased imputation panel scores how
far apart their allele frequencies sit, and
[`build_dog10k_size_fst.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_size_fst.sh)
writes one BED line per window.

A Manhattan track expects a `-log10(p)` column, and this file has neither a p
column nor a p-value. `GWASAdapter` takes the column to read as the score
([`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn)) and the transform
to apply to it
([`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform)) as separate
settings, so a differentiation statistic loads with no reshaping. Fst is already
on the scale the plot draws, so only the column has to be named:

```json
{
  "type": "GWASTrack",
  "trackId": "dog10k_size_fst",
  "name": "Fst, toy/small vs giant breeds (200 kb windows)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "GWASAdapter",
    "uri": "dog10k_size_fst.bed.gz",
    "columnNames": ["chrom", "chromStart", "chromEnd", "name", "fst", "sites"],
    "scoreColumn": "fst"
  }
}
```

Opening the assembly without a location shows all of its regions at once, so the
display lays the autosomes out side by side rather than one at a time.

<Figure caption="Top: Fst between the toy/small and giant panels in 200 kb windows across the 38 autosomes, drawn as a Manhattan track, with three body-size genes labelled at the windows they fall in. Bottom: two megabases of chr15 on the same axis, the highlighted band the IGF1 window and the gene track naming what it sits on." src="/img/dog10k-size-fst-scan.png" links="Whole genome=dog10k-size-fst-scan-genome,IGF1 window=dog10k-size-fst-scan-igf1" />

Each point is a window, so a peak names a region rather than a variant, and the
run of high windows on chr10 is one region's worth. At two megabases the same
windows are drawn at their real width, against the neighbours that set the
peak's scale.

The rest of this tutorial takes the _IGF1_ peak rather than the taller one on
chr10, because the next step needs a locus where there is something to draw per
animal: _IGF1_ has a published shared haplotype, and a haplotype is what a
genotype matrix shows.

## The locus

_IGF1_ is a major determinant of body size in dogs: small breeds share a
haplotype at the locus that large breeds largely lack
([Sutter et al. 2007](https://doi.org/10.1126/science.1137045)). Drawing that
haplotype per animal rather than as an allele frequency shows how far along the
chromosome it extends, which animals depart from their breed, and where wolves
fall, none of which a window score carries.

## Choosing the panel

The panel is the two groups the scan compared plus the twelve Greek gray wolves,
taken from the Dog10K sample table by breed name. Rows are selected on breed
rather than on genotype, since rows selected by what they carry would group by
what they carry and the clustering below would reproduce the selection rather
than test it. Whole breeds go in rather than a few animals each, because the
variation within a breed is part of the result and several breeds depart from
the pattern one animal at a time.

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

The panel separates into two clusters that correspond to the size classes, and
the block's boundaries fall within the window, so its extent reads against the
gene track above it rather than being inferred.

Rows depart from their swatch in both directions: single orange rows sit within
the giant cluster and single blue rows within the small one. The build script
prints the range within each size class alongside its median, so the extent of
that overlap is available as a number.

The wolves form a contiguous band, and it sits within the toy and small side of
the split rather than with the giants. The other two Dog10K tutorials use wild
canids as a control that carries none of the allele under study; here they carry
part of the haplotype, which bears on its origin but does not establish it.

## Where to go next

Both halves take the same two inputs, a pair of groups and a region, so any
trait the sample table records can be substituted: change the breed lists and
the scan reports its own peaks, then change the region and the metadata column
to draw one of them. The Dog10K paper's own selection scan (its Fig. 8) lists
peaks for five ancestry components, and the structural-variant paper lists more.

## Reproduce it end to end

Two scripts, in order:

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_dog10k_size_fst.sh
curl -fO $BASE/build_dog10k_igf1.sh
bash build_dog10k_size_fst.sh   # writes ./dog10k_size_fst_build/
bash build_dog10k_igf1.sh       # writes ./dog10k_igf1_build/
```

[`build_dog10k_size_fst.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_size_fst.sh)
downloads the Dog10K sample table, derives the two breed panels from it, streams
one autosome at a time out of the phased panel, and prints the ranked windows so
the peaks the figure labels can be re-derived rather than taken from the
labelling.

[`build_dog10k_igf1.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_igf1.sh)
derives the same panels plus the metadata TSV, slices the _IGF1_ window out of
the callset, and reports the alt-allele dosage per size class over the sites
inside the gene that separate the two dog classes, so the split can be checked
numerically as well as read from the figure.

## See also

- [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof),
  [SVs (Dog10K)](/docs/tutorials/dog10k_svs) and
  [](/docs/tutorials/local_ancestry), the other Dog10K tutorials, on the same
  assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

- Sutter et al. (2007).
  [A single IGF1 allele is a major determinant of small size in dogs](https://doi.org/10.1126/science.1137045)
- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
