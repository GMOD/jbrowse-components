---
title: A selected haplotype (Dog10K)
sidebar_label: Selected haplotype (Dog10K)
description:
  Scan the Dog10K panel for allele-frequency differences between breeds at both
  ends of a trait, then slice one peak out of the SNV callset and cluster its
  genotype matrix
guide_category: Tutorials
tutorial_category: Population genomics
tutorial_subcategory: Dog10K
---

Score every window of the Dog10K phased panel for how far apart fourteen toy
breeds and eleven giant breeds sit, draw that as a Manhattan track, then slice
one peak out of the 397 GB SNV callset over HTTP, load it as a multi-sample
variant track with a sample-metadata TSV, and cluster the rows.

## Prerequisites

- nothing to read along. Everything below is for building the track yourself
- the `UU_Cfam_GSD_1.0` dog assembly (UCSC's canFam4) set up in JBrowse. The
  [canFam4 hub on genomes.jbrowse.org](https://genomes.jbrowse.org/ucsc/canFam4/)
  is a config that loads it with its gene and repeat tracks, and the
  [assemblies guide](/docs/config_guides/assemblies) builds one by hand. This
  track reads its `chrom.sizes` alone.
- `bcftools` built with libcurl
- `curl`
- `python3`
- htslib (`tabix`)

On Debian/Ubuntu, `apt install bcftools tabix curl python3` covers it; the
packaged `bcftools` is linked against libcurl, so it can read the remote
callset. The scripts write local files, which
[JBrowse Desktop](/docs/quickstart_desktop) opens by path and JBrowse Web takes
through **Add track**.

## Where the data comes from

The Dog10K consortium's public share
([Meadows et al. 2023](https://doi.org/10.1186/s13059-023-03023-7)), read
directly over HTTP with no local copy of either callset.

- the phased imputation panel, scored window by window for the Fst scan:
  https://kiddlabshare.med.umich.edu/dog10K/phased-imputation-panel/AutoAndXPAR.Dog10K.phased.bcf
- the SNV/indel callset the _IGF1_ window is sliced from:
  https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
- the sample table, which the scripts derive the breed panels and the wolf
  outgroup from:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt

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

## Scanning for a locus

Body size is the trait, so the two groups are the breeds at its extremes: every
animal of fourteen toy or small breeds against every animal of eleven giant
breeds. Hudson Fst
([Hudson et al. 1992](https://doi.org/10.1093/genetics/132.2.583)) per window
over the Dog10K phased imputation panel scores how far apart their allele
frequencies sit, summed as a ratio of averages
([Bhatia et al. 2013](https://doi.org/10.1101/gr.154831.113)), and
[`build_dog10k_size_fst.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_size_fst.sh)
writes one BED line per window.

A Manhattan track expects a `-log10(p)` column, and this file has an Fst column.
`GWASAdapter` takes the column to read as the score
([`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn)) and the transform
to apply to it
([`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform)) as separate
settings, so naming the column is enough: Fst is already on the scale the plot
draws. [](/docs/tutorials/bxd_qtl) loads a LOD column through the same two
slots.

```json addtrack
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
    "scales": {
      "y": {
        "title": "Hudson Fst",
        "rules": [
          {
            "value": 0.295,
            "color": "rgb(200,60,60)",
            "label": "99.9th percentile"
          }
        ]
      }
    }
  }
}
```

Opening the assembly with no location shows all of its regions at once, so the
display lays the autosomes out side by side. The red line is a reference line on
the axis; **Score → Reference lines...** adds one to a track already open.

Rerunning the same script over one region rebins it, which is the lower half of
the figure below: the same panel and the same estimator at 20 kb over two
megabases, where the peak resolves into a sweep. `WINDOW` is the bin width,
`REGIONS` any `bcftools -r` target, and `OUTBED` the output name:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_size_fst.sh
WINDOW=20000 REGIONS=chr15:40600000-42600000 \
  OUTBED=dog10k_size_fst_igf1_20kb.bed \
  bash build_dog10k_size_fst.sh
```

<Figure caption="Top: Fst between the toy/small and giant panels in 200 kb windows across the 38 autosomes, three body-size genes labelled, dashed significance line. Bottom: the wedge's span, two megabases of chr15 rebinned to 20 kb, where that point resolves into a sweep sitting on IGF1. The band marks the 200 kb window from the top half." src="/img/dog10k-size-fst-scan.png" links="Whole genome=dog10k-size-fst-scan-genome,IGF1 window=dog10k-size-fst-scan-igf1" />

Each point is a window, so a peak marks a region. The genome-wide scan uses wide
bins to keep the noise across thousands of windows down, so the _IGF1_ peak is a
single bar.

Fst has no p-value, so the threshold is a
[reference line](/docs/config/valuescale/#slot-scalesyrules) at a quantile of
the scan's windows. The dashed line is the 99.9th percentile, printed by the
build script alongside the ranked windows. The percentile depends on the window
size, so a rebinned scan needs a new one. The tallest labelled peak, on chr10,
is _HMGA2_, one of the six variants
[Rimbault et al. 2013](https://doi.org/10.1101/gr.157339.113) fit to about half
the size variation across breeds.

Each group is a set of closed populations, so drift inside one large breed
scores the same way as differentiation between the groups. Each window pools
fourteen breeds against eleven, which dilutes drift in any one breed.

## The IGF1 body-size locus

The rest of this tutorial takes the _IGF1_ peak. _IGF1_ is a major determinant
of body size in dogs: small breeds share a haplotype at the locus that large
breeds largely lack
([Sutter et al. 2007](https://doi.org/10.1126/science.1137045)). Drawn per
animal, that haplotype shows how far along the chromosome it extends, which
animals depart from their breed, and where the wolves fall.

## Choosing the panel

The panel is the two groups the scan compared plus the twelve Greek gray wolves,
taken from the Dog10K sample table by breed name. It holds whole breeds, because
several breeds depart from the pattern one animal at a time and the clustering
below has to show that variation.

## Slicing the locus out of the callset

The SNV callset is a single 397 GB VCF over 1,987 canids with a tabix index
beside it. `bcftools` reads only the window:

<!-- from: scripts/build_dog10k_igf1.sh -->

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
# --force-samples: proceed even if a name in igf1.samples isn't in the VCF's
# sample list, instead of exiting
# -f PASS: keep only sites that passed every quality filter
# -q 0.05:minor (second pass): drop sites where the minor allele is under 5%
# frequency in this panel, since most sites in a callset this size are rare
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

## Loading the slice with sample metadata

The display draws one row per sample. For a panel this size, point the adapter
at a TSV whose first column is the sample name and whose other columns are
attributes; the display colors and orders rows by any of them:

```text
name	breed	size
CHIH000005	Chihuahua	Toy/small
STBD000001	Saint Bernard	Giant
CLUPGR000001	Greek gray wolf	Gray wolf
```

`rowColor` names the column that paints the sidebar swatch:

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
      "rowColor": "size",
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

Clustering reads the genotypes, and the display applies the swatch afterwards
from the sample table, so the swatch has no effect on the order.

## Framing the window

In a matrix every record is one column of equal width, so a window's width in
the frame is a count of records. The build script prints which sites separate
the two size classes, and this window is that span with a margin of
undifferentiated sequence on each side; the Fst lane comes back down over that
margin.

Clustering reads the region on screen, and over the whole window the
undifferentiated sites dilute the separating columns. Zoom to the core, cluster
there, then widen back out to see how far the block runs. A session can set the
region directly with `clusterRegion` beside `runClustering`, as the figure below
does. The core here is the 140 kb at `chr15:41,440,000-41,580,000`:

```json session
{
  "defaultSession": {
    "name": "IGF1 haplotypes",
    "views": [
      {
        "id": "igf1_lgv",
        "type": "LinearGenomeView",
        "assembly": "UU_Cfam_GSD_1.0",
        "loc": "chr15:41,348,000-41,752,000",
        "tracks": [
          {
            "type": "VariantTrack",
            "configuration": "dog10k_igf1_haplotype",
            "displays": [
              {
                "type": "LinearMultiSampleVariantDisplay",
                "configuration": "dog10k_igf1_haplotype-LinearMultiSampleVariantDisplay",
                "runClustering": true,
                "clusterRegion": "chr15:41,440,000-41,580,000"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

<Video src="/media/dog10k/igf1_cluster_route.mp4" caption="The route on the differentiated core: rows in the panel's build order, then the track menu's clustering run, which gathers the size classes into blocks on genotype alone. Widened back out, the small breeds share one haplotype across IGF1 that most giants lack." />

## Reading the IGF1 haplotype block

<Figure caption="SNVs across 320 kb at IGF1 as a matrix, one row per canid and one column per variant, size class as the sidebar swatch, under per-site Fst between the same two panels. Fst is near zero at both window edges and high across the gene." src="/img/dog10k-igf1-haplotype.png" />

Clustering on genotypes alone recovers the size split. The block's boundaries
fall within the window, so the gene track above shows its extent. The two panels
differ here by a shift in allele frequency, so the block is a run of columns
where one class is enriched.

The Fst lane above the matrix shows which columns separate the classes: the same
Hudson Fst as the genome scan, between the same two panels, computed one site at
a time over this VCF. Each point is one column of the matrix. The matrix gives
each record equal width and the Fst lane keeps genomic spacing, so the sloped
lines between them tie each column to its coordinate. The scan reads the phased
imputation panel and this lane reads the SNV callset, so the peak appears in two
different files.

Rows depart from their swatch in both directions: single orange rows sit within
the giant cluster and single blue rows within the small one. The build script
prints the range within each size class alongside its median.

The wolves form a contiguous band, on the toy and small side of the split. They
carry part of the haplotype here, where the stop-gained allele in
[](/docs/tutorials/dog10k_lof) is absent from them.

## Scanning another trait

The Fst scan and the IGF1 slice take the same two inputs, a pair of groups and a
region, so you can substitute any trait the sample table records. Edit the
`SMALL` and `GIANT` breed lists in the script's panel step and rerun it to find
new peaks. Then change `REGIONS` to a peak, slice that window with the
`bcftools` command above, and add a column to the samples TSV to color by. The
Dog10K paper's selection scan (its Fig. 8) lists peaks for five ancestry
components, and the structural-variant paper lists more.

## Reproduce it end to end

Two scripts, in order:

1. [`build_dog10k_size_fst.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_size_fst.sh)
   runs the scan. It corrects each class's allele frequency for its own sample
   size, so the unequal classes do not tilt the score, skips windows with too
   few sites to score, and prints the percentiles behind the reference line.
2. [`build_dog10k_igf1.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_igf1.sh)
   slices the _IGF1_ window for the panel and scores each site with the scan's
   estimator.

Both take their panels from the Dog10K sample table by breed name, so genotype
plays no part in who sits in which class.

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_dog10k_size_fst.sh
curl -fO $BASE/build_dog10k_igf1.sh
bash build_dog10k_size_fst.sh   # writes ./dog10k_size_fst_build/
bash build_dog10k_igf1.sh       # writes ./dog10k_igf1_build/
```

## See also

- [](/docs/tutorials/dog10k_lof)
- [](/docs/tutorials/dog10k_svs)
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
