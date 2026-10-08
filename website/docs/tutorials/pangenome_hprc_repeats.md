---
title: 'Pangenome (HPRC) part 3: repeat lengths across haplotypes'
sidebar_label: Pangenome (HPRC pt 3, repeat lengths)
description:
  Count kringle copies in LPA and tell their two repeat types apart, measure the
  ABCA7 VNTR in HPRC haplotypes straight from the graph's walks, then set TRGT's
  read-based genotypes on the same bars and find the samples where reads and
  assemblies disagree, and count AMY1 gene copies across the amylase array
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A tandem repeat is one sequence copied head to tail, and the number of copies
varies from person to person. An assembled haplotype spans the whole array, so
the Human Pangenome Reference Consortium's release 2 graph holds each
haplotype's repeat at its full length. We read three arrays off it, one bar per
haplotype:

- at _LPA_, count copies of the kringle IV type 2 repeat and tell its two repeat
  types apart
- at _ABCA7_, measure an intronic VNTR and set PacBio's read-based TRGT
  genotypes on the same bars
- find the samples where the assemblies and the reads disagree
- at amylase, count _AMY1_ gene copies and check them against Yilmaz et al.
  (2024)

:::caution Experimental

The graph view is a beta plugin, and walk rows is its newest layout. The HPRC
page lives on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which the HPRC page's launches and the hosted HPRC
  config the sessions below open already load;
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph#the-graphgenomeview-plugin)
  loads it into your own JBrowse
- the TandemRepeat plugin for [Which copy is which](#which-copy-is-which), which
  the hosted HPRC config also loads; the plugin store lists it for your own
  JBrowse
- for your own samples: [TRGT](https://github.com/PacificBiosciences/trgt) and
  `bcftools`
- for your own array in [Which copy is which](#which-copy-is-which):
  [`gbz-base`](https://github.com/jltsiren/gbz-base), to cut the graph
- for [Which copy is which](#which-copy-is-which) and
  [The ABCA7 alleles across 94 samples](#the-abca7-alleles-across-94-samples):
  Node, to run the plugin's scripts
- for [Reproduce it end to end](#reproduce-it-end-to-end):
  [DuckDB](https://duckdb.org), and for its amylase build `samtools` built with
  libcurl, [`minimap2`](https://github.com/lh3/minimap2), `python3` and Node.js
  for `npx`

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) and PacBio's TRGT
genotypes of 100 of its samples (Dolzhenko et al. 2024).

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- TRGT's genotypes over the Genome in a Bottle repeat catalogue, a TRGTdb:
  https://zenodo.org/records/8329210/files/adotto_hprc.tdb.tar
- the catalogue itself:
  https://zenodo.org/records/8329210/files/adotto_repeats.hg38.bed.gz
- the assemblies, for the amylase build:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv

<details>
<summary>Read by URL (no download needed)</summary>

- our tabix index files cut from the release's rGFA graph, with the build
  recorded beside them: https://jbrowse.org/demos/hprc/README.txt
- the release 2.1 gbz-base database, one walk per haplotype, read by range
  request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our companion index naming that database's haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.f3.db

</details>

## Reading the LPA kringle repeat as a graph

_LPA_ contains a tandem array of kringle IV type 2 (KIV-2) copies, tied to
lipoprotein(a) levels, a heart-disease risk factor (Schmidt et al. 2016). Open
the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and press
**graph** on the LPA row. JBrowse opens on `chr6:160,525,000-160,655,000`. Tick
**Show... → Show bubble halos** in the graph track's menu. The strip along the
top of the track draws each reference segment at its position on the ruler, in
the colour of its node below.

<Figure caption="The LPA window with the RefSeq genes, UniProt's kringle domains and the HPRC bubbles above the force-directed graph track. The kringle array is the knot of loops in the middle, haloed and labelled as a repeat array, and LPA is pinned under the backbone with its exons along it." src="/img/pangenome/hprc_lpa_kiv2.png" />

Each loop in the knot is a different number of copies. Click the array's purple
label to lay the bubble's segments out alone, with a button back to the window.
The rGFA records segments and links; each haplotype's route through them, its
walk, is in the release's gbz-base database.

## Eight haplotypes' routes through the KIV-2 array {#one-haplotypes-copies}

A **walk** is one haplotype's route through the graph, and the release publishes
one per haplotype as a gbz-base database. In the same window:

- Type `chr6:160,616,002-160,646,753`, the array.
- **Display types → Feature display** puts the rGFA graph track back to a row of
  segments.
- Turn the gbz-base track on in the track selector, then take **Display types →
  Graph** in its menu for a force-directed graph of the walks.
- Check **Haplotypes → The track's 8 assemblies** <!-- menu-path-ok --> in the
  same menu. Every haplotype's walks through the array hold more nodes than a
  force-directed drawing takes, so this step keeps the eight HPRC assemblies the
  hosted config loads, and walk rows below draw them all.

A node draws thicker the more walks visit it (as in Bandage), so the shared
backbone is the thick line and copies on one haplotype are thin loops. Pick
`HG00133` under **Haplotypes**: its route stays dark while everything else
fades, and a readout gives its length against the reference walk.

<Figure caption="The eight-haplotype KIV-2 cut under the same window's genes, bubbles and rGFA segments, with HG00133 picked under Haplotypes. The labelled loop is copies HG00133 walks and GRCh38 does not, its links drawn dark, and the readout states the walk's excess over GRCh38." src="/img/pangenome/graph_kiv2_walks.png" />

## Every haplotype's KIV-2 array as a bar {#every-haplotypes-copies}

Walk rows draw each walk as a bar, so every haplotype in the release fits in the
track. In the gbz-base track's menu:

- **Walk rows** under the **Layout** row and **Uniform** under the **Color** row
  turn each walk into a bar, longest first, blue on GRCh38's path through the
  graph and purple off it
- **Haplotypes → Every haplotype in the graph** cuts the window again for the
  whole release

At KIV-2 each copy a haplotype adds is a run of new nodes, so its added copies
read as the purple stretch of its bar. The rows pack to fit the track, too thin
to letter, so hover a bar for its haplotype, length and excess over GRCh38.

<Figure caption="Every HPRC haplotype's walk across the KIV-2 array in walk rows, longest first under GRCh38's, beneath LPA with the KIV-2 bubble boxed in the bubbles track. The purple stretch of each bar is kringle copies off GRCh38's path, and the bar ends step down one copy at a time." src="/img/pangenome/graph_kiv2_walk_rows.png" />

Click the KIV-2 bubble boxed in the bubbles track. Its details give
`shortestAlleleLength` and `longestAlleleLength`, the shortest and longest
routes the rGFA holds there, and the bars run from about the one to about the
other.

Three controls change which bars show:

- Right-click a bar and pick **Show only** with its name to read one sample at
  full size.
- **Samples → Choose samples...** under the **Layout** row picks names, and
  **Samples → Every sample** brings the cohort back.
- **Group by... → superpopulation** under the **Layout** row splits the bars
  into a section per superpopulation, from the samples table the track names,
  every section on one ruler and row height.

## Telling KIV-2A from KIV-2B {#which-copy-is-which}

Walk rows give each haplotype's copy count. KIV-2's copies are near-identical,
and the aligner's choice of which GRCh38 copy an extra one matches is arbitrary,
so the walks leave open which copy is which. A record that lists each
haplotype's copies settles it.

We host one as a track: a single VCF 4.5 `<CNV:TR>` record at the array over
every haplotype whose walk reaches both flanks. Each allele lists its runs of
one copy type and every copy's length, a phased genotype puts each allele on its
haplotype, and a samples table gives each sample's population:

```json addtrack loc=chr6:160,616,002-160,646,753
{
  "type": "VariantTrack",
  "trackId": "hprc_kiv2_copies_all",
  "name": "LPA KIV-2 copies by unit, all HPRC haplotypes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc_kiv2_copies_all.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/hprc/hprc_samples.tsv"
    }
  }
}
```

Turn the track on, right-click the record and choose **Show repeat copies**. The
TandemRepeat plugin, which the hosted config loads beside the graph plugin,
opens a view with one bar per haplotype, each on its own bp axis and each copy
coloured by its type. Hover a copy for its haplotype.

<Figure caption="The KIV-2 record over every HPRC haplotype, those with the most KIV-2B copies first, then longest, each copy coloured by its type. KIV-2B leads every array that holds it; the lone bar whose KIV-2B copy sits fourth is GRCh38's." src="/img/pangenome/hprc_kiv2_copies_all_by_unit.png" />

**Group by… → superpopulation** in the view's menu splits the bars by that
column of the samples table, every section on the same ruler and row height:

<Figure caption="The same record grouped by superpopulation. Arrays opening with a block of KIV-2B copies gather in the AMR, EAS and SAS sections; in EUR, KIV-2B is mostly a single opening copy, and most AFR arrays hold none." src="/img/pangenome/hprc_kiv2_copies_by_superpopulation.png" />

The track selector also holds `LPA KIV-2 copies by unit, eight HPRC haplotypes`,
few enough bars to label each by name.

We wrote the KIV-2 record from the walks above. To write one for your own array,
we'll first cut the walks over it out of the gbz-base database as a GFA
subgraph, with enough context that the cut reaches the reference nodes on either
side:

```bash
# the reference walk is PanSN GRCh38#0#chr6; the interval is the array
npx --yes -p @gmod/gbz-base gbz-base-query \
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db \
  --haplotype-index https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.f3.db \
  --sample GRCh38 --contig chr6 --interval 160616002..160646753 \
  --context 1000 --snarls --haplotypes all --limit 100000 --resolve \
  --format gfa > cut.gfa
```

[`tandem-repeat-vcf.mjs`](https://github.com/GMOD/jbrowse-plugin-tandem-repeat/blob/main/scripts/tandem-repeat-vcf.mjs)
splits each walk into copies wherever the reference array's first 24 bases
recur, and groups copies within 1% of each other into a unit. It takes the cut
and a BED row naming the array on the reference (chrom, start, end, name), and
`--unit-names` names the units, the one with the most copies first:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-plugin-tandem-repeat/main/scripts/tandem-repeat-vcf.mjs
```

```bash
printf 'chr6\t160616002\t160646753\tKIV-2\n' > arrays.bed
node tandem-repeat-vcf.mjs cut.gfa --bed arrays.bed --name KIV-2 \
  --unit-names KIV-2A,KIV-2B > kiv2.vcf
```

Given one copy's exons as BED rows with their strand, `--sites` reports where
the units differ inside each. At KIV-2 that is exon 1's positions 14, 41 and 86,
the three synonymous sites LPA studies use to tell KIV-2B from KIV-2A, and
nothing in exon 2:

```bash
printf 'chr6\t160617116\t160617276\texon 1\t0\t-\nchr6\t160618483\t160618665\texon 2\t0\t-\n' > kiv2_exons.bed
node tandem-repeat-vcf.mjs cut.gfa --bed arrays.bed --name KIV-2 \
  --sites kiv2_exons.bed > /dev/null
```

A repeat finder's output draws as these bars too once it is written as a
`<CNV:TR>` record with each allele's runs and copy lengths.

## Measuring the ABCA7 VNTR in every haplotype

An intron of _ABCA7_ holds a VNTR (variable-number tandem repeat) tied to
Alzheimer's disease risk (De Roeck et al. 2018). Each haplotype's walk length
comes from its assembly, and PacBio measured the same repeat from HiFi reads in
100 HPRC samples. The session below lays the walks out as bars beside the genes,
the catalogue's VNTR row and the TRGT genotypes:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "ABCA7 VNTR, walk rows",
    "sessionTracks": [
      {
        "type": "FeatureTrack",
        "trackId": "abca7_vntr",
        "name": "Tandem repeat catalogue (adotto)",
        "assemblyNames": ["hg38"],
        "adapter": {
          "type": "FromConfigAdapter",
          "features": [
            {
              "uniqueId": "abca7_vntr",
              "refName": "chr19",
              "start": 1049407,
              "end": 1050096,
              "name": "ABCA7 VNTR"
            }
          ]
        }
      }
    ],
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr19:1,049,000-1,050,500",
        "tracks": [
          {
            "trackId": "hg38_ncbiRefSeq_ucsc",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact",
            "height": 40
          },
          {
            "trackId": "abca7_vntr",
            "type": "LinearBasicDisplay",
            "height": 40
          },
          {
            "trackId": "hprc_abca7_trgt",
            "type": "LinearVariantDisplay",
            "height": 40
          },
          {
            "trackId": "hprc_v2_1_gbz_lanes",
            "type": "LinearGraphDisplay",
            "layoutMode": "walkrows",
            "colorScheme": "uniform",
            "subgraphHaplotypes": [],
            "repeatTrackId": "hprc_abca7_trgt",
            "height": 600
          }
        ]
      }
    ]
  }
}
```

Each row is one haplotype's walk between the flanking reference nodes. Hover a
row for its haplotype and length.

## Overlaying TRGT's read-based genotypes on the ABCA7 bars

[TRGT](https://github.com/PacificBiosciences/trgt) is PacBio's tandem repeat
genotyper for HiFi reads. We host its _ABCA7_ call as this track:

```json addtrack loc=chr19:1,049,000-1,050,500
{
  "trackId": "hprc_abca7_trgt",
  "name": "TRGT repeat genotypes at ABCA7, 94 HPRC samples",
  "uri": "https://jbrowse.org/demos/hprc/hprc_abca7_trgt.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

TRGT writes the same fields for your own samples, one VCF each, joined by
`trgt merge`:

```bash
# one run per sample: HiFi reads aligned to GRCh38, and the repeat catalogue
trgt genotype --genome GRCh38.fa --reads sample.bam \
  --repeats adotto_repeats.hg38.bed --output-prefix sample
# genotype writes its VCF unsorted, and merge reads sorted, indexed input
bcftools sort -Oz -o sample.sorted.vcf.gz sample.vcf.gz
bcftools index -t sample.sorted.vcf.gz
trgt merge --vcf *.sorted.vcf.gz --genome GRCh38.fa --output-type z --output merged.vcf.gz
```

The session names the TRGT track as its `repeatTrackId`, so the **Layout** row
of the track menu gains a **Repeat** entry. Pick the _ABCA7_ record: each walk
gets a black tick at the allele TRGT called for it (paired by length), red where
the two lie more than 10% apart. At full size, as in the next section, the bars
also divide into motif-length units.

<Figure caption="The ABCA7 VNTR in walk rows, one bar per HPRC haplotype, longest first and packed to fit, with the TRGT record picked under Repeat and the catalogue track marking the VNTR on GRCh38. The black ticks tracing the bar ends are TRGT's calls agreeing with the walks; each red tick is a call more than 10% from its walk." src="/img/pangenome/hprc_abca7_repeat_units.png" />

## Samples where reads and assemblies disagree

To compare seven samples, keep the _ABCA7_ record picked under **Repeat**.
**Samples → Choose samples...**, under the **Layout** row of the graph track's
menu, takes HG00099, HG03688, HG00741, HG02647, HG01943, HG02559 and HG04199 in
that order. Their walks show in pairs, in the order picked, and fall into three
groups:

- HG00099, HG03688 and HG00741 tick at each bar's end: reads and assemblies
  agree.
- HG02647 and HG01943 turn red: TRGT calls each near-homozygous, but a walk sits
  far from both calls (both walks, in HG01943).
- HG02559 and HG04199 each have a walk with no verdict. No read spans one of
  HG02559's alleles, so the tick on HG02559#1 is grey, and HG04199's assembly
  does not span the repeat, so its readout marks that walk partial.

Click the TRGT record to see why. Its sample table gives `AL`, the allele
lengths behind each tick, and `SD`, the number of reads spanning each allele;
one of HG02559's alleles has an `SD` of 0.

<Figure caption="Seven samples' walks through the ABCA7 VNTR in pairs, each bar marked with the allele TRGT called for it as a tick. A tick at the end of its bar is agreement, a red readout is a walk far from its allele, and a grey tick is an allele no read spanned." src="/img/pangenome/hprc_abca7_disagreements.png" />

## The ABCA7 alleles across 94 samples

TRGT writes each allele as its full sequence, so the details are a wall of
`CCCCGTGAGC`. The TandemRepeat plugin's script rewrites the record as `<CNV:TR>`
alleles, each a run of the locus's 51 bp motif:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-plugin-tandem-repeat/main/scripts/trgt-to-cnv-tr.mjs
```

```bash
# the hosted record has no MS field, TRGT's per-run spans, so each allele
# becomes one run of the motif, its copies the allele's length over 51 bp
node trgt-to-cnv-tr.mjs hprc_abca7_trgt.vcf.gz > hprc_abca7_cnvtr.vcf
```

[Sort, bgzip and index](/docs/quickstart_web#vcf) the output, then add it as a
track:

```json addtrack loc=chr19:1,049,000-1,050,500
{
  "trackId": "hprc_abca7_cnvtr",
  "name": "TRGT alleles at ABCA7 as repeat records, 94 HPRC samples",
  "uri": "https://jbrowse.org/demos/hprc/hprc_abca7_cnvtr.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

Open `chr19:1,049,000-1,050,500` and click the record. A **Tandem repeat** card
opens above the details. With 94 samples the card starts on **By allele**: one
bar per allele, longest first. Hover a copy for its allele, that allele's share
and its length.

<Figure caption="The ABCA7 VNTR record's Tandem repeat card, by allele: one bar per TRGT allele as copies of the motif, longest first. The dotted line is GRCh38's allele, and all but a handful of the bars run past it." src="/img/pangenome/hprc_abca7_tandem_repeat_alleles.png" />

Click a bar: the other bars fade and the **Samples** card narrows to the samples
with that allele. **By haplotype** swaps in one bar per called allele, and
hovering a copy names its sample.

## Checking HG00099's allele lengths against TRGT's AL field

HG00099's genotype in the sample table is `1/2` with `AL` `387,3161`. Hovering a
copy in the card names its allele with that allele's length: ALT 1's bar gives
387 bp and ALT 2's 3.2 kb, so the alleles' lengths match what TRGT measured.

## Amylase: counting AMY1 copies per haplotype {#amylase}

A gene array varies the same way a tandem repeat does, in whole gene copies. We
draw the salivary amylase array as the haplotype lanes of
[part 2](/docs/tutorials/pangenome_hprc_haplotypes):

- On the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc), press
  **haplotypes** on the AMY1 row.
- Choose `HG01361.1`, `HG00133.2`, `HG00133.1`, `NA18608.2` and `HG00232.1`
  under **Lanes → Choose lanes...**.

A lane with more copies spans more of its contig in the same width, and its
label gives that span as a multiple of the window.

<Figure caption="The amylase locus from the HPRC page's haplotypes launch with five lanes chosen, one per amylase structure, under the RefSeq genes. Each lane is drawn on the haplotype's contig under its CAT genes; a lane longer than the window gives its span as a multiple in its label." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

To read the lengths, take **Display types → Graph**, enter the five names in
**Settings → Haplotypes**, then pick **Walk rows** under the **Layout** row and
**Uniform** under the **Color** row to draw each haplotype's route as a bar.

<Figure caption="The five haplotypes' walks across the amylase array in walk rows, longest first, under GRCh38's bar, each boxed with its own CAT genes so its AMY1 copies can be counted on the bar. Blue is on GRCh38's path through the graph and purple off it. Each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/hprc_amylase_walk_rows.png" />

HG00133.1 has GRCh38's three _AMY1_ copies and its length, and its bar still
shows a long purple stretch, because the graph routes copies of a duplication
through nodes off GRCh38's path. Count the _AMY1_ boxes on each bar to read copy
number.

Yilmaz et al. (2024) name each structure by its _AMY1_ count:

| Span against GRCh38's | _AMY1_ copies | Structure |
| --------------------- | ------------- | --------- |
| 94 kb shorter         | 1             | H1a       |
| 72 kb shorter         | 2, no _AMY2A_ | H2A0      |
| the same              | 3             | H3r       |
| 94 kb longer          | 5             | H5        |
| 188 kb longer         | 7             | H7        |

## Reproduce it end to end

PacBio publishes TRGT's calls for 100 HPRC samples as a TRGTdb, and the build
turns its _ABCA7_ locus into the VCF this page loads, without re-genotyping
anything. It:

1. downloads the TRGTdb and the repeat catalogue
2. reads the locus's alleles and every sample's calls out of the database
3. writes one VCF record: each allele's sequence as an ALT, and per sample the
   genotype, each allele's length (`AL`) and the reads spanning it (`SD`)

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_abca7_trgt.sh
bash build_hprc_abca7_trgt.sh
```

The TRGTdb is a directory of Parquet tables, and DuckDB reads a locus's calls
straight out of it:

<!-- from: scripts/build_hprc_abca7_trgt.sh -->

```bash
# every sample's allele numbers and spanning-read counts at one locus
duckdb -json -c "
  select regexp_extract(filename, 'sample\.(.*)\.pq', 1) as sample,
    allele_number, spanning_reads
  from read_parquet('hprc_100.tdb/sample.*.pq', filename = true)
  where LocusID = (select LocusID from read_parquet('hprc_100.tdb/locus.pq')
    where chrom = 'chr19' and start = 1049407)"
```

The amylase build draws five haplotypes as a synteny stack, each aligned to the
row under it. It works in four steps, and the commands below run each one on any
gbz-base database and any bgzipped, indexed assembly:

1. Ask the graph where each haplotype crosses two single-copy windows, one
   either side of the array. The distance between the two is that haplotype's
   span across the locus, and the spans fall into the published structures.
2. Pick one haplotype per structure and fetch only the locus from its assembly.
3. Count each haplotype's gene copies, and align it to its neighbour in the
   stack, so a band can match copies GRCh38 lacks.
4. Shift each alignment back onto the whole contig's coordinates.

Get every haplotype's path through a window:

```bash
npx --yes -p @gmod/gbz-base gbz-base-query graph.gbz.db \
  --haplotype-index haplotypes.db \
  --sample GRCh38 --contig chr1 --interval 103540000..103541000 \
  --context 0 --alignments > window.json
```

Fetch one haplotype's copy of the locus:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
samtools faidx HG00232_hap1.fa.gz 'HG00232#1#CM089991.1:103491008-103991760' > HG00232.1.fa
```

Count gene copies, keeping hits over 90% of the gene at 97% identity:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
minimap2 -c -x asm20 -N 50 -p 0.5 HG00232.1.fa genes.fa |
  awk '($4-$3)/$2>=0.9 && $10/$11>=0.97 { c[$1]++ } END { for (g in c) print g, c[g] }'
```

Align two haplotypes to draw them as synteny:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# --secondary=no keeps the primary chain; the secondary ones are paralogous
# copies aligning to each other
minimap2 -c --eqx -x asm20 --secondary=no HG00232.1.fa NA18608.2.fa > adjacent.paf
```

The whole build, for four of the amylase haplotypes above and hg38:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

The script's `config.json` is what this session opens; point `config=` at your
copy:

```json session config=test_data/amylase/config.json
{
  "defaultSession": {
    "name": "Amylase haplotypes from one AMY1 copy to seven, each aligned to the next",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          {
            "assembly": "HG01361.1",
            "loc": "CM089019.1:103,831,655-104,050,048",
            "tracks": ["hprc_genes_HG01361_1"]
          },
          {
            "assembly": "hg38",
            "loc": "chr1:103,520,894-103,832,637",
            "tracks": ["hg38_ncbiRefSeq_ucsc"]
          },
          {
            "assembly": "HG00133.1",
            "loc": "CM090045.1:103,669,666-103,981,330",
            "tracks": ["hprc_genes_HG00133_1"]
          },
          {
            "assembly": "NA18608.2",
            "loc": "CM089849.1:103,796,766-104,203,421",
            "tracks": ["hprc_genes_NA18608_2"]
          },
          {
            "assembly": "HG00232.1",
            "loc": "CM089991.1:103,491,008-103,991,760",
            "tracks": ["hprc_genes_HG00232_1"]
          }
        ],
        "tracks": [
          ["amylase_adjacent"],
          ["amylase_adjacent"],
          ["amylase_adjacent"],
          ["amylase_adjacent"]
        ],
        "color": { "field": "strand" },
        "drawCurves": true,
        "levelHeights": [110, 110, 110, 110]
      }
    ]
  }
}
```

<Figure caption="HG01361.1, hg38, HG00133.1, NA18608.2 and HG00232.1, one AMY1 copy at the top to seven at the bottom, each aligned to the row under it by minimap2 and colored by strand. Each step up in copies opens a wedge over the genes only the longer row has." src="/img/multiway_synteny/hprc_amylase_stack.png" />

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_haplotypes)

## Citations

- Schmidt K, Noureen A, Kronenberg F, Utermann G. Structure, function, and
  genetics of lipoprotein(a). J Lipid Res. 2016;57(8):1339-1359.
  https://doi.org/10.1194/jlr.R067314
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
- De Roeck A, Duchateau L, Van Dongen J, et al. An intronic VNTR affects
  splicing of ABCA7 and increases risk of Alzheimer's disease. Acta Neuropathol.
  2018;135(6):827-837. https://doi.org/10.1007/s00401-018-1841-z
- Dolzhenko E, English A, Dashnow H, et al. Characterization and visualization
  of tandem repeats at genome scale. Nat Biotechnol. 2024;42(10):1606-1614.
  https://doi.org/10.1038/s41587-023-02057-3
- TRGT repeat catalogues and HPRC genotypes, Zenodo.
  https://doi.org/10.5281/zenodo.8329210
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)
- Yilmaz F, et al. Reconstruction of the human amylase locus reveals ancient
  duplications seeding modern-day variation. Science (2024).
  https://doi.org/10.1126/science.adn0609
- Li H. Minimap2: pairwise alignment for nucleotide sequences. Bioinformatics
  (2018). https://doi.org/10.1093/bioinformatics/bty191
