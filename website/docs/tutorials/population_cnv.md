---
title: CNV across a population (1000 Genomes)
description:
  Read k-mer depth copy number for every individual in the 1000 Genomes panel,
  and see the structure a symbolic-allele callset cannot hold
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** point a `MultiQuantitativeTrack` at per-sample copy-number BigWigs,
render it as a `multirowdensity` heatmap with the bicolor pivot at the diploid
baseline of 2, and every individual becomes one row whose color encodes a copy
number. Past a few hundred samples the format becomes the bottleneck, so the
second half packs the same values into one Zarr store.

## Prerequisites

- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web)) and the [JBrowse CLI](/docs/cli)
- Nothing to download. The per-sample copy-number BigWigs are hosted, and each
  one is under 600 KB for the whole genome:

| File                                                                                | What                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------- |
| `https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/<POP>/<SAMPLE>.qm2.CN.1k.bw` | one individual's copy number, 1kb bins |

These are [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) estimates over the
30x 1000 Genomes panel, produced by the Kidd lab at the University of Michigan
and published as the [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG)
track hub, whose `trackDb` lists all 2504 samples across 26 populations. That
hub serves bigBed heat maps for the UCSC browser. The files above are the lab's
raw per-sample bigWig estimates, re-hosted unmodified on `jbrowse.org`. The
lab's own download share for those is offline, so the copies above are what
these examples use. **If you use them, cite
[Shen and Kidd 2020](https://doi.org/10.3390/genes11020141).**

QuicK-mer2 counts k-mers that occur exactly once in the reference, which is what
makes it read _paralogs_ apart instead of collapsing a gene family into one
averaged pile. That property is the whole reason this tutorial has anything to
show.

<Figure caption="chr17:36.08-36.27Mb in 104 PUR individuals, one row each, clustered on this window. Red is a gain over the diploid baseline, blue a loss, white two copies, and the bar top right is the scale. The 1000 Genomes integrated SV map above holds a single multiallelic CNV record, which ends before the block where copy number runs from zero to ten across the panel." src="/img/cnv1000g/ccl3l1_depth.png" />

## Load it

Add hg38, then one track holding every sample:

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
  scale, and copy number is the kind of quantity that wants pinning: 2 means the
  same thing in every window, so the color should too. Nearly every bin of
  nearly every sample sits at the baseline, so the default autoscale tracks the
  noise around it and clips the amplifications, and any autoscale rescales per
  window, which makes one color mean a different copy number after every
  navigation.

  Pick the bounds **symmetric around the pivot**. The ramp divides both sides by
  the longer one, so 0 to 6 around a pivot of 2 would cap a homozygous deletion
  at half saturation, the same intensity as a single extra copy pair. 0 to 4
  lets both extremes saturate. Gains past 4 clamp, which the legend shows.

Then run **Clustering → Cluster rows by score** in the track menu. Rows are in
file order until you do, and copy-number classes only read as blocks once
similar samples sit together.

## Read it

The heatmap is a summary of per-sample profiles, and those profiles are flat and
quantized. Six individuals spanning the range, plotted rather than colored:

<Figure caption="The same window as six stacked profiles on a shared 0-10 axis, from an individual carrying about nine copies down to one carrying none. The plateaus are flat and land on integers, so the copies are countable rather than inferred from a color." src="/img/cnv1000g/ccl3l1_ladder.png" />

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

<Figure caption="UGT2B17 on chr4, a biallelic deletion: depth is flat at two, one or zero copies with the same breakpoints in every carrier, and the SV map calls it as a CN0 deletion at 47% allele frequency. Same track settings as the CCL3L1 figure." src="/img/cnv1000g/ugt2b17_biallelic.png" />

## Scaling past one population

The track above is 104 individuals because that is roughly where one BigWig per
sample stops being pleasant, and the reason is not size. Reading the window in
this tutorial's figures out of the hosted files:

- One BigWig is under 600 KB for the whole genome at 1 kb bins, and the window
  is a couple of kilobytes of that.
- Filling it takes 625 HTTP requests, six per file. A BigWig has to read its
  header, its chrom B-tree and its R-tree index before it knows where a region's
  values live, and each of those waits on the one before it.
- A range request to the host costs about 210 ms, so the cost is latency
  multiplied by file count rather than bandwidth. The full panel is 24 times the
  files.

The fix is a format that answers the same question in a couple of requests: one
array, samples by bins, chunked so that a chunk holds every sample over a span
of the genome.

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
the converter.

<Figure caption="All 2504 individuals of the 1000 Genomes panel over the CCL3L1 window, clustered, from a single Zarr store. Every population is present, so the classes the 104-sample figure hints at are filled in." src="/img/cnv1000g/zarr_cohort.png" />

Filling that window for all 2504 individuals:

- One BigWig each: roughly 15,000 requests, a minute or so. Scaled up from the
  104-sample track, which took 625 requests and 3 seconds against the same host.
- One Zarr store: 3 requests, under a second. The group metadata, the array
  metadata, and one chunk, at the 210 ms round trip above.

The three do not change with the cohort, because the sample axis is inside the
chunk.

## Build the store

[`build_signal_zarr.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_signal_zarr.ts)
turns a list of BigWigs into one store. It takes a TSV of `name` and `url`, with
an optional `group` column between them (here the population, which labels the
rows and groups them in the clustering sidebar):

```bash
node scripts/build_signal_zarr.ts \
  --samples samples.tsv \
  --out qm2_cn_1kb.zarr \
  --region chr17:35000000-37500000 \
  --region chr4:68000000-69000000 \
  --levels 1000,10000
```

Omit `--region` to convert whole genomes. The example above is the store this
tutorial's figures use: 2504 samples over 3.5 Mb, which is 35 MB of float32
before compression and 1.4 MB on disk after, built in about 30 seconds. Copy
number compresses well because most of it is the same number.

Three choices in the output are what make the reads cheap.

Chunks are `[all samples, 256 bins]`, so one request returns every sample over
256 kb and a screenful of the cohort is one or two reads whether the cohort is
three samples or three thousand. This is the opposite of the natural per-sample
layout.

Levels form a pyramid. `--levels 1000,10000` writes the 1 kb values plus a 10 kb
average of them, and the adapter picks the coarsest level still finer than one
screen pixel. Without it, a zoomed-out view reads every 1 kb bin to draw each
pixel once.

Unmeasured bins are `NaN` rather than zero. QuicK-mer2 leaves gaps where there
are no unique k-mers, and a gap drawn as zero coverage reads as a homozygous
deletion.

A `group` costs the heatmap nothing. Grouped samples share a synthesized color,
but where that color lands depends on the rendering: in a line or xy plot it is
the sample's own color, and in density, where the score already owns the color
ramp, it tints the row label instead. So the populations show up beside the rows
without touching the red-to-blue scale.

The store is plain files, so publishing it is a copy to any static host with
CORS enabled. There is no server component.

## Reproduce it end to end

[`build_1000g_cnv_zarr.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_1000g_cnv_zarr.sh)
derives the full 2504-sample list from the Kidd lab `trackDb` and runs the
converter over it, so nothing above depends on a hand-written sample list.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_1000g_cnv_zarr.sh
bash build_1000g_cnv_zarr.sh                # the tutorial's window
bash build_1000g_cnv_zarr.sh --whole-genome # every main contig
```

## See also

- [Multi-quantitative tracks](/docs/user_guides/multiquantitative_track), the
  display's own menus and options
- [](/docs/tutorials/tcga_cohort_cnv), the same one-row-per-sample idea for
  somatic segment calls
- [Structural variants across samples](/docs/tutorials/sv_multisamples)
- [Clustering](/docs/user_guides/clustering)

## References

- Shen F and Kidd JM,
  [Rapid, Paralog-Sensitive CNV Analysis of 2457 Human Genomes Using QuicK-mer2](https://doi.org/10.3390/genes11020141),
  Genes 2020, 11(2):141. **The citation for the copy-number data used throughout
  this page.**
- [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG), the Kidd lab track
  hub these files come from, and
  [KiddLab/QuicK-mer2](https://github.com/KiddLab/QuicK-mer2), the caller that
  produced them
- [1000 Genomes phase 3 integrated SV map](https://doi.org/10.1038/nature15394)
- [Zarr v3 specification](https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html)
