---
title: CNV across a population (1000 Genomes)
description:
  Read k-mer depth copy number for every individual in the 1000 Genomes panel,
  and pack the whole panel into one Zarr store
guide_category: Tutorials
tutorial_category: Structural variation
---

Copy number varies from person to person, and we show the whole 1000 Genomes
panel at once: one heatmap row per individual, colored by how far that person
strays from the diploid baseline of 2. JBrowse draws the heatmap from per-sample
BigWigs. Past a few hundred samples the per-file requests dominate the load
time, so the second half of the page packs the values into one Zarr store.

## Prerequisites

- a JBrowse instance to paste a track into (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- `node` 24 or newer, to [build a Zarr store](#build-the-store); the converter
  is one downloadable file that pulls two npm packages
- QuicK-mer2 and a 30x alignment, to add
  [samples of your own](#your-own-samples)

## Where the data comes from

QuicK-mer2 copy-number estimates over the 30x 1000 Genomes panel, from the Kidd
lab at the University of Michigan
([Shen and Kidd 2020](https://doi.org/10.3390/genes11020141)).

- the sample list across 26 populations, from the lab's UCSC track hub:
  https://raw.githubusercontent.com/KiddLab/kmer_1KG/master/kmer-1kg.trackDb.txt
- the per-sample bigWigs, one individual's copy number in 1 kb bins, re-hosted
  unmodified because the lab's download share is offline. Each file sits under
  its population, so HG00551 and HG00553 are
  https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00551.qm2.CN.1k.bw
  and
  https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00553.qm2.CN.1k.bw
- the same values packed into one Zarr store for the
  [whole panel](#a-zarr-store-for-the-whole-panel). The store is a directory of
  chunks that 404s at its root, and the URL is what an adapter takes as `uri`:
  https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr

## The QuicK-mer2 estimates

The [QuicK-mer2](https://github.com/KiddLab/QuicK-mer2) estimates come from the
Kidd lab's [KiddLab/kmer_1KG](https://github.com/KiddLab/kmer_1KG) track hub,
and we read the lab's per-sample bigWigs. QuicK-mer2 counts k-mers that occur
exactly once in the reference, so each estimate is specific to one _paralog_.

## Load the genome

The copy-number bins are on GRCh38, so the tracks below attach to an hg38
assembly:

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

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
    "mark": "heatmap",
    "origin": 2,
    "scales": { "y": { "domainMin": 0, "domainMax": 4 } },
    "color": {
      "field": "score",
      "scale": "threshold",
      "range": ["#2166ac", "#b2182b"],
      "title": "Copy number"
    }
  }
}
```

The [`bigWigs`](/docs/config/multiwiggleadapter/#slot-bigwigs) shorthand takes a
plain list of absolute URLs and names each subtrack from its filename. Four
display settings turn that into a copy-number heatmap:

- [`mark`](/docs/config/linearwiggledisplay/#slot-mark) `heatmap` gives each
  sample one strip of color.
- [`origin`](/docs/config/linearwiggledisplay/#slot-origin) `2` puts white at
  the diploid baseline, and [`color`](/docs/config/wigglecolor/) cuts there,
  painting gains in the `range`'s second colour and losses in its first.
- [`scales.y.domainMin`](/docs/config/valuescale/#slot-scalesydomainmin) and
  [`scales.y.domainMax`](/docs/config/valuescale/#slot-scalesydomainmax) pin the
  scale, so two copies are the same color in every window. Keep the bounds
  **symmetric around the origin**. The ramp divides both sides by the longer
  one, so 0 to 4 lets both extremes saturate, and gains past 4 clamp.

Rows are in file order until **Clustering → Cluster rows by score...** in the
track menu brings similar samples together.

The PUR track is also in `config_demo`, so
[the panel opens on a copy-number-polymorphic window of chr3](https://jbrowse.org/code/jb2/main/?config=test_data/config_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr3%3A162%2C275%2C163-163%2C360%2C944%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22pur_copynumber_1000g%22%2C%22type%22%3A%22LinearWiggleDisplay%22%2C%22height%22%3A420%2C%22defaultRendering%22%3A%22density%22%2C%22scales%22%3A%7B%22y%22%3A%7B%22domainQuantile%22%3A1%7D%7D%2C%22showTree%22%3Afalse%7D%5D%7D%5D%7D&sessionName=Screenshot)
with these settings already applied.

## Six individuals as profiles

Navigate to `chr17:36,080,000-36,270,000`, around _CCL3L1_, and load six
individuals spanning the range of copy number as a second track. The track draws
step lines on one pinned axis, so each plateau lines up with a copy count:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pur_cnv_ladder",
  "name": "PUR copy number, six individuals",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "HG01177",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01177.qm2.CN.1k.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "HG01083",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01083.qm2.CN.1k.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "HG01070",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01070.qm2.CN.1k.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "HG01395",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01395.qm2.CN.1k.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "HG00731",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00731.qm2.CN.1k.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "HG00553",
        "uri": "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00553.qm2.CN.1k.bw"
      }
    ]
  },
  "displayDefaults": {
    "mark": "line",
    "scales": {
      "y": { "domainMin": 0, "domainMax": 10, "title": "Copy number" }
    }
  }
}
```

<Figure caption="The CCL3L1 window as six stacked profiles on a shared 0-10 axis, from the individual carrying the most copies down to one carrying none. The plateaus are flat and land on integers." src="/img/cnv1000g/ccl3l1_ladder.png" />

Two paralogous blocks carry the variation. The right-hand one spans CCL3L1 and
CCL4L1, chemokine genes that exist in a variable number of tandem copies. The
left-hand one is a TBC1D3 repeat.

## The same window in the 1000 Genomes SV map

The 1000 Genomes phase 3 integrated SV map covers this window with one CNV
record, at chr17:36,108,706-36,155,499 with three symbolic alleles (`<CN2>`,
`<CN3>`, `<CN4>`). It ends before the block where depth resolves the widest
range, and between 36,155,499 and 36,461,232 the GRCh38 release has no
copy-number record.

A VCF record is one interval with fixed breakpoints and a few symbolic alleles,
which cannot describe nested multiallelic copy number. Depth, for its part,
gives no genotype, allele frequency or phasing. At a simple biallelic deletion
the two sources agree. We'll add the SV map as a variant track, then navigate to
_UGT2B17_ on chr4 with the PUR panel track from the first section under it. For
your own callset, swap `uri` for a bgzip-compressed, tabix-indexed VCF on the
same assembly:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "integrated_sv_map_v2",
  "name": "1000 Genomes integrated SV map (phase 3)",
  "assemblyNames": ["hg38"],
  "uri": "https://1000genomes.s3.amazonaws.com/phase3/integrated_sv_map/supporting/GRCh38_positions/ALL.wgs.integrated_sv_map_v2_GRCh38.20130502.svs.genotypes.vcf.gz"
}
```

<Figure caption="UGT2B17 on chr4 in the PUR panel track, under the SV map. A biallelic deletion: each individual sits flat at two, one or zero copies with the same breakpoints in every carrier, and the SV map calls it as a CN0 deletion." src="/img/cnv1000g/ugt2b17_biallelic.png" />

## A Zarr store for the whole panel

The PUR panel track holds 104 individuals.
[`measure_signal_latency.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/measure_signal_latency.ts)
measures the requests, bytes and time needed to fill this window from all 2504
BigWigs and from a Zarr store holding the same samples, using the readers the
browser uses. It takes the same `name`/`group`/`url` TSV as the converter, which
the [build script](#reproduce-it-end-to-end) writes:

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

Each BigWig needs several dependent reads to find and fetch a region's values,
so the cost grows with the number of files. The Zarr store is one array of
samples by bins: two metadata reads, then one chunk covering all 2504 samples
across 256 bins.

[Zarr](https://zarr.dev/) v3 stores such arrays as chunk files on static
hosting, which [zarrita.js](https://github.com/manzt/zarrita.js) reads directly.
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr) adds a
`MultiWiggleZarrAdapter`, which takes the same display settings as the BigWig
track.

The plugin is in beta and is not yet in the
[plugin store](/docs/user_guides/plugin_store). Load its hosted bundle with a
`plugins` entry (see [configuring plugins](/docs/config_guides/plugins)):

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ]
}
```

With the plugin loaded, a track points the adapter at the store:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "cnv_1000g_zarr",
  "name": "1000 Genomes copy number, 2504 individuals",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleZarrAdapter",
    "uri": "https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr"
  },
  "displayDefaults": {
    "mark": "heatmap",
    "origin": 2,
    "scales": { "y": { "domainMin": 0, "domainMax": 4 } },
    "color": {
      "field": "score",
      "scale": "threshold",
      "range": ["#2166ac", "#b2182b"],
      "title": "Copy number"
    }
  }
}
```

The adapter config gives the store's location, and the store holds the sample
list, bin size and resolution levels. A relative `uri` resolves against the
config that holds it, so a store beside your `config.json` takes
`qm2_cn_1kb.zarr`.

<Figure caption="All 2504 individuals of the 1000 Genomes panel, clustered, from a single Zarr store. Red is a gain over the diploid baseline, blue a loss, white two copies. The CCL3L1/CCL4L1 block is flat diploid on both sides of it." src="/img/cnv1000g/zarr_cohort.png" />

Past the two metadata reads, each request is a chunk carrying every sample
across a range of bins, so the cost of a view follows the width of its window.

## A nested deletion

The store also covers chr3:162.5-163.2 Mb, where a 22 kb deletion sits inside a
114 kb one. Navigate the Zarr track to `chr3:162,650,000-163,050,000` and run
**Clustering → Cluster rows by score...**. The panel sorts individuals by which
of the two deletions they carry, and the long-read assembly calls of the Human
Genome Structural Variation Consortium
([Logsdon et al. 2025](https://doi.org/10.1038/s41586-025-09140-6)) place both.
We'll add them as a variant track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hgsvc3_sv_insdel",
  "name": "HGSVC3 structural variants, 5 kb and longer",
  "assemblyNames": ["hg38"],
  "uri": "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/HGSVC3/release/Variant_Calls/1.0/GRCh38/variants_GRCh38_sv_insdel_sym_HGSVC2024v1.0.vcf.gz"
}
```

The track holds every insertion and deletion, so keep the long ones by entering
this from **Filter by... → Edit filters...** in the track menu:

```text
jexl:alleleLength(feature)>=5000
```

<Figure caption="All 2504 individuals over chr3:162.65-163.05 Mb, clustered, under HGSVC3 structural variants of 5 kb and longer. Each block of rows carries neither deletion, one or two copies of one of them, or one copy of each." src="/img/paper/cohort_cnv.png" />

## Build the store

[`build_signal_zarr.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_signal_zarr.ts)
turns a list of BigWigs into one store. It takes a TSV of `name` and `url`, with
an optional `group` column between them (here the population, which labels and
groups the rows). It imports two npm packages:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_signal_zarr.ts
npm install @gmod/bbi generic-filehandle2

node build_signal_zarr.ts \
  --samples samples.tsv \
  --out qm2_cn_1kb.zarr \
  --region chr17:35000000-37500000 \
  --region chr4:68000000-69000000 \
  --region chr1:25150000-25450000 \
  --region chr3:162500000-163200000 \
  --levels 1000,10000
```

The command above built the hosted store from all 2504 samples, over the windows
in the figures, and the result is 2.4 MB.

`--levels` sets the resolution pyramid. Each entry is one samples-by-bins array,
with coarser ones averaged from the finest. The adapter reads the coarsest level
whose bins are no wider than a screen pixel, so a whole-chromosome view costs
the same couple of requests. Give it your input's bin size first, then steps of
roughly 3x: `10000,30000,100000` rather than `10000,100000`, since a 10x gap
leaves a view fetching 10x the bins it can draw.

Every level above the finest stores the minimum and maximum of the bins it
averages alongside the mean.
[`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode)
picks which a view draws, so an amplification narrower than a bin is visible
under `max` and averaged away under `avg`.

The converter holds the finest level in memory and derives the rest from it.
Without the `--region` flags this panel takes a few GB at 10 kb bins and tens of
GB at the 1 kb of the BigWigs, so start a whole-genome pyramid coarse. The
converter prints the size of the finest level before allocating it, and exits if
it will not fit.

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
The tutorial reports 67 GB of reference files, roughly 50 GB of RAM, and about
25 minutes on six threads per sample.

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

- [](/docs/user_guides/quantitative_track)
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
- Logsdon et al. (2025).
  [Complex genetic variation in nearly complete human genomes](https://doi.org/10.1038/s41586-025-09140-6),
  the HGSVC3 structural variant calls in the nested deletion figure
- [Zarr v3 specification](https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html)
