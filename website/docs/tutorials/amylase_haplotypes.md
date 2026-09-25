---
title: Synteny between neighbouring haplotypes (the amylase locus)
sidebar_label: Synteny (haplotype to haplotype, amylase)
description:
  Stack one assembled human haplotype of each common amylase structure, from one
  AMY1 copy to seven, each aligned to the haplotype under it, so every band of
  the stack draws the insertions and deletions of a real pairwise alignment
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

People carry different numbers of copies of _AMY1_, the salivary amylase gene,
and the copies sit in a tandem array on chr1 that GRCh38 assembles with three.
We find an assembled haplotype of each common structure, from one copy to seven,
and align each to the one under it. A stack aligned to GRCh38 alone has nowhere
to put a copy GRCh38 lacks. Aligned to its neighbour, a haplotype with two more
copies differs from the one above it by a single insertion, which the linear
synteny view draws from the alignment's CIGAR.

## Prerequisites

- `samtools`, built with libcurl, to fetch a region of a remote FASTA
- [`minimap2`](https://github.com/lh3/minimap2)
- Node.js, for `npx`
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose assemblies
are published as bgzipped, faidx-indexed FASTA, so one locus comes out of a 3 Gb
assembly by range request, and whose graph is published as a database that
answers a window over HTTP.

- the release's Minigraph-Cactus graph as a gbz-base database, read by range
  request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- the companion index that names the database's haplotypes, which
  [part 3 of the HPRC tutorial](/docs/tutorials/pangenome_hprc_part3#the-lanes-from-the-database)
  builds:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
- the assembly index, one row per haplotype with its FASTA, which the
  [HPRC hub on genomes.jbrowse.org](https://genomes.jbrowse.org/hubs/HPRC/)
  lists as genomes to open:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
- HG01361 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG01361/assemblies/release2/HG01361_pat_hprc_r2_v1.0.1.fa.gz
- HG00133 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00133/assemblies/release2/HG00133_hap1_hprc_r2_v1.0.1.fa.gz
- NA18608 haplotype 2:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/NA18608/assemblies/release2/NA18608_hap2_hprc_r2_v1.0.1.fa.gz
- HG00232 haplotype 1:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/HG00232/assemblies/release2/HG00232_hap1_hprc_r2_v1.0.1.fa.gz
- GRCh38, bgzipped and indexed:
  https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz
- every release 2 haplotype as an assembly of its chromosome lengths with its
  CAT gene annotation, one model per gene:
  https://jbrowse.org/pangenome/hprc-grch38/config.json
- eight of those haplotypes aligned to GRCh38, which the
  [pangenome graph synteny tutorial](/docs/tutorials/hprc_multiway_synteny)
  builds: https://jbrowse.org/demos/hprc_multiway/config.json
- hg38's RefSeq genes, from
  [genomes.jbrowse.org's hg38](https://genomes.jbrowse.org/ucsc/hg38/):
  https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz

## The locus under GRCh38 alone

The [pangenome graph synteny tutorial](/docs/tutorials/hprc_multiway_synteny)
stacks eight HPRC haplotypes under hg38, each lane on its own contig with its
own gene models. Open that stack over the amylase array:

```json session config=https://jbrowse.org/demos/hprc_multiway/config.json
{
  "defaultSession": {
    "name": "The amylase locus across eight HPRC haplotypes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:103,520,894-103,832,637",
        "tracks": [
          "hg38_ncbiRefSeq_ucsc",
          {
            "trackId": "hprc_multiway",
            "type": "MultiWaySyntenyDisplay",
            "height": 600
          }
        ]
      }
    ]
  }
}
```

The reference row holds _AMY2B_, _AMY2A_ and three _AMY1_ copies, _AMY1A_,
_AMY1B_ and _AMY1C_. The lanes' own annotations disagree with it in both
directions: HG00097.1 and HG00099.1 carry two _AMY1_ copies and HG00128.1 five,
its lane drawn at half the scale of the others to fit them. Every alignment in
this track joins a haplotype to GRCh38, so the copies HG00128.1 holds beyond the
reference's three align to nothing, and the ribbon between two haplotype lanes
is composed through the reference row.

<Figure caption="The amylase locus on hg38 over eight HPRC haplotype lanes, each drawing its own CAT gene models. The two lanes at the bottom hold fewer amylase genes than the reference row, and the HG00128.1 lane at the top holds more and draws at a smaller scale." src="/img/multiway_synteny/hprc_amylase_lanes.png" />

## A haplotype of each structure

[Yilmaz et al. 2024](https://doi.org/10.1126/science.adn0609) name a structure
at this locus by its gene counts: `H` and the _AMY1_ copies, then `A` and `B`
with the _AMY2A_ and _AMY2B_ copies where either is not one. GRCh38 is their
H3r.1, the reference arrangement, and the common structures run from H1a, a
single copy, up through H5 and H7 in steps of two. None of the eight lanes above
is an H1a or an H7.

The release's graph finds them among all of its haplotypes. A haplotype's walk
crosses any single-copy window once, so its coordinate at a window left of the
array and at one right of it gives its span across the array. `gbz-base-query`
reads a window of the published database over HTTP and prints one record per
haplotype, in that haplotype's own coordinates:

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

The [script](#reproduce-it-end-to-end) runs it again at `103800000..103801000`
and subtracts. The spans fall into classes one repeat unit apart, and counting
the genes of a few haplotypes from each ([below](#check-it-against-the-paf))
names them:

| Span against GRCh38's | Haplotypes | _AMY1_ copies | Structure |
| --------------------- | ---------- | ------------- | --------- |
| 94 kb shorter         | 53         | 1             | H1a       |
| 72 kb shorter         | 11         | 2, no _AMY2A_ | H2A0      |
| the same              | 232        | 3             | H3r       |
| 94 kb longer          | 79         | 5             | H5        |
| 188 kb longer         | 22         | 7             | H7        |
| 282 kb longer         | 5          | 9             | H9        |

The other 59 haplotypes with both windows on one contig sit between these
classes or past them.

## Aligning each haplotype to its neighbour

Five rows make the stack, in order of _AMY1_ copies: HG01361.1 with one, GRCh38
and HG00133.1 with three, NA18608.2 with five and HG00232.1 with seven. The two
coordinates from the step above frame each haplotype's copy of the locus, and
`samtools faidx` reads a region of a remote bgzipped FASTA through its `.fai`
and `.gzi`, so each row is one request:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
HPRC=https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC
samtools faidx \
  $HPRC/HG00232/assemblies/release2/HG00232_hap1_hprc_r2_v1.0.1.fa.gz \
  'HG00232#1#CM089991.1:103491008-103991760' > HG00232.1.fa
```

Each row is then aligned to the row under it:

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

The records come out in the coordinates of the fetched pieces. The
[script](#reproduce-it-end-to-end) adds each region's start back on and writes
each contig's full length from the assembly's `.fai`, so the PAF names whole
contigs and the rows draw on the assemblies' own coordinates, under gene tracks
made for them.

## The track

One `SyntenyTrack` backs every band of the stack. The PAF names its sequences
PanSN-style, `HG00232#1#<contig>`, and `assemblyNameToPanSN` maps each JBrowse
assembly to its prefix, so the adapter hands a band the records joining its two
rows:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "amylase_adjacent",
  "name": "Amylase locus, each haplotype against the next (minimap2)",
  "assemblyNames": ["HG01361.1", "hg38", "HG00133.1", "NA18608.2", "HG00232.1"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "amylase_adjacent.paf",
    "assemblyNames": [
      "HG01361.1",
      "hg38",
      "HG00133.1",
      "NA18608.2",
      "HG00232.1"
    ],
    "assemblyNameToPanSN": {
      "HG01361.1": "HG01361#1",
      "hg38": "GRCh38#0",
      "HG00133.1": "HG00133#1",
      "NA18608.2": "NA18608#2",
      "HG00232.1": "HG00232#1"
    }
  }
}
```

## One copy to seven, each against the next

The session opens the five rows in copy-number order, each on its own contig
with its own gene track, colored by strand:

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

The second band joins GRCh38 to another three-copy haplotype and runs straight
across the locus, with one inverted match where the array's two oppositely
oriented _AMY1_ copies align to each other. The first band joins one copy to
three and the third joins three to five, and each opens a single wedge on the
side with more copies, over two of its _AMY1_ genes. In the fourth band, five
copies to seven, the two arrays match up in more than one way: a forward
alignment covers each end, an inverted one crosses between them, and a stretch
of the seven-copy row is left to no forward alignment.

<Figure caption="One haplotype of each common amylase structure, from one AMY1 copy at the top to seven at the bottom, each with its own gene track and each aligned to the row under it, colored by strand. The two three-copy rows align straight through. One copy to three and three to five each open a wedge over the genes only the longer row carries." src="/img/multiway_synteny/hprc_amylase_stack.png" />

## Check it against the PAF

Each wedge is one CIGAR operation, so the file states its size. Print the
largest insertion or deletion of each record:

```bash
python3 - <<'EOF'
import re
for line in open('amylase_adjacent.paf'):
    f = line.rstrip('\n').split('\t')
    cigar = next(t for t in f[12:] if t.startswith('cg:Z:'))
    ops = [(int(n), op) for n, op in re.findall(r'(\d+)([ID])', cigar)]
    print(f[0].split('#')[0], f[5].split('#')[0], f[4], max(ops))
EOF
```

The HG01361 to GRCh38 record and the HG00133 to NA18608 record each hold a
deletion of 94,138 bp, the step between the span classes. No record of the
GRCh38 to HG00133 band holds an operation past 838 bp, and none of the NA18608
to HG00232 band does either, since there the step falls between records.

The gene counts behind the row order come from sequence too. A lifted annotation
can miss a copy the reference does not have, so GRCh38's copy of each gene is
aligned to a row and every full-length hit counted:

<!-- from: scripts/build_amylase_haplotypes.sh -->

```bash
# -N keeps that many secondary hits, which is what the extra copies are
# -p 0.5 lets a copy scoring half of the best one through
minimap2 -c --eqx -x asm20 -N 50 -p 0.5 HG00232.1.fa genes.fa |
  # a copy is a hit over 90% of the gene at 97% identity or better
  awk -F'\t' '($4-$3)/$2>=0.9 && $10/$11>=0.97 { c[$1]++ }
    END { for (g in c) print g, c[g] }'
```

| Row       | _AMY1_ | _AMY2A_ | _AMY2B_ |
| --------- | ------ | ------- | ------- |
| HG01361.1 | 1      | 1       | 1       |
| GRCh38    | 3      | 1       | 1       |
| HG00133.1 | 3      | 1       | 1       |
| NA18608.2 | 5      | 1       | 1       |
| HG00232.1 | 7      | 1       | 1       |

GRCh38 comes back with the three _AMY1_ copies it is annotated with.

## Pair alignments read off the graph {#read-off-the-graph}

The HPRC graph already aligns every haplotype to every other: two walks through
one node carry the same bases. At a locus the graph resolves, a stack needs no
FASTA and no aligner. The complement _C4_ locus is one. A haplotype carries one
to four copies of a 32.7 kb module, and the _C4_ gene in each copy is long or
short by a 6.4 kb HERV-K insertion (Sekar et al. 2016).

`gbz-base-query` reads the window out of the graph database once and writes each
row against the row under it, on each haplotype's own coordinates:

```bash
GBZ_DB=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
GBZ_INDEX=https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db
# --stack lists the rows from the top, and each is aligned to the next: a node
#   both walks visit becomes a run of =, and the bases between two shared nodes
#   are aligned into =, X, I and D, so a module-sized insertion stays inside
#   one record, where the view draws it from the CIGAR
# --contig-lengths fills the PAF's two length columns, which a window of the
#   graph does not hold
npx --yes -p @gmod/gbz-base gbz-base-query $GBZ_DB --haplotype-index $GBZ_INDEX \
  --sample GRCh38 --contig chr6 --interval 31940000..32090000 --context 0 \
  --stack 'HG01978#2,HG02004#2,GRCh38#0,HG02818#1,HG00146#1' \
  --contig-lengths contig_lengths.tsv > adjacent.paf
```

The rows are two haplotypes with three modules, GRCh38 with two, HG02818.1 with
two and a short _C4B_, and HG00146.1 with one:

```json session config=test_data/hprc_c4_stack/config.json
{
  "defaultSession": {
    "name": "C4 haplotypes, each against the next, from the graph",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          {
            "assembly": "HG01978.2",
            "loc": "CM089273.1:31,872,045-32,055,037",
            "tracks": ["hprc_genes_HG01978_2"]
          },
          {
            "assembly": "HG02004.2",
            "loc": "JBHDRU010000054.1:31,876,435-32,059,471",
            "tracks": ["hprc_genes_HG02004_2"]
          },
          {
            "assembly": "hg38",
            "loc": "chr6:31,939,722-32,090,034",
            "tracks": ["hg38_ncbiRefSeq_ucsc"]
          },
          {
            "assembly": "HG02818.1",
            "loc": "JAHEOS020000050.1:31,980,558-32,124,509",
            "tracks": ["hprc_genes_HG02818_1"]
          },
          {
            "assembly": "HG00146.1",
            "loc": "CM090015.1:31,912,959-32,024,178",
            "tracks": ["hprc_genes_HG00146_1"]
          }
        ],
        "tracks": [
          ["graph_adjacent"],
          ["graph_adjacent"],
          ["graph_adjacent"],
          ["graph_adjacent"]
        ],
        "color": { "field": "strand" },
        "drawCurves": true,
        "levelHeights": [110, 110, 110, 110]
      }
    ]
  }
}
```

<Figure caption="Five haplotypes across C4, each with its own gene track and each aligned to the row under it off the graph's walks. The two three-module rows at the top align straight through. Below them the wedges are the module GRCh38 lacks, the HERV-K insertion inside GRCh38's C4B, and, in two pieces, the module the one-module row lacks." src="/img/multiway_synteny/hprc_c4_graph_stack.png" />

The top band runs through a module GRCh38 does not have. Open the same track in
HG02004.2's own view at `JBHDRU010000054.1:31,942,330-31,942,580`, inside that
module, where a synteny track draws each aligned haplotype as a row:

<Figure caption="The synteny track in HG02004.2's own view, inside the module GRCh38 lacks. The HG01978.2 row marks each substituted base, insertion and deletion; the hg38 row is one deletion across the whole window." src="/img/multiway_synteny/hprc_c4_graph_bases.png" />

The [check above](#check-it-against-the-paf) on `adjacent.paf` prints the module
as one 32,738 bp insertion and the HERV-K as 6,367 bp. The last record holds the
same module as a short one and its HERV-K, 26,370 and 6,368 bp.

The script wraps the command and writes the config. REGION and ROWS pick the
window and the stack, so the amylase rows from the top of the page go through it
as well. There the graph folds the paralogous copies onto shared nodes, and the
rows are aligned by comparing their bases through the array.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_graph_haplotype_stack.sh
# REGION is on GRCh38; ROWS is the stack from the top, GRCh38#0 for the reference
REGION=chr6:31940000-32090000 \
  ROWS='HG01978#2 HG02004#2 GRCh38#0 HG02818#1 HG00146#1' \
  bash build_graph_haplotype_stack.sh
# the amylase stack:
#   REGION=chr1:103539800-103801379
#   ROWS='HG01361#1 GRCh38#0 HG00133#1 NA18608#2 HG00232#1'
```

## Reproduce it end to end

The script reads the two windows from the graph database, fetches the five
regions, aligns the four adjacent pairs, lifts the records onto whole contigs,
counts the genes and writes the config; see [Prerequisites](#prerequisites). Its
manifest is one row per haplotype, the assembly name, the contig's PanSN name, a
FASTA and a region, and the row order is the stack order, so another locus or
another set of haplotypes is an edit to that table. `locus_spans.tsv` lists
every haplotype's span, to pick other rows from.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_amylase_haplotypes.sh
bash build_amylase_haplotypes.sh
```

## See also

- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_graph_reading)

## References

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
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph, assemblies and CAT annotations this page reads.
- Li H. Minimap2: pairwise alignment for nucleotide sequences. Bioinformatics
  (2018). https://doi.org/10.1093/bioinformatics/bty191
