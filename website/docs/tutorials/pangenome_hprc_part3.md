---
title: Pangenome (HPRC) part 3, haplotypes against each other
sidebar_label: Pangenome (HPRC 3, haplotypes against each other)
description:
  HPRC haplotypes as lanes on their own assemblies, read from the release's
  graph in the browser, with the alignment the graph states drawn between
  neighbouring lanes: a deletion at CFH, a C4 module two haplotypes share and
  GRCh38 lacks, and amylase copy number checked against its published classes
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

Two people can share a stretch of sequence that the reference genome lacks, and
a picture drawn along the reference has nowhere to put it. We draw haplotypes
from the Human Pangenome Reference Consortium's release 2 against each other
instead: one lane per haplotype, each on its own assembled chromosome with its
own gene models, all read out of the release's pangenome graph in the browser.
Between two neighbouring lanes the view draws the alignment the graph itself
states, with no aligner run. We read a two-gene deletion at the CFH cluster, a
module of the complement C4 locus that two haplotypes share and GRCh38 lacks,
and the copy number of the salivary amylase gene, which we check against the
structures Yilmaz et al. (2024) named. [Part 1](/docs/tutorials/pangenome_hprc)
reads the graph itself.

:::caution Experimental

The graph view is a beta plugin, and the lanes read the graph as the page draws
them. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which the HPRC page's launches load, so the route
  installs nothing
- for [Reproduce it end to end](#reproduce-it-end-to-end): `samtools` built with
  libcurl, [`minimap2`](https://github.com/lh3/minimap2), Node.js for `npx`,
  `python3`, `pigz` (or `gzip`), and the [JBrowse CLI](/docs/cli) (`jbrowse`)
  for `make-pif`

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose graph is
published as a database that answers a window over HTTP, beside the assemblies
it was built from.

**Read in the browser**

- release 2.1's Minigraph-Cactus graph as a gbz-base database, read by range
  request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our companion index naming that database's haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
- the config the HPRC page's launches open, which declares every haplotype as an
  assembly with its CAT gene models:
  https://jbrowse.org/pangenome/hprc-grch38/config.json

**Read by the offline reproduction**

- the base-level graph, whose walks the whole-genome route unpacks, 63 GB:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the assembly index, one row per haplotype with its bgzipped, faidx-indexed
  FASTA:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
- GRCh38, bgzipped and indexed:
  https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

## Lanes from the graph

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and
press **haplotypes** on the CFH / CFHR row. JBrowse opens on the complement
factor H cluster, `chr1:196,740,001-196,850,000`, with the RefSeq genes over one
lane per haplotype. Each lane is one haplotype's walk through the graph, read
from its gbz-base database in the browser and drawn on that haplotype's own
contig, with its CAT gene models over it. The page picked the haplotypes from
the callset: haplotypes with the same genotype at every structural site in the
window share a configuration, and each lane stands for one configuration, the
most common first.

The band between two lanes is the alignment the graph states for those two
haplotypes. Two walks that pass through one node carry the same bases there, so
the nodes both walks visit, in order, are matches, and the sequence between two
shared stretches is a gap. A configuration carrying the common deletion of
_CFHR3_ and _CFHR1_ (Hughes et al. 2006) draws a shorter lane with no gene
models where the two genes would be, and the band beside it leaves that stretch
of its neighbour unmatched.

<Figure caption="The CFH cluster from the HPRC page's haplotypes launch: the RefSeq genes over one lane per structural configuration, each a haplotype's walk read from the graph and drawn on its own contig with its CAT genes. A lane that lacks CFHR3 and CFHR1 leaves that stretch of its neighbour unmatched in the band between them." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

## A C4 module GRCh38 lacks

The complement _C4_ locus is a tandem array of a 32.7 kb module. A haplotype
carries one to four copies, and the _C4_ gene in each copy is long or short by a
6.4 kb HERV-K insertion (Sekar et al. 2016). GRCh38 carries two copies.

Press **haplotypes** on the C4A / C4B row. Open **Lanes → Choose lanes...** in
the track menu, which lists every haplotype the graph names, press **Untick
shown**, type `HG01978` into the filter box and tick `HG01978.2`, do the same
for `HG02004.2`, and press **Draw these lanes**. Both haplotypes carry three
copies of the module. The band from GRCh38 to HG01978.2 leaves one module
unmatched, and the band between the two haplotypes matches all three, because
both walks pass through the same nodes there.

<Figure caption="C4 from the HPRC page's haplotypes launch with two lanes chosen, HG01978.2 and HG02004.2, each carrying three copies of the C4 module, under the RefSeq genes. The band from GRCh38 leaves the third module unmatched, and the band between the two haplotypes matches it off the nodes both walks share." src="/img/multiway_synteny/hprc_c4_graph_stack.png" />

## Amylase copy number

People carry different numbers of copies of _AMY1_, the salivary amylase gene,
in a tandem array on chr1 that GRCh38 assembles with three (Usher et al. 2015).
Press **haplotypes** on the AMY1 row and choose five lanes the same way, one of
each span class the graph holds across the array: `HG01361.1`, `HG00133.2`,
`HG00133.1`, `NA18608.2` and `HG00232.1`. Drag the lanes by their headers into
that order.

At a tandem array the graph folds the copies onto shared nodes, so every copy a
haplotype carries walks the same few nodes again. A band therefore matches the
copies two neighbours share and draws the rest of the longer lane as a gap, and
each lane's own length carries its copy count.

<Figure caption="The amylase locus from the HPRC page's haplotypes launch with five lanes chosen, one of each span class, under the RefSeq genes. Each lane is drawn on its own contig with its CAT genes, and its length across the array carries its copy count; each band matches the copies two neighbours share and leaves the rest as a gap." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

Walk rows reads that length off. Open the linear view's own menu, take **Launch
→ Graph genome view (this region)**, and pick the gbz-base track,
`HPRC release 2 haplotypes vs GRCh38, read from the graph (gbz-base)`, from the
submenu. The view cuts the window from the database for the five lanes on screen
and opens the cut under the linear view. Pick **Walk rows** from the graph's
**Layout** dropdown and **Uniform** from its **Color** dropdown: each
haplotype's walk becomes a bar on its own bp axis, longest first, and each
readout gives the walk's length and its excess over GRCh38's.

<Figure caption="The five haplotypes' walks across the amylase array in walk rows, longest first, under GRCh38's own bar, blue where GRCh38 carries the same sequence and purple where it does not. Each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/hprc_amylase_walk_rows.png" />

## Check it against the published classes

Yilmaz et al. (2024) name a structure at this locus by its gene counts: `H` and
the _AMY1_ copies, then `A` and `B` with the _AMY2A_ and _AMY2B_ copies where
either is not one. GRCh38 is their H3r.1, the reference arrangement. Across all
of the graph's haplotypes, the spans against GRCh38's fall into classes one
repeat unit apart, and counting the genes of a few haplotypes from each names
them:

| Span against GRCh38's | Haplotypes | _AMY1_ copies | Structure |
| --------------------- | ---------- | ------------- | --------- |
| 94 kb shorter         | 53         | 1             | H1a       |
| 72 kb shorter         | 11         | 2, no _AMY2A_ | H2A0      |
| the same              | 232        | 3             | H3r       |
| 94 kb longer          | 79         | 5             | H5        |
| 188 kb longer         | 22         | 7             | H7        |
| 282 kb longer         | 5          | 9             | H9        |

The other 59 haplotypes with both ends of the array on one contig sit between
these classes or past them. Read each walk-rows readout against the first
column: HG01361.1 lands on H1a, HG00133.2 on H2A0, HG00133.1 on H3r beside
GRCh38, NA18608.2 on H5 and HG00232.1 on H7.

## Reproduce it end to end

The span classes come from the same database the lanes read. `gbz-base-query`
reads a window of it over HTTP and prints one record per haplotype in that
haplotype's own coordinates, so a window left of the array and one right of it
give every haplotype's span across it:

```bash
DB=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
INDEX=https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
# --haplotype-index names each walk's sample, haplotype and contig
# --context 0 reads the window alone, with nothing either side of it
# --alignments prints one record per haplotype, with its own coordinates
npx --yes -p @gmod/gbz-base gbz-base-query $DB --haplotype-index $INDEX \
  --sample GRCh38 --contig chr1 --interval 103540000..103541000 \
  --context 0 --alignments > left.json
```

The gene counts come from sequence, since a lifted annotation can miss a copy
the reference does not have. The script fetches each haplotype's copy of the
locus by range request and aligns GRCh38's copy of each gene to it, counting
every full-length hit:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
HPRC=https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC
# one request against the FASTA's .fai and .gzi
samtools faidx \
  $HPRC/HG00232/assemblies/release2/HG00232_hap1_hprc_r2_v1.0.1.fa.gz \
  'HG00232#1#CM089991.1:103491008-103991760' > HG00232.1.fa
```

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# -N keeps that many secondary hits, which is what the extra copies are
# -p 0.5 lets a copy scoring half of the best one through
minimap2 -c --eqx -x asm20 -N 50 -p 0.5 HG00232.1.fa genes.fa |
  # a copy is a hit over 90% of the gene at 97% identity or better
  awk -F'\t' '($4-$3)/$2>=0.9 && $10/$11>=0.97 { c[$1]++ }
    END { for (g in c) print g, c[g] }'
```

The same script aligns each of the five haplotypes to the one under it with
minimap2:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# -c writes the CIGAR the view draws insertions and deletions from
# --eqx splits the CIGAR's matches from its mismatches
# asm20 tolerates the divergence between paralogous amylase copies, so a chain
#   runs through the array instead of stopping at it
minimap2 -c --eqx -x asm20 HG00232.1.fa NA18608.2.fa |
  # tp:A:P is the pair's primary chain; the secondary ones are amylase copies
  # aligning to each other
  awk -F'\t' '$11>=5000 && /tp:A:P/' > adjacent.regions.paf
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

Its config opens the five rows as a linear synteny view, each on its own contig
with its own gene track:

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

<Figure caption="One haplotype of each common amylase structure from the offline script, one AMY1 copy at the top to seven at the bottom, each with its own gene track and aligned to the row under it by minimap2, colored by strand. The two three-copy rows align straight through; one copy to three and three to five each open a wedge over the genes only the longer row carries." src="/img/multiway_synteny/hprc_amylase_stack.png" />

The same haplotypes can also be placed against GRCh38 whole genome, from the
graph's own walks rather than one window at a time. `gfa_to_pairwise_paf.py`
streams the base-level GFA once and writes each requested haplotype's walk
against the reference walk as PAF, the nodes both traverse as matches:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/gfa_to_pairwise_paf.py
# --max-gap: a record stays on one strand and skips at most this many private
#   bases on either side, and a longer skip starts the next record
# --contig-lengths: a walk states where a contig's piece starts and ends but
#   not the contig's full length, so the assemblies' .fai files supply it
# --chrom-sizes-dir: writes each haplotype's contigs and lengths, which is all
#   an assembly needs when its lane never reads sequence
pigz -dc hprc-v2.1-mc-grch38.gfa.gz \
  | python3 gfa_to_pairwise_paf.py --reference GRCh38#0 \
      --queries HG01109#1,HG00099#1 --max-gap 10000 \
      --contig-lengths contig_lengths.fai \
      --chrom-sizes-dir sizes/ > hprc_multiway_gfa.paf
```

`make-pif` sorts, bgzips and indexes the PAF with a fine tier for the per-base
CIGARs and a coarse one for whole-chromosome zooms:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
jbrowse make-pif hprc_multiway_gfa.paf --csi --out hprc_multiway_gfa.pif.gz
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_multiway_synteny.sh
bash build_hprc_multiway_synteny.sh
```

The script unpacks eight haplotypes in one pass over the 63 GB graph, indexes
the PAF, slices each haplotype's CAT annotation and writes the config we host at
https://jbrowse.org/demos/hprc_multiway/config.json. The companion index the
lanes read beside the database has a script of its own, on
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
- Sekar A, et al. Schizophrenia risk from complex variation of complement
  component 4. Nature (2016). https://doi.org/10.1038/nature16549
- Yilmaz F, et al. Reconstruction of the human amylase locus reveals ancient
  duplications seeding modern-day variation. Science (2024).
  https://doi.org/10.1126/science.adn0609
- Bolognini D, et al. Recurrent evolution and selection shape structural
  diversity at the amylase locus. Nature (2024).
  https://doi.org/10.1038/s41586-024-07911-1
- Usher CL, et al. Structural forms of the human amylase locus and their
  relationships to SNPs, haplotypes and obesity. Nat Genet (2015).
  https://doi.org/10.1038/ng.3340
- Hickey G, et al. Pangenome graph construction from genome alignments with
  Minigraph-Cactus. Nat Biotechnol (2024).
  https://doi.org/10.1038/s41587-023-01793-w
- Li H. Minimap2: pairwise alignment for nucleotide sequences. Bioinformatics
  (2018). https://doi.org/10.1093/bioinformatics/bty191
- [gbz-base](https://github.com/jltsiren/gbz-base), which stores a GBZ as the
  SQLite database a window is range-requested out of.
