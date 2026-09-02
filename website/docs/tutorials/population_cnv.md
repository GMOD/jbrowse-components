---
title: CNV across a population (1000 Genomes)
description:
  Read k-mer depth copy number for every individual in the 1000 Genomes panel,
  and pack the whole panel into one Zarr store
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** copy number varies from person to person, and we show the whole 1000
Genomes panel at once: one heatmap row per individual, colored by how far that
person strays from the diploid baseline of 2. JBrowse renders that live from
per-sample BigWigs, and past a few hundred samples the per-file requests
dominate, so the second half packs the values into one Zarr store.

## Prerequisites

- a JBrowse instance to paste a track into (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop): every file here is a URL, so
  Desktop needs nothing hosted)
- `node` 24 or newer, to [build a Zarr store](#build-the-store); the converter
  is one downloadable file and pulls its own two npm packages
- QuicK-mer2 and a 30x alignment, to add
  [samples of your own](#your-own-samples)

## Where the data comes from

QuicK-mer2 copy-number estimates over the 30x 1000 Genomes panel, from the Kidd
lab at the University of Michigan
([Shen and Kidd 2020](https://doi.org/10.3390/genes11020141)).

- the sample list across 26 populations, from the lab's UCSC track hub:
  https://raw.githubusercontent.com/KiddLab/kmer_1KG/master/kmer-1kg.trackDb.txt
- the per-sample bigWigs, one individual's copy number in 1 kb bins, re-hosted
  unmodified because the lab's own download share is offline. One file per
  sample under its population, so HG00551 and HG00553 are
  https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00551.qm2.CN.1k.bw
  and
  https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00553.qm2.CN.1k.bw
- the same values packed into one Zarr store for the
  [latency comparison](#scaling-past-one-population). This is a directory of
  chunks rather than a file, so it is the `uri` an adapter takes and not
  something to open in a browser:
  https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr

## The QuicK-mer2 estimates

The [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) estimates come from the
Kidd lab's [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG) track hub;
this page reads the lab's raw per-sample bigWigs. QuicK-mer2 counts only k-mers
that occur exactly once in the reference, so its estimates are per _paralog_.

## Load the panel as one track

The whole panel goes in as one track on hg38, so the display, clustering and
color settings are declared once:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pur_copynumber_1000g",
  "name": "PUR copy number (1000 Genomes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00551.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00553.qm2.CN.1k.bw"
    ]
  },
  "displayDefaults": {
    "defaultRendering": "multirowdensity",
    "bicolorPivot": 2,
    "minScore": 0,
    "maxScore": 4,
    "posColor": "#b2182b",
    "negColor": "#2166ac"
  }
}
```

The [`bigWigs`](/docs/config/multiwiggleadapter/#slot-bigwigs) shorthand takes a
plain list of absolute URLs and names each subtrack from its filename. Four
display settings turn that into a copy-number heatmap:

- [`defaultRendering`](/docs/config/multilinearwiggledisplay/#slot-defaultrendering)
  `multirowdensity` gives each sample one strip of color.
- [`bicolorPivot`](/docs/config/multilinearwiggledisplay/#slot-bicolorpivot) `2`
  puts white at the diploid baseline, so
  [`posColor`](/docs/config/multilinearwiggledisplay/#slot-poscolor) paints
  gains and [`negColor`](/docs/config/multilinearwiggledisplay/#slot-negcolor)
  losses.
- [`minScore`](/docs/config/multilinearwiggledisplay/#slot-minscore) and
  [`maxScore`](/docs/config/multilinearwiggledisplay/#slot-maxscore) pin the
  scale, so two copies are the same color in every window. Keep the bounds
  **symmetric around the pivot**: the ramp divides both sides by the longer one,
  so 0 to 4 lets both extremes saturate, and gains past 4 clamp.

Rows are in file order until **Clustering → Cluster rows by score...** in the
track menu brings similar samples together.

## Read the copy-number heatmap

Six individuals spanning the range, each plotted as a profile:

<Figure caption="The same window as six stacked profiles on a shared 0-10 axis, from an individual carrying about nine copies down to one carrying none. The plateaus are flat and land on integers." src="/img/cnv1000g/ccl3l1_ladder.png" />

Two paralogous blocks carry the variation. The right-hand one spans CCL3L1 and
CCL4L1, chemokine genes that exist in a variable number of tandem copies. The
left-hand one is a TBC1D3 repeat. Between them, an individual in this panel
carries anywhere from zero to ten copies.

## The same window in the 1000 Genomes SV map

The 1000 Genomes phase 3 integrated SV map covers this window with one CNV
record, at chr17:36,108,706-36,155,499 with three symbolic alleles (`<CN2>`,
`<CN3>`, `<CN4>`). It ends about 35 kb before the block where depth resolves the
widest range, and between 36,155,499 and 36,461,232 the GRCh38 release has no
copy-number record.

A VCF record is one interval with fixed breakpoints and a few symbolic alleles,
which nested multiallelic copy number is not. Depth in turn carries no genotype,
allele frequency or phasing. Where the variation fits the representation, they
agree:

<Figure caption="UGT2B17 on chr4, a biallelic deletion: depth is flat at two, one or zero copies with the same breakpoints in every carrier, and the SV map calls it as a CN0 deletion. Same track settings as the CCL3L1 figure." src="/img/cnv1000g/ugt2b17_biallelic.png" />

## Scaling past one population

The track above stops at 104 individuals.
[`measure_signal_latency.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/measure_signal_latency.ts)
counts what filling this window costs at panel scale, all 2504 BigWigs against a
store holding the same samples, using the readers the browser uses. It takes the
same `name`/`group`/`url` TSV as the converter, which the
[build script](#reproduce-it-end-to-end) writes:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/measure_signal_latency.ts
npm install @gmod/bbi generic-filehandle2

node measure_signal_latency.ts --samples 1000g_cnv_build/samples.tsv \
  --region chr17:36,080,000-36,270,000 \
  --zarr https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr
```

Against the hosted files, at a median range request of 25 ms:

| chr17:36,080,000-36,270,000, 2504 samples | 2504 BigWigs | Zarr store |
| ----------------------------------------- | ------------ | ---------- |
| requests                                  | 15,048       | 3          |
| bytes                                     | 48.39 MB     | 0.22 MB    |
| wall clock                                | 24.5 s       | 0.2 s      |

Six reads per BigWig, against two metadata reads plus one chunk of 2504 samples
by 256 bins. Every BigWig needs a few dependent reads to find where a region's
values live, so the cost is a round trip times the number of files. One array of
samples by bins, where a single read covers every sample, answers in a couple of
requests.

[Zarr](https://zarr.dev/) v3 is that format and needs no tile server:
[zarrita.js](https://github.com/manzt/zarrita.js) reads chunks off static
hosting.
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) adds a
`MultiWiggleZarrAdapter`, and the display, clustering and settings above are
unchanged.

The plugin is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet, but its built bundle is
hosted (see [configuring plugins](/docs/config_guides/plugins)):

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ],
  "tracks": [
    {
      "type": "MultiQuantitativeTrack",
      "trackId": "cnv_1000g_zarr",
      "name": "1000 Genomes copy number, 2504 individuals",
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "MultiWiggleZarrAdapter",
        "uri": "qm2_cn_1kb.zarr"
      },
      "displayDefaults": {
        "defaultRendering": "multirowdensity",
        "bicolorPivot": 2,
        "minScore": 0,
        "maxScore": 4,
        "posColor": "#b2182b",
        "negColor": "#2166ac"
      }
    }
  ]
}
```

The adapter config is the store's location and nothing else: the sample list,
bin size and resolution levels are attributes of the store. A relative `uri`
resolves against the config that holds it.

<Figure caption="All 2504 individuals of the 1000 Genomes panel, clustered, from a single Zarr store. Red is a gain over the diploid baseline, blue a loss, white two copies: the CCL3L1/CCL4L1 block stands in flat diploid on both sides of it." src="/img/cnv1000g/zarr_cohort.png" />

Two requests are metadata, once per store; the rest are chunks, each carrying
every sample across a range of bins, so a view's cost follows the width of the
window.

## Build the store

[`build_signal_zarr.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_signal_zarr.ts)
turns a list of BigWigs into one store. It takes a TSV of `name` and `url`, with
an optional `group` column between them (here the population, which labels and
groups the rows). It imports two npm packages and nothing else:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_signal_zarr.ts
npm install @gmod/bbi generic-filehandle2

node build_signal_zarr.ts \
  --samples samples.tsv \
  --out qm2_cn_1kb.zarr \
  --region chr17:35000000-37500000 \
  --region chr4:68000000-69000000 \
  --levels 1000,10000
```

That is the command behind this tutorial's figures, all 2504 samples over the
windows the page visits; this store lands at 1.4 MB.

`--levels` is the resolution pyramid: one samples-by-bins array per entry,
coarser ones averaged from the finest. The adapter reads the coarsest level
whose bins are no wider than a screen pixel, so a whole-chromosome view costs
the same couple of requests. Give it your input's bin size first, then steps of
roughly 3x: `10000,30000,100000` rather than `10000,100000`, since a 10x gap
leaves a view fetching 10x the bins it can draw.

Every level above the finest stores the minimum and maximum of the bins it
averages alongside the mean.
[`summaryScoreMode`](/docs/config/multilinearwiggledisplay/#slot-summaryscoremode)
picks which a view draws, so an amplification narrower than a bin is visible
under `max` and averaged away under `avg`.

The finest level is held whole in memory while the rest derive from it. Without
the `--region` flags this panel is a few GB at 10 kb bins and about 31 GB at the
BigWigs' own 1 kb, so a whole-genome pyramid starts coarse. The converter prints
that level's size before allocating and refuses when it will not fit.

The output is a folder of files. Copy it to any static host with CORS enabled
and point a track at it. To write a store from something other than BigWigs, the
plugin's
[store format](https://github.com/cmdcolin/jbrowse-plugin-zarr#store-format)
gives the layout.

## Your own samples

Run [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) over your aligned reads.
The lab's
[tutorial](https://github.com/KiddLab/QuicK-mer2/blob/master/tutorial.md) takes
one 30x 1000 Genomes CRAM through `count` and `est`, and for GRCh38 the k-mer
index is
[prebuilt](https://kiddlabshare.med.umich.edu/QuicK-mer/QuicK-mer2-refs/GRCh38/).
It is a cluster-sized job: the tutorial reports 67 GB of reference files,
roughly 50 GB of RAM, and about 25 minutes on six threads per sample.

`est` writes copy number in 1 kb windows, and its four columns are bedGraph once
the decoy and EBV contigs are dropped:

```bash
grep -v decoy sample.qm2.CN.1k.bed | grep -v chrEBV >sample.bedgraph
samtools faidx GRCh38_BSM.fa
cut -f1,2 GRCh38_BSM.fa.fai >GRCh38_BSM.chrom.sizes
bedGraphToBigWig sample.bedgraph GRCh38_BSM.chrom.sizes sample.qm2.CN.1k.bw
```

Host it, then add its URL to `bigWigs`, or a `name` and `url` row to
`samples.tsv` for the Zarr build. Running an individual the panel already covers
gives the lab's estimate as a check.

## Reproduce it end to end

[`build_1000g_cnv_zarr.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_1000g_cnv_zarr.sh)
derives the full 2504-sample list from the Kidd lab `trackDb` and runs the
converter over it, fetching the converter and its two packages itself:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_1000g_cnv_zarr.sh
bash build_1000g_cnv_zarr.sh                # the tutorial's windows, 1kb base, into ./1000g_cnv_build
bash build_1000g_cnv_zarr.sh --whole-genome # every main contig, 10kb base and five levels
```

## See also

- [](/docs/user_guides/multiquantitative_track)
- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/dog10k_svs)
- [](/docs/user_guides/clustering)

## References

- Shen & Kidd (2020).
  [Rapid, Paralog-Sensitive CNV Analysis of 2457 Human Genomes Using QuicK-mer2](https://doi.org/10.3390/genes11020141),
  the citation for the copy-number data used throughout this page
- [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG), the Kidd lab track
  hub these files come from, and
  [KiddLab/QuicK-mer2](https://github.com/KiddLab/QuicK-mer2), the caller that
  produced them
- [The QuicK-mer2 tutorial](https://github.com/KiddLab/QuicK-mer2/blob/master/tutorial.md),
  one sample from CRAM to copy number, with the lab's own output to check
  against
- [1000 Genomes phase 3 integrated SV map](https://doi.org/10.1038/nature15394)
- [Zarr v3 specification](https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html)
