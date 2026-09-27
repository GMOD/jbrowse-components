---
title: Pangenome (HPRC) part 3, haplotypes against each other
sidebar_label: Pangenome (HPRC 3, haplotypes against each other)
description:
  Draw HPRC haplotypes as lanes in their own coordinates, aligned to each other
  by the release's pangenome graph, at a CFH deletion, a C4 duplication and the
  amylase copy-number array
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

We draw human haplotypes from the Human Pangenome Reference Consortium's release
2 side by side, each as a lane in its own coordinates, and use the pangenome
graph to show where neighbouring lanes match. With that view we:

- at CFH, find haplotypes missing two genes
- at C4, find two haplotypes sharing a copy GRCh38 lacks
- at amylase, count gene copies and check them against Yilmaz et al. (2024)

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- for [Reproduce it end to end](#reproduce-it-end-to-end): `samtools` built with
  libcurl, [`minimap2`](https://github.com/lh3/minimap2) and Node.js for `npx`

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).

- the graph as a gbz-base database:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our index naming its haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
- the assemblies:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv

## CFH: a two-gene deletion

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and
press **haplotypes** on the CFH / CFHR row. Lanes missing _CFHR3_ and _CFHR1_
(Hughes et al. 2006) are shorter.

<Figure caption="The CFH cluster from the HPRC page's haplotypes launch: the RefSeq genes over one lane per structural configuration, each a haplotype's walk read from the graph and drawn on that haplotype's contig under its CAT genes. A lane that lacks CFHR3 and CFHR1 leaves that stretch of its neighbour unmatched in the band between them." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

## C4: a copy GRCh38 lacks

Press **haplotypes** on the C4A / C4B row. In the track menu open **Lanes →
Choose lanes...**, press **Untick shown**, tick `HG01978.2` and `HG02004.2`, and
press **Draw these lanes**.

<Figure caption="C4 from the HPRC page's haplotypes launch with two lanes chosen, HG01978.2 and HG02004.2, each carrying three copies of the C4 module, under the RefSeq genes. The band from GRCh38 leaves the third module unmatched, and the band between the two haplotypes matches it off the nodes both walks share." src="/img/multiway_synteny/hprc_c4_graph_stack.png" />

## Amylase: copy number

Press **haplotypes** on the AMY1 row and choose `HG01361.1`, `HG00133.2`,
`HG00133.1`, `NA18608.2` and `HG00232.1`. A longer lane carries more copies.

<Figure caption="The amylase locus from the HPRC page's haplotypes launch with five lanes chosen, one of each span class, under the RefSeq genes. Each lane is drawn on the haplotype's contig under its CAT genes, and the lane's length across the array carries the copy count; each band draws the extra copies of the longer lane as a gap." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

To read the lengths, take **Display types → Graph**, enter the five names in
**Settings → Haplotypes**, then pick **Layout → Walk rows** and **Color →
Uniform**.

<Figure caption="The five haplotypes' walks across the amylase array in walk rows, longest first, under GRCh38's bar, blue where GRCh38 carries the same sequence and purple where it does not. Each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/hprc_amylase_walk_rows.png" />

## Check it against the published classes

Yilmaz et al. (2024) name each structure by its _AMY1_ count. Our five
haplotypes land on H1a, H2A0, H3r, H5 and H7:

| Span against GRCh38's | Haplotypes | _AMY1_ copies | Structure |
| --------------------- | ---------- | ------------- | --------- |
| 94 kb shorter         | 53         | 1             | H1a       |
| 72 kb shorter         | 11         | 2, no _AMY2A_ | H2A0      |
| the same              | 232        | 3             | H3r       |
| 94 kb longer          | 79         | 5             | H5        |
| 188 kb longer         | 22         | 7             | H7        |
| 282 kb longer         | 5          | 9             | H9        |

## Reproduce it end to end

The commands below work on any gbz-base database and any bgzipped, indexed
assembly.

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
minimap2 -c --eqx -x asm20 HG00232.1.fa NA18608.2.fa > adjacent.paf
```

The whole build:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

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

<Figure caption="One haplotype of each common amylase structure from the offline script, one AMY1 copy at the top to seven at the bottom, each under its gene track and aligned to the row under it by minimap2, colored by strand. The two three-copy rows align straight through; one copy to three and three to five each open a wedge over the genes only the longer row carries." src="/img/multiway_synteny/hprc_amylase_stack.png" />

To host your own graph, see
[hosting your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database).

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part5)
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
- [gbz-base](https://github.com/jltsiren/gbz-base), which stores a GBZ as the
  SQLite database a window is range-requested out of.
