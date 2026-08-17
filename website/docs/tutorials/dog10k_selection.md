---
title: A selected haplotype (Dog10K)
sidebar_label: Selected haplotype (Dog10K)
description:
  Scan the Dog10K panel for allele-frequency differences between breeds at both
  ends of a trait, then slice one peak out of the SNV callset and cluster its
  genotype matrix
guide_category: Tutorials
tutorial_category: Population genomics
data: pipeline
---

**TL;DR:** score every window of the Dog10K phased panel for how far apart
fourteen toy breeds and eleven giant breeds sit, draw that as a Manhattan track,
then slice one peak out of the 397 GB SNV callset over HTTP, load it as a
multi-sample variant track with a sample-metadata TSV, and cluster the rows.

## Prerequisites

- nothing to read along. Everything below is for building the track yourself
- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4;
  its `chrom.sizes` is all this track needs, see the
  [assemblies guide](/docs/config_guides/assemblies))
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3` covers it; the
packaged `bcftools` is linked against libcurl, so it can read the remote
callset. The scripts write local files, which
[JBrowse Desktop](/docs/quickstart_desktop) opens by path and JBrowse Web takes
through **Add track**.

## Scanning for a locus

Body size is the trait, so the two groups are the breeds at its extremes: every
animal of fourteen toy or small breeds against every animal of eleven giant
breeds. Hudson Fst
([Hudson et al. 1992](https://doi.org/10.1093/genetics/132.2.583)) per window
over the Dog10K phased imputation panel scores how far apart their allele
frequencies sit, summed as a ratio of averages rather than averaged over sites
([Bhatia et al. 2013](https://doi.org/10.1101/gr.154831.113)), and
[`build_dog10k_size_fst.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_size_fst.sh)
writes one BED line per window.

A Manhattan track expects a `-log10(p)` column, and this file has neither a p
column nor a p-value. `GWASAdapter` takes the column to read as the score
([`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn)) and the transform
to apply to it
([`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform)) as separate
settings, so a differentiation statistic loads with no reshaping. Fst is already
on the scale the plot draws, so only the column has to be named.
[](/docs/tutorials/bxd_qtl) loads a LOD column through the same two slots.

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
  },
  "displayDefaults": {
    "significanceLine": 0.295
  }
}
```

Opening the assembly without a location shows all of its regions at once, so the
display lays the autosomes out side by side rather than one at a time.

<Figure caption="Top: Fst between the toy/small and giant panels in 200 kb windows across the 38 autosomes, three body-size genes labelled, dashed significance line. Bottom: the wedge's span, two megabases of chr15 rebinned to 20 kb, where that point resolves into a sweep sitting on IGF1. The band is the top half's own 200 kb window." src="/img/dog10k-size-fst-scan.png" links="Whole genome=dog10k-size-fst-scan-genome,IGF1 window=dog10k-size-fst-scan-igf1" />

Each point is a window, so a peak names a region rather than a variant. A
genome-wide scan has to bin wide enough to hold down twelve thousand windows'
worth of noise, which is what makes the _IGF1_ peak a single bar up there.

Fst has no p-value, so
[`significanceLine`](/docs/config/linearmanhattandisplay/#slot-significanceline)
draws the threshold this scan is read against, which is a quantile of its own
windows rather than a test: the dashed line is the 99.9th percentile, printed by
the build script alongside the ranked windows. It is a property of these windows
at this size, so rebinning the scan means taking it again. The peaks the figure
labels are the check on the scan rather than its result: the tallest of them, on
chr10, is _HMGA2_, which is one of the six variants
[Rimbault et al. 2013](https://doi.org/10.1101/gr.157339.113) fit to about half
the size variation across breeds.

Each group is a set of closed populations rather than a sample of animals, so
drift inside one large breed scores the same way differentiation across the
contrast does. What a window has behind it is fourteen breeds against eleven,
not eighty-odd dogs against as many.

The lower half is the same panel and the same estimator rebinned to 20 kb over
two megabases, where the peak turns out to have a shape. Rerunning the build
script over one region is all that takes:

```bash
WINDOW=20000 REGIONS=chr15:40600000-42600000 \
  OUTBED=dog10k_size_fst_igf1_20kb.bed \
  bash scripts/build_dog10k_size_fst.sh
```

## The locus

The rest of this tutorial takes the _IGF1_ peak rather than the taller one on
chr10, because the next step needs a locus where there is something to draw per
animal. _IGF1_ is a major determinant of body size in dogs: small breeds share a
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

<!-- from: scripts/build_dog10k_igf1.sh -->

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
they start out grouped by breed. **Clustering → Cluster rows by genotype...** in
the track menu, then **Run clustering**, reorders them by genotype similarity
and draws a dendrogram in the sidebar.

The clustering reads genotypes only. The swatch is applied afterwards from the
sample table, so the two are independent.

## Framing it

In a matrix every record is one column of equal width, so a window's width in
the frame is a count of records rather than a span of chromosome. The build
script prints which sites actually separate the two size classes, a minority of
those in the slice, and this window is that span with a margin of
undifferentiated sequence on each side. Framed on the differentiated sites
alone, every point in the Fst lane is high and nothing says where the signal
starts or stops.

Clustering reads the region on screen, so where you run it matters as much as
what you frame afterwards: over the whole window the separating columns are
diluted by the undifferentiated sites around them. Zoom to the core, cluster
there, then widen back out, and the row order is kept because it orders rows by
name rather than re-deriving from what is in view. A session can say that
instead of performing it, since the display takes `clusterRegion` beside
`runClustering`, which is what the figure below does.

<Video src="/media/dog10k/igf1_cluster_route.mp4" caption="The route on the 140 kb core: rows in the panel's build order, the track menu's clustering run, and the same order held when the window widens to the figure below. The size swatch starts as three breed blocks and ends interleaved." />

## Reading it

<Figure caption="SNVs across 320 kb at IGF1 as a matrix, one row per canid and one column per variant, size class as the sidebar swatch, under per-site Fst between the same two panels. Fst is near zero at both window edges and high across the gene." src="/img/dog10k-igf1-haplotype.png" />

Clustering on genotypes alone recovers the size split without being told it, and
the block's boundaries fall within the window, so its extent reads against the
gene track above it rather than being inferred. The recovery is partial rather
than two clean bands: the two panels differ here by a shift in allele frequency
rather than by carrying different alleles, so the block is a run of columns
where one class is enriched rather than a solid slab.

The lane between them says which columns are doing the work: the same Hudson Fst
as the genome scan, between the same two panels, computed one site at a time
over this VCF rather than in 200 kb windows. Every point is one column of the
matrix, though not the column directly beneath it, since the matrix gives each
record equal width and the Fst lane keeps genomic spacing. The sloped lines
between the two are the display tying each column back to its coordinate. The
scan reads the phased imputation panel and this lane reads the SNV callset, so
the peak is recovered twice off different files rather than redrawn.

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
the callset, scores every site in it with the same estimator the scan uses, and
reports the alt-allele dosage per size class over the sites inside the gene that
separate the two dog classes, so the split can be checked numerically as well as
read from the figure.

## See also

- [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof)
- [SVs (Dog10K)](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/local_ancestry)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/gwas_track)
- [](/docs/config_guides/variant_track)

## References

- Bhatia et al. (2013).
  [Estimating and interpreting FST: the impact of rare variants](https://doi.org/10.1101/gr.154831.113)
- Hudson et al. (1992).
  [Estimation of levels of gene flow from DNA sequence data](https://doi.org/10.1093/genetics/132.2.583)
- Rimbault et al. (2013).
  [Derived variants at six genes explain nearly half of size reduction in dog breeds](https://doi.org/10.1101/gr.157339.113)
- Sutter et al. (2007).
  [A single IGF1 allele is a major determinant of small size in dogs](https://doi.org/10.1126/science.1137045)
- Meadows et al. (2023).
  [Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7)
