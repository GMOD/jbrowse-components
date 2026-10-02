---
title: 'Pangenome (HPRC) part 2: haplotypes against each other'
sidebar_label: Pangenome (HPRC 2, haplotypes against each other)
description:
  Draw HPRC haplotypes as lanes in assembly coordinates, aligned to each other
  by the release's pangenome graph, at a CFH deletion, a C4 duplication, the
  amylase copy-number array and an inversion at 1q21.1
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

We draw human haplotypes from the Human Pangenome Reference Consortium's release
2 side by side, one lane per haplotype in the coordinates of its assembly, and
use the pangenome graph to show where neighbouring lanes match. With that view
we:

- at CFH, find haplotypes missing two genes
- at C4, find two haplotypes sharing a copy GRCh38 lacks
- at amylase, count gene copies and check them against Yilmaz et al. (2024)
- at 1q21.1, tell an inversion the graph flags from an inverted paralog

:::caution Experimental

The graph view is a beta plugin, and the HPRC page lives on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- for [Reproduce it end to end](#reproduce-it-end-to-end): `samtools` built with
  libcurl, [`minimap2`](https://github.com/lh3/minimap2), Node.js for `npx`,
  `python3`, and the [JBrowse CLI](/docs/cli) for `make-pif`

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).

- the graph as a gbz-base database:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our index naming its haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
- the assemblies:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- the release's all-vs-GRCh38 alignment, sliced for the inversion figure:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- our bubble projections of the graph, with the exact build recorded beside
  them: https://jbrowse.org/demos/hprc/README.txt

## The lanes track

The lanes come from one track that reads the release's gbz-base database
directly. The HPRC page's **haplotypes** launch adds it, and this config is the
one to adapt for your own graph, whose database and haplotype index
[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph#haplotype-walks-a-gbz-base-database)
builds. List an assembly per haplotype in `assemblyNames`, and map each to its
PanSN `sample#haplotype` name in `assemblyNameToPanSN`:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "hprc_v2_1_gbz_lanes",
  "name": "HPRC release 2 haplotypes vs GRCh38, read from the graph (gbz-base)",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "GbzBaseSyntenyAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db",
    "haplotypeIndexLocation": {
      "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db"
    },
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG00097.1": "HG00097#1",
      "HG00099.1": "HG00099#1"
    },
    "context": 1000,
    "nodeLimit": 50000
  },
  "displays": [
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

## CFH: a two-gene deletion

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and
press **haplotypes** on the CFH / CFHR row. A lane missing _CFHR3_ and _CFHR1_
(Hughes et al. 2006), such as HG00253's second haplotype, runs from _CFH_
straight on to _CFHR4_.

<Figure caption="The CFH cluster from the HPRC page's haplotypes launch: the RefSeq genes over one lane per structural configuration, each a haplotype's walk read from the graph and drawn on that haplotype's contig under its CAT genes. A lane that lacks CFHR3 and CFHR1 leaves that stretch of its neighbour unmatched in the band between them." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

## C4: a copy GRCh38 lacks

Press **haplotypes** on the C4A / C4B row. In the track menu open **Lanes →
Choose lanes...**, press **Untick shown**, tick `HG01978.2` and `HG02004.2`, and
press **Draw these lanes**.

<Figure caption="C4 from the HPRC page's haplotypes launch with two lanes chosen, HG01978.2 and HG02004.2, each carrying three copies of the C4 module, under the RefSeq genes. The band from GRCh38 leaves the third module unmatched, and the band between the two haplotypes matches it off the nodes both walks share." src="/img/multiway_synteny/hprc_c4_graph_stack.png" />

## Amylase: copy number

Press **haplotypes** on the AMY1 row and choose `HG01361.1`, `HG00133.2`,
`HG00133.1`, `NA18608.2` and `HG00232.1`. A lane carrying more copies spans more
of its contig in the same width, and its label gives that span as a multiple of
the window.

<Figure caption="The amylase locus from the HPRC page's haplotypes launch with five lanes chosen, each from a different span class, under the RefSeq genes. Each lane is drawn on the haplotype's contig under its CAT genes, and the span in each lane's label carries the copy count; each band draws the extra copies of the longer lane as a gap." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

To read the lengths, take **Display types → Graph**, enter the five names in
**Settings → Haplotypes**, then pick **Layout → Walk rows** and **Color →
Uniform**.

<Figure caption="The five haplotypes' walks across the amylase array in walk rows, longest first, under GRCh38's bar, blue where GRCh38 carries the same sequence and purple where it does not. Each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/hprc_amylase_walk_rows.png" />

## Check it against the published classes

Yilmaz et al. (2024) name each structure by its _AMY1_ count. Our five
haplotypes land on H1a, H2A0, H3r, H5 and H7:

| Span against GRCh38's | _AMY1_ copies | Structure |
| --------------------- | ------------- | --------- |
| 94 kb shorter         | 1             | H1a       |
| 72 kb shorter         | 2, no _AMY2A_ | H2A0      |
| the same              | 3             | H3r       |
| 94 kb longer          | 5             | H5        |
| 188 kb longer         | 7             | H7        |

## Inversions

A deletion or an extra copy changes how long a lane is. An inversion keeps the
same sequence and walks it backwards, and `gfatools bubble` flags one as an
`inversion` boolean when a bubble's paths disagree about orientation. Press
**graph** on the HPRC page's CFH / CFHR row, open **Filter by... → Edit
filters...** on the bubbles lane, and enter:

```text
jexl:feature.inversion
```

Type `chr1:144,260,000-144,610,000`, the 1q21.1 locus, where the lane flags one
bubble. The flag fits a polymorphic inversion and an inverted paralog in a
segmental duplication equally, and the graph draws the breakpoints as two
deletion arcs because its edges carry no orientation. The haplotype alignments
tell the two apart. The figure below slices a carrier and a non-carrier out of
HPRC's all-vs-GRCh38 PAF, each with its CAT annotation
([Reproduce it end to end](#reproduce-it-end-to-end) builds it), and the hg38
row between them agrees with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. The pink ribbons are each haplotype's alignment to hg38, and a ribbon that crosses itself is an inversion. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments. The boxed pair on each row is PPIAL4F and PPIAL4E, in opposite orders on the two haplotypes." src="/img/pangenome/hprc_inversion.png" />

## Reproduce it end to end

The amylase build works in four steps, and the commands below run each one on
any gbz-base database and any bgzipped, indexed assembly:

1. Ask the graph where each haplotype crosses two single-copy windows, one
   either side of the array. The distance between the two is that haplotype's
   span across the locus, and the spans fall into the published structures.
2. Pick one haplotype per structure and fetch only the locus from its assembly.
3. Count each haplotype's gene copies, and align it to its neighbour in the
   stack, so each band is an alignment between two haplotypes and can match
   copies GRCh38 lacks.
4. Shift each alignment from the fetched piece's coordinates back onto the whole
   contig, so every row draws in its own assembly's coordinates under its genes.

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

The whole build, for the five haplotypes in the figures above:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

The build script writes the `config.json` that this session opens, with the five
haplotypes' assemblies, their gene tracks and the `amylase_adjacent` alignments.
The session below opens that config; point `config=` at your copy:

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

<Figure caption="One haplotype of each common amylase structure, one AMY1 copy at the top to seven at the bottom, each aligned to the row under it by minimap2 and colored by strand. Each step up in copies opens a wedge over the genes only the longer row carries." src="/img/multiway_synteny/hprc_amylase_stack.png" />

A separate script builds the [inversion figure](#inversions) from release 2's
published all-vs-GRCh38 PAF. A reversed alignment alone proves nothing, because
an assembler can deposit a contig in either orientation, so the test for an
inversion is a block that reverses while the sequence either side of it stays
forward. The script:

1. streams the PAF once, keeping every haplotype's alignments over a window that
   reaches well past the bubble on both sides
2. sorts each haplotype into carrier (bubble reversed, flanks forward),
   non-carrier (forward throughout) or neither, and prints how many fall in each
3. keeps one carrier and one non-carrier, with each one's contig length and CAT
   genes for the drawn window

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_inversion_synteny.sh
bash build_hprc_inversion_synteny.sh
```

## Whole genomes from a GFA

Any GFA with walks converts to PAF against its reference walk, one record per
stretch of shared nodes, for a whole-genome synteny view.

Convert the walks you want:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/gfa_to_pairwise_paf.py
# --contig-lengths: each assembly's .fai, since walks omit contig lengths
gzip -dc graph.gfa.gz | python3 gfa_to_pairwise_paf.py --reference GRCh38#0 \
  --queries HG01109#1,HG00099#1 --contig-lengths contigs.fai > graph.paf
```

Index the PAF for JBrowse:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
jbrowse make-pif graph.paf --csi --out graph.pif.gz
```

The HPRC build downloads the 63 GB release graph, converts eight haplotypes'
walks against GRCh38, indexes the PAF, and fetches each haplotype's CAT genes:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_multiway_synteny.sh
bash build_hprc_multiway_synteny.sh
```

[Its output is hosted](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/hprc_multiway/config.json)
and opens at the CFH deletion, one lane per haplotype under GRCh38.

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph#haplotype-walks-a-gbz-base-database)
builds the gbz-base database for a graph of your own.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_repeats)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/config_guides/grouping_and_ordering)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph, assemblies and CAT annotations this page reads.
- Hughes AE et al.
  [A common CFH haplotype, with deletion of CFHR1 and CFHR3, is associated with lower risk of age-related macular degeneration](https://doi.org/10.1038/ng1890).
  Nature Genetics, 2006.
- Yilmaz F, et al. Reconstruction of the human amylase locus reveals ancient
  duplications seeding modern-day variation. Science (2024).
  https://doi.org/10.1126/science.adn0609
- Li H. Minimap2: pairwise alignment for nucleotide sequences. Bioinformatics
  (2018). https://doi.org/10.1093/bioinformatics/bty191
- Li H. [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand
  flags the inversion.
- [gbz-base](https://github.com/jltsiren/gbz-base), which stores a GBZ as the
  SQLite database a window is range-requested out of.
