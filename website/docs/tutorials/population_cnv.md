---
title: CNV across a population (1000 Genomes)
description:
  Read k-mer depth copy number for every individual in the 1000 Genomes panel,
  and see the structure a symbolic-allele callset cannot hold
guide_category: Tutorials
tutorial_category: Structural variation
data: download
---

**TL;DR:** point a `MultiQuantitativeTrack` at per-sample copy-number BigWigs
and render it as a `multirowdensity` heatmap, with the color pivot at the
diploid baseline of 2. Every individual becomes one row, colored by copy number.
Past a few hundred samples the per-file requests become the bottleneck, so the
second half packs the same values into one Zarr store.

## Prerequisites

- a JBrowse instance to paste a track into (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop): every file here is a URL, so
  Desktop needs nothing hosted)
- `node` 24 or newer, to [build a Zarr store](#build-the-store); the converter
  is one downloadable file and pulls its own two npm packages, so nothing is
  cloned
- QuicK-mer2 and a 30x alignment, to add
  [samples of your own](#your-own-samples)

## The QuicK-mer2 estimates

The values are [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) copy-number
estimates over the 30x 1000 Genomes panel, from the Kidd lab at the University
of Michigan. Their [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG) track
hub publishes bigBed heat maps for the UCSC browser, and its `trackDb` lists all
2504 samples across 26 populations. The files this page reads are the lab's raw
per-sample bigWigs, one individual's copy number in 1 kb bins, re-hosted
unmodified at
`https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/<POP>/<SAMPLE>.qm2.CN.1k.bw`
because the lab's own download share is offline. **If you use them, cite
[Shen and Kidd 2020](https://doi.org/10.3390/genes11020141).**

QuicK-mer2 counts only k-mers that occur exactly once in the reference, so it
reads _paralogs_ apart instead of collapsing a gene family into one averaged
pile.

## Load it

The whole panel goes in as one track, so the display, the clustering and the
color settings are declared once. Add hg38 first, then the track:

```json
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
  `multirowdensity` gives each sample one strip of color instead of one plot.
- [`bicolorPivot`](/docs/config/multilinearwiggledisplay/#slot-bicolorpivot) `2`
  puts white at the diploid baseline, so
  [`posColor`](/docs/config/multilinearwiggledisplay/#slot-poscolor) paints
  gains and [`negColor`](/docs/config/multilinearwiggledisplay/#slot-negcolor)
  losses. Left at its default of 0 the whole track reads as one shade of "some
  signal".
- [`minScore`](/docs/config/multilinearwiggledisplay/#slot-minscore) and
  [`maxScore`](/docs/config/multilinearwiggledisplay/#slot-maxscore) pin the
  scale. Two copies mean the same thing in every window, so the color should
  too, and autoscale follows the noise at the baseline, clips the
  amplifications, and rescales after every navigation.

  Keep the bounds **symmetric around the pivot**. The ramp divides both sides by
  the longer one, so 0 to 6 would cap a homozygous deletion at half saturation,
  the same shade as one extra copy. 0 to 4 lets both extremes saturate, and
  gains past 4 clamp, which the legend shows.

Then run **Clustering → Cluster rows by score...** in the track menu. Rows are
in file order until you do, and copy-number classes only read as blocks once
similar samples sit together.

## Read it

The heatmap is a summary of per-sample profiles, and those profiles are flat and
quantized. Six individuals spanning the range, plotted rather than colored:

<Figure caption="The same window as six stacked profiles on a shared 0-10 axis, from an individual carrying about nine copies down to one carrying none. The plateaus are flat and land on integers." src="/img/cnv1000g/ccl3l1_ladder.png" />

Two paralogous blocks carry the variation. The right-hand one spans CCL3L1 and
CCL4L1, chemokine genes that exist in a variable number of tandem copies. The
left-hand one is a TBC1D3 repeat. Between them, an individual in this panel
carries anywhere from zero to ten copies, and the levels are discrete.

## What the callset says about the same window

The 1000 Genomes phase 3 integrated SV map, the standard variant-level answer
for this cohort, covers this window with one CNV record. It sits at
chr17:36,108,706-36,155,499 with three symbolic alleles (`<CN2>`, `<CN3>`,
`<CN4>`), and it ends about 35 kb before the block where depth resolves the
widest range. Between 36,155,499 and 36,461,232 the GRCh38 release of that
callset has no copy-number record at all.

This is a limit of the representation rather than a callset bug. A VCF record is
one interval with fixed breakpoints and a small set of symbolic alleles, and
nested multiallelic copy number is neither. Depth in turn carries no genotype,
allele frequency or phasing, all of which the callset has, so the two are
complements.

Where the variation does fit the representation, they agree:

<Figure caption="UGT2B17 on chr4, a biallelic deletion: depth is flat at two, one or zero copies with the same breakpoints in every carrier, and the SV map calls it as a CN0 deletion. Same track settings as the CCL3L1 figure." src="/img/cnv1000g/ugt2b17_biallelic.png" />

## Scaling past one population

The track above stops at 104 individuals because that is about where one BigWig
per sample stops being pleasant, and size is not the reason.
[`measure_signal_latency.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/measure_signal_latency.ts)
counts what filling this tutorial's window costs each way at panel scale, all
2504 BigWigs against a store holding those same 2504 samples, by wrapping
`fetch` around the same readers the browser uses. It takes the same
`name`/`group`/`url` TSV as the converter, so the sample list the
[build script](#reproduce-it-end-to-end) writes drives it directly:

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
by 256 bins.

The bytes are not the problem, the request count is: every BigWig needs a few
reads to find where a region's values live, once per file and waiting on each
other, so the cost is a round trip times the number of files. The fix is a
format that answers the same question in a couple of requests, one array of
samples by bins stored so that a single read covers every sample at once.

[Zarr](https://zarr.dev/) v3 is that format, and it needs no tile server:
[zarrita.js](https://github.com/manzt/zarrita.js) reads chunks straight off
static hosting.
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) adds a
`MultiWiggleZarrAdapter` that reads one, and because a multi-sample quantitative
adapter is duck-typed, the display, the clustering and the settings above are
unchanged.

The plugin is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet, but the built bundle is
hosted, so it loads from any config today (see
[configuring plugins](/docs/config_guides/plugins)):

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
the bin size and the resolution levels are attributes of the store, written by
the converter. A relative `uri` resolves against the config that holds it, so a
store sitting beside `config.json` needs no absolute URL.

<Figure caption="All 2504 individuals of the 1000 Genomes panel, clustered, from a single Zarr store. Red is a gain over the diploid baseline, blue a loss, white two copies: the CCL3L1/CCL4L1 block stands in flat diploid on both sides of it." src="/img/cnv1000g/zarr_cohort.png" />

That figure is the whole panel, and the panel is not what it cost. Two of the
requests are metadata and happen once per store; the rest are chunks, and a
chunk carries every sample across a range of bins. So what a view costs follows
the width of the window rather than the size of the cohort. This frame is wider
than the one measured above and spans a few more chunks, where 2504 BigWigs
would still have been six reads each.

## Build the store

[`build_signal_zarr.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_signal_zarr.ts)
turns a list of BigWigs into one store. It takes a TSV of `name` and `url`, with
an optional `group` column between them (here the population, which labels the
rows and groups them in the clustering sidebar). It imports two npm packages and
nothing else, so it runs on its own:

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
windows the page visits. The converter prints the sizes as it writes; this store
lands at 1.4 MB.

`--levels` is the one flag worth thinking about, and it is the resolution
pyramid: one samples-by-bins array per entry, coarser ones averaged from the
finest. The adapter reads the coarsest level whose bins are still no wider than
a screen pixel, so a whole-chromosome view costs the same couple of requests the
CCL3L1 window does rather than every bin under it. Give it your input's bin size
first, then steps of roughly 3x: `10000,30000,100000` rather than
`10000,100000`, since a 10x gap leaves a view landing just under a level
fetching 10x the bins it can draw.

A pyramid of means alone would lose whatever is narrower than a bin, so every
level above the finest also stores the minimum and maximum of the bins it
averages, the way a BigWig zoom record carries all three.
[`summaryScoreMode`](/docs/config/multilinearwiggledisplay/#slot-summaryscoremode)
picks which one a view draws, so an amplification narrower than a bin is visible
under `max` and averaged back to the diploid baseline under `avg`.

The finest level is the one to choose deliberately, being the only one held
whole in memory while the rest derive from it. Drop the `--region` flags and
this panel is a few GB of matrix at 10 kb bins and about 31 GB at the BigWigs'
own 1 kb, so a whole-genome pyramid starts coarse. The converter prints the size
of that level before it allocates, and refuses when it will not fit.

The output is an ordinary folder of files. Copy it to any static host with CORS
enabled and point a track at it, the same way you would host a BigWig. Nothing
runs on the server.

If you would rather write a store from something other than BigWigs, the
plugin's
[store format](https://github.com/cmdcolin/jbrowse-plugin-zarr#store-format)
gives the layout the adapter expects.

## Your own samples

Nothing here is specific to the 1000 Genomes panel. To put a genome of your own
on the same scale, run [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) over
its aligned reads. The lab's
[tutorial](https://github.com/KiddLab/QuicK-mer2/blob/master/tutorial.md) takes
one 30x 1000 Genomes CRAM through `count` and `est` command by command, with its
own sample output to check against. For GRCh38 its k-mer index is
[prebuilt](https://kiddlabshare.med.umich.edu/QuicK-mer/QuicK-mer2-refs/GRCh38/),
which skips the `search` pass over the reference. It is a cluster-sized job
either way: the tutorial reports 67 GB of reference files, roughly 50 GB of RAM
to hold the index, and about 25 minutes on six threads per sample.

What that leaves for JBrowse is one conversion. `est` writes copy number in 1 kb
windows, and its four columns are bedGraph once the decoy and EBV contigs are
dropped:

```bash
grep -v decoy sample.qm2.CN.1k.bed | grep -v chrEBV >sample.bedgraph
samtools faidx GRCh38_BSM.fa
cut -f1,2 GRCh38_BSM.fa.fai >GRCh38_BSM.chrom.sizes
bedGraphToBigWig sample.bedgraph GRCh38_BSM.chrom.sizes sample.qm2.CN.1k.bw
```

Host it, then add its URL to `bigWigs`, or a `name` and `url` row to
`samples.tsv` for the Zarr build, and the sample is another row on the same
color ramp. Running an individual the panel already covers gives the lab's
estimate of that genome as a check.

## Reproduce it end to end

[`build_1000g_cnv_zarr.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_1000g_cnv_zarr.sh)
derives the full 2504-sample list from the Kidd lab `trackDb` and runs the
converter over it, so nothing above depends on a hand-written sample list. It
fetches the converter and installs its two packages beside its own output, so
one download is the whole setup:

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
