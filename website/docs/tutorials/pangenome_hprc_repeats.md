---
title: 'Pangenome (HPRC) part 3: repeat lengths across haplotypes'
sidebar_label: Pangenome (HPRC pt 3, repeat lengths)
description:
  Count kringle copies in LPA and tell their two repeat types apart, measure the
  ABCA7 VNTR in HPRC haplotypes straight from the graph's walks, then set TRGT's
  read-based genotypes on the same bars and find the samples where reads and
  assemblies disagree
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A tandem repeat is one sequence copied head to tail, and the number of copies
varies from person to person. An assembled haplotype spans the whole array, so
the Human Pangenome Reference Consortium's release 2 graph holds each
haplotype's repeat at its full length. We read two repeats off it, one bar per
haplotype:

- at _LPA_, count copies of the kringle IV type 2 repeat and tell its two repeat
  types apart
- at _ABCA7_, measure an intronic VNTR and set PacBio's read-based TRGT
  genotypes on the same bars
- find the samples where the assemblies and the reads disagree

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
  [DuckDB](https://duckdb.org)

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) and PacBio's TRGT
genotypes of 100 of its samples (Dolzhenko et al. 2024):

- our tabix index files cut from the release's rGFA graph, with the build
  recorded beside them: https://jbrowse.org/demos/hprc/README.txt
- the release 2.1 gbz-base database, one walk per haplotype, read by range
  request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our companion index naming that database's haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.f3.db
- TRGT's genotypes over the Genome in a Bottle repeat catalogue, a TRGTdb:
  https://zenodo.org/records/8329210/files/adotto_hprc.tdb.tar
- the catalogue itself:
  https://zenodo.org/records/8329210/files/adotto_repeats.hg38.bed.gz
- the _ABCA7_ record of those genotypes, as a TRGT VCF:
  https://jbrowse.org/demos/hprc/hprc_abca7_trgt.vcf.gz

## Reading the LPA kringle repeat as a graph

_LPA_ contains a tandem array of kringle IV type 2 (KIV-2) copies, tied to
lipoprotein(a) levels, a heart-disease risk factor (Schmidt et al. 2016). Open
the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and press
**graph** on the LPA row. JBrowse opens on `chr6:160,525,000-160,655,000`. Pick
**Layout → Force-directed layout** from the graph track's menu and tick **Mark
bubbles**. The strip along the top of the track draws each reference segment at
its position on the ruler, in the colour of its node below.

<Figure caption="The LPA window with the RefSeq genes, UniProt's kringle domains and the HPRC bubbles above the force-directed graph track. The kringle array is the knot of loops in the middle, haloed and labelled as a repeat array, and LPA is pinned under the backbone with its exons along it." src="/img/pangenome/hprc_lpa_kiv2.png" />

Each loop in the knot is a different number of copies. Click the array's purple
label to lay the bubble's segments out alone, with a button back to the window.
The rGFA records segments and links; each haplotype's route through them, its
walk, is in the release's gbz-base database, read next.

## Eight haplotypes' routes through the KIV-2 array {#one-haplotypes-copies}

A **walk** is one haplotype's route through the graph, and the release publishes
one per haplotype as a gbz-base database. Type the array's window,
`chr6:160,616,002-160,646,753`, put the rGFA graph track back to a row of
segments with **Display types → Feature display**, and turn the gbz-base track
on from the track selector. **Display types → Graph** in its track menu draws
that same track as a graph of the walks. Enter the eight lanes it drew in the
**Haplotypes** field of **Settings**,
`HG00097.1, HG00099.1, HG00128.1, HG00133.1, HG01109.1, HG01123.1, HG01960.1, HG02055.1`,
and pick **Layout → Force-directed layout**.

A node draws thicker the more walks visit it (as in Bandage), so the shared
backbone is the thick line and copies on one haplotype are thin loops. Pick
`HG00133` under **Walk**: its route stays dark while everything else fades, and
a readout gives its length against the reference walk.

<Figure caption="The eight-haplotype KIV-2 cut under the same window's genes, bubbles and rGFA segments, with HG00133 picked under Walk. The labelled loop is copies HG00133 walks and GRCh38 does not, its links drawn dark, and the readout states the walk's excess over GRCh38." src="/img/pangenome/graph_kiv2_walks.png" />

Pick **Layout → Walk rows** and **Color → Uniform**: each walk becomes a bar,
longest first, blue on GRCh38's path through the graph and purple off it. At
KIV-2 each copy a haplotype adds is a run of new nodes, so the added copies read
as its purple stretch.

<Figure caption="The eight-haplotype KIV-2 cut in walk rows, one bar per haplotype under GRCh38's, longest first, under LPA with the KIV-2 bubble boxed in the bubbles track. The purple stretch of each bar is kringle copies off GRCh38's path, and each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/graph_kiv2_walk_rows.png" />

Click the KIV-2 bubble boxed in the bubbles track. Its details give
`shortestAlleleLength` and `longestAlleleLength`, the shortest and longest
routes the rGFA holds there. Every bar in walk rows falls between them, and
GRCh38's, with no purple, is the shortest of the nine.

## Telling KIV-2's two repeat units apart {#which-copy-is-which}

Walk rows give each haplotype's copy count. KIV-2's copies are near-identical,
so the aligner's choice of which GRCh38 copy an extra one matches is arbitrary,
and the walks cannot say which copy is which. A record that lists each
haplotype's copies can.

We host a record of the eight haplotypes' KIV-2 copies as a track. It holds a
single VCF 4.5 `<CNV:TR>` record at the array: each allele lists its runs of one
unit and every copy's length, and a phased genotype puts each allele on its
haplotype:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc_kiv2_copies",
  "name": "LPA KIV-2 copies by unit, eight HPRC haplotypes",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/hprc/hprc_kiv2_copies.vcf"
}
```

Turn the track on, right-click the record and choose **Show repeat copies**. The
TandemRepeat plugin, which the hosted config loads beside the graph plugin,
opens a view with one bar per haplotype, each on a separate bp axis, and each
copy coloured by its unit.

<Figure caption="The KIV-2 record under LPA, and the view its right-click item opens: one bar per haplotype, each copy coloured by its unit. GRCh38's short array has one copy of unit 2, and HG00133's runs far past the dashed line that marks GRCh38's length, all of unit 1." src="/img/pangenome/hprc_kiv2_copies_by_unit.png" />

The copies across the nine arrays form two units, and copies of one unit differ
from each other less than the two units do. Unit 2 opens most of the HPRC arrays
and sits fourth in GRCh38's. The copy counts agree with the walk lengths in walk
rows.

We wrote the KIV-2 record from the gbz-base cut of the walks above. To write one
for your own array, we'll first cut the walks over it out of the gbz-base
database as GFA, with enough context that the cut reaches the reference nodes on
either side:

```bash
# the reference walk is PanSN GRCh38#0#chr6; the interval is the array
gbz-base query --sample GRCh38 --contig chr6 -i 160616002..160646753 \
  --context 1000 graph.gbz.db > cut.gfa
```

[`tandem-repeat-vcf.mjs`](https://github.com/GMOD/jbrowse-plugin-tandem-repeat/blob/main/scripts/tandem-repeat-vcf.mjs)
splits each walk into copies wherever the reference array's first 24 bases
recur, and groups copies within 1% of each other into a unit. It takes the cut
and a BED row naming the array on the reference (chrom, start, end, name):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-plugin-tandem-repeat/main/scripts/tandem-repeat-vcf.mjs
```

```bash
printf 'chr6\t160616002\t160646753\tKIV-2\n' > arrays.bed
node tandem-repeat-vcf.mjs cut.gfa --bed arrays.bed --name KIV-2 > kiv2.vcf
```

A repeat finder's output draws as these bars too once it is written as a
`<CNV:TR>` record with each allele's runs and copy lengths.

## Measuring the ABCA7 VNTR in every haplotype

An intron of _ABCA7_ holds a VNTR (variable-number tandem repeat) tied to
Alzheimer's disease risk (De Roeck et al. 2018). Each haplotype's walk length
comes from its assembly, and PacBio measured the same repeat from HiFi reads in
100 HPRC samples. The session below opens the genes, the catalogue's VNTR row,
the TRGT genotypes and the gbz-base graph track in **Walk rows** layout with
**Uniform** color, cut for every haplotype (an empty `subgraphHaplotypes`):

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

Each row is one haplotype's walk between the flanking reference nodes, blue on
GRCh38's path and purple off it; GRCh38's walk is the short bar at the top.

## Overlaying TRGT's read-based genotypes on the ABCA7 bars

[TRGT](https://github.com/PacificBiosciences/trgt) is PacBio's tandem repeat
genotyper for HiFi reads. We host its _ABCA7_ call as this track:

```json addtrack
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

The session names the TRGT track as its `repeatTrackId`, so a **Repeat** entry
joins **Walk** in the track menu. Pick the _ABCA7_ record: the bars divide into
motif-length units, each walk gets a black tick at the allele TRGT called for it
(paired by length), and a readout turns red past 10% apart.

<Figure caption="The ABCA7 VNTR in walk rows, one bar per HPRC haplotype, longest first, with the TRGT record picked under Repeat. The catalogue track marks the VNTR on GRCh38, whose walk is the short blue bar at the top. Each bar is tiled by the motif, and a black tick marks the allele TRGT called for that walk. A red readout is a walk far from its allele." src="/img/pangenome/hprc_abca7_repeat_units.png" />

## Samples where reads and assemblies disagree

Show seven samples by editing the graph display in the ABCA7 session. List
HG00099, HG03688, HG00741, HG02647, HG01943, HG02559 and HG04199 in
`subgraphHaplotypes`, list the same names in `walkRowSamples` to show their
walks in pairs in that order, and set `repeatKey` to `chr19:1049406-1050096`.
The samples fall into three groups:

- HG00099, HG03688 and HG00741 tick at each bar's end: reads and assemblies
  agree.
- HG02647 and HG01943 turn red: TRGT calls each near-homozygous while the graph
  has a haplotype neither call reaches (two, in HG01943).
- HG02559 and HG04199 each have a walk with no verdict. No read spans one of
  HG02559's alleles, so the tick on HG02559#1 is grey, and HG04199's assembly
  does not span the repeat, so its readout marks that walk partial.

<Figure caption="Seven samples' walks through the ABCA7 VNTR in pairs, each bar marked with the allele TRGT called for it as a tick. A tick at the end of its bar is agreement, a red readout is a walk far from its allele, and a grey tick is an allele no read spanned." src="/img/pangenome/hprc_abca7_disagreements.png" />

## Why HG02559's ABCA7 tick is grey

Click the TRGT record. Its sample table gives `AL`, the allele lengths behind
each tick, and `SD`, the number of reads spanning each allele. One of HG02559's
alleles has an `SD` of 0, the grey tick in the figure above.

## The ABCA7 alleles across 94 samples

TRGT writes each allele as its full sequence, so the record above lists well
over a hundred ALT alleles, some of them kilobases long, and the details are a
wall of `CCCCGTGAGC`. The TandemRepeat plugin's script rewrites the same record
as `<CNV:TR>` alleles, each a run of the locus's 51 bp motif:

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

```json addtrack
{
  "trackId": "hprc_abca7_cnvtr",
  "name": "TRGT alleles at ABCA7 as repeat records, 94 HPRC samples",
  "uri": "https://jbrowse.org/demos/hprc/hprc_abca7_cnvtr.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

Open `chr19:1,049,000-1,050,500` and click the record. A **Tandem repeat** card
opens above the details. With 94 samples the card starts on **By allele**: one
bar per allele, each labelled with its share of the 188 called alleles, most
common first.

<Figure caption="The ABCA7 VNTR record's Tandem repeat card, by allele. Each bar is one of TRGT's alleles as copies of the 51 bp motif, most common first, with its share of the called alleles at left and its length and copy count at right." src="/img/pangenome/hprc_abca7_tandem_repeat_alleles.png" />

Almost every allele is called once, and no sample has GRCh38's allele. Click the
ALT 1 bar: the other bars fade and the **Samples** card narrows to the samples
with it. **By haplotype** swaps the bars for the first 30 called alleles, each
labelled with its sample.

## Checking HG00099's allele lengths against TRGT's AL field

HG00099's genotype in the sample table is `1/2` with `AL` `387,3161`. The card's
ALT 1 bar reads 387 bp and its ALT 2 bar reads 3.2 kb, so the alleles' lengths
match what TRGT measured.

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
