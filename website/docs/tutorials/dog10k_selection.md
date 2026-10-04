---
title: A selected haplotype (Dog10K)
sidebar_label: Dog10K (selected haplotype)
description:
  Scan Dog10K dogs and wolves for allele-frequency differences between breeds at
  both ends of a trait, then slice one peak out of the SNV callset and cluster
  its genotype matrix
guide_category: Tutorials
tutorial_category: Population genomics
tutorial_subcategory: Dog10K
---

Dogs differ in body size more than any other mammal, and a haplotype (a stretch
of neighbouring variants inherited together) at the growth-factor gene _IGF1_ is
a major reason. In the Dog10K collection of sequenced dogs and wolves, we scan
every window of the genome for Fst, a 0-to-1 measure of how far apart two
groups' allele frequencies sit, between fourteen toy breeds and eleven giant
breeds, and draw that as a Manhattan track. We then slice the _IGF1_ peak out of
the 397 GB SNV callset over HTTP, load it as a multi-sample variant track with a
sample-metadata TSV, and cluster the animals by genotype to see the haplotype
each size class has and where the wolves fall.

## Prerequisites

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
- the sample table, which the scripts derive the breed groups and the wolf
  outgroup from:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt

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

## Scanning the genome for toy-versus-giant Fst peaks

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
the axis; **Y axis... → Reference lines** adds one to a track already open.

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

<Figure caption="Top: Fst between the toy/small and giant breeds in 200 kb windows across the 38 autosomes, three body-size genes labelled, dashed 99.9th-percentile line. Bottom: the IGF1 region rebinned to 20 kb, where the peak resolves into a sweep. The band marks the 200 kb window from the top half." src="/img/dog10k-size-fst-scan.png" links="Whole genome=dog10k-size-fst-scan-genome,IGF1 window=dog10k-size-fst-scan-igf1" />

The genome-wide scan uses wide bins to keep the noise across thousands of
windows down, so the _IGF1_ peak is a single bar.

Fst has no p-value, so the cutoff is a
[reference line](/docs/config/valuescale/#slot-scalesyrules) at the 99.9th
percentile of the scan's windows, which the build script prints beside the
ranked windows. The percentile depends on the window size, so a rebinned scan
needs a new one. The tallest labelled peak, on chr10, is _HMGA2_, one of the six
variants [Rimbault et al. 2013](https://doi.org/10.1101/gr.157339.113) fit to
about half the size variation across breeds.

Breeds are closed populations, so drift (random change in allele frequency)
inside one large breed raises Fst just as differentiation between the groups
does. Pooling fourteen breeds against eleven dilutes drift in any one breed.

## The IGF1 body-size locus

The rest of this tutorial takes the _IGF1_ peak. _IGF1_ is a major determinant
of body size in dogs: small breeds share a haplotype at the locus that large
breeds largely lack
([Sutter et al. 2007](https://doi.org/10.1126/science.1137045)). Drawn per
animal, that haplotype shows how far along the chromosome it extends, which
animals depart from their breed, and where the wolves fall.

## Choosing the toy, giant and wolf samples

The samples are the two groups the scan compared plus the twelve Greek gray
wolves, taken from the Dog10K sample table by breed name. They include whole
breeds, because several breeds depart from the pattern one animal at a time and
the clustering below has to show that variation.

## Slicing the IGF1 window out of the SNV callset

The SNV callset is a single 397 GB VCF over 1,987 canids with a tabix index
beside it. `bcftools` reads only the window:

<!-- from: scripts/build_dog10k_igf1.sh -->

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
# --force-samples: proceed even if a name in igf1.samples isn't in the VCF's
# sample list, instead of exiting
# -f PASS: keep only sites that passed every quality filter
# -q 0.05:minor (second pass): drop sites where the minor allele is under 5%
# frequency in these samples, since most sites in a callset this size are rare
bcftools view -r chr15:41350000-41750000 -S igf1.samples --force-samples \
  -f PASS "$SNVS" \
  | bcftools view -q 0.05:minor -Oz -o dog10k_igf1.vcf.gz
tabix -p vcf dog10k_igf1.vcf.gz
```

The window extends past both ends of _IGF1_ so that the haplotype's boundaries
fall inside the view.

The second `bcftools view` keeps sites that are common within these samples,
since a site that is reference in all 167 animals draws an empty column.

## Loading the IGF1 slice with a sample-metadata TSV

The display draws one row per sample. For this many samples, point the adapter
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

## Framing the IGF1 window on the separating sites

The variant display gives every record a column of equal width, so the view's
width counts records. The build script prints which sites separate the two size
classes. Frame the view on that span with a margin of undifferentiated sequence
on each side, as `chr15:41,348,000-41,752,000` in the session below does, and
the Fst track in the figure further down falls back over the margin.

## Clustering the IGF1 rows by genotype

Rows arrive in the VCF's order, which is the order the sample list was built in,
so they start out grouped by breed. Clustering reads the region on screen, and
over the whole window the undifferentiated sites dilute the separating columns,
so zoom to the core first. The core here is the 140 kb at
`chr15:41,440,000-41,580,000`. **Clustering → Cluster rows by genotype...** in
the track menu, then **Run clustering**, reorders the rows by genotype
similarity and draws a dendrogram in the sidebar. Then widen back out to see how
far the block runs.

The display applies the swatch from the sample table after clustering, so the
order comes from genotypes alone.

A session can set the region directly with `clusterRegion` beside
`runClustering`, as the figure below does:

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

<Video src="/media/dog10k/igf1_cluster_route.mp4" caption="Rows in build order, then the track menu's clustering run over the peak's differentiated core, which gathers the size classes into blocks on genotype alone. Widened back out, the small breeds share one haplotype across IGF1 that most giants lack." />

## The IGF1 haplotype block in toy, giant and wolf genotypes

<Figure caption="SNVs across IGF1 as a matrix, one row per canid and one column per variant, size class as the sidebar swatch, under per-site Fst between the same two size classes. Fst is near zero at both window edges and high across the gene." src="/img/dog10k-igf1-haplotype.png" />

Clustering on genotypes alone recovers the size split. The block's boundaries
fall within the window, so the gene track above shows its extent. The size
classes differ here by a shift in allele frequency, so the block is a run of
columns where one class is enriched.

The Fst track above the matrix shows which columns separate the classes: the
same Hudson Fst as the genome scan, between the same two size classes, computed
one site at a time over this VCF, with one point per matrix column. The matrix
gives each record equal width and the Fst track keeps genomic spacing, so the
sloped lines between them tie each column to its coordinate. The genome scan
reads the phased imputation panel and this track reads the SNV callset, so the
peak appears in two different files.

The build script writes the Fst track as `dog10k_igf1_fst.bed.gz`. It loads like
the genome scan, as a `GWASTrack` whose `GWASAdapter` takes `scoreColumn` `fst`
and `columnNames` `chrom`, `chromStart`, `chromEnd`, `name`, `fst`,
`freqToySmall`, `freqGiant`.

Rows depart from their size-class color in both directions: single orange rows
sit within the giant cluster and single blue rows within the small one.

The wolves form a contiguous band of their own directly below the toy and small
block, and carry part of its haplotype.

## Scanning for peaks in another trait

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
   slices the _IGF1_ window for those samples and scores each site with the
   scan's estimator.

Both take their breed groups from the Dog10K sample table by breed name, so
genotype plays no part in who sits in which class.

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

## Citations

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
