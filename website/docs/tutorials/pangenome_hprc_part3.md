---
title: Pangenome (HPRC) part 3, every haplotype in its own coordinates
sidebar_label: Pangenome (HPRC, part 3)
description:
  The multiple alignment HPRC release 2's graph and callset both come from, then
  the same haplotypes off GRCh38's axis and on their own contigs
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** parts [1](/docs/tutorials/pangenome_hprc) and
[2](/docs/tutorials/pangenome_hprc_part2) draw everything on GRCh38's axis,
which is what makes hundreds of haplotypes comparable in one lane and what
leaves each assembly's own coordinates out of the picture. This page starts from
the multiple alignment both products were derived from, then puts each haplotype
back on its own contigs, first from a gene table and then straight out of the
graph, and ends on the one donor that has a published reference of its own.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- [part 1](/docs/tutorials/pangenome_hprc), whose session this page adds to:
  hg38 with its genes, and the rGFA segments track loaded on it
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the tracks that use `GbzBaseSyntenyAdapter` and `RgfaTabixAdapter`; every
  other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), to slice the annotations the lanes carry
- `bedtools`, for the repeat-density lanes
- UCSC's `bedGraphToBigWig`, for the repeat-density lanes
- UCSC's `bigBedToBed`, for the repeat-density lanes

Both UCSC binaries are
[single-binary downloads](https://hgdownload.soe.ucsc.edu/admin/exe/), and
`build_repeat_density.sh`'s header carries the curl line for each.

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose multiple
alignment and gbz-base database are read straight off S3, beside T2T-CHM13 from
UCSC and the companion index we host.

**The alignment and the assemblies**

- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz
- the release's all-vs-GRCh38 alignment, sliced for the CFHR synteny figure:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

**The graph as a walk database**

- release 2.1's Minigraph-Cactus graph as a gbz-base database, 10 GB, read by
  range request and never downloaded:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- the `.gbz` that database was built from, which is also what names its
  haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- our companion haplotype index for that database, which HPRC does not publish:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

**T2T-CHM13 and the repeat lanes**

- the T2T-CHM13v2.0 reference (hs1), loaded as its own donor assembly:
  https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit
- hs1's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hs1/hs1.gff.gz
- GRCh38's RepeatMasker annotation, binned for the repeat-density lanes:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/rmsk.txt.gz
- hs1's RepeatMasker annotation, the same lanes' other assembly:
  https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb
- our own repeat-density projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

## The alignment the graph and callset came from {#the-alignment-underneath-both}

The graph and the callset are both derived from the multiple alignment, and
release 2 publishes that too: `hprc-v2.0-mc-grch38.full.taf.gz`, 5.9 GB, 464
haplotypes, beside a `.tai` index written by
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy). The index makes it
addressable, so a locus is a ranged read rather than a download:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "hprc_v2_0_mc_grch38",
  "name": "HPRC release 2 pangenome alignment (464 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz"
  }
}
```

The `uri` shorthand resolves the sibling `.tai`, which downloads once.

TAF is taffy's own column-oriented format, and the same alignment is published
as a 53 GB MAF under `v2.1/`, which `BgzipMafAdapter` reads with the same `uri`
shorthand. The v2.0 file is the one this page uses: it is the build the graph
and the callset above come from, and it is far smaller to store and cheaper to
read a locus out of.

Each product this page has opened states something different about the same
sequence, so the figure below puts them on one axis: the graph as its segments
and again as a subgraph, the callset as a genotype matrix over all 464
haplotypes, and the alignment as rows. The band runs down all of them.

<Figure caption="The C4 locus on one axis: the NCBI RefSeq genes, the graph's rGFA segments, the callset's 464 haplotypes clustered by genotype, thirty-two of those haplotypes as alignment rows clustered by identity, and the same window as a force-directed subgraph. The band marks the pseudogene pair between C4A and C4B, where the haplotypes that carry nothing there gather into a block." src="/img/maf_hprc_pangenome.png" />

The locus is C4, the example [HPRCv2](https://github.com/pangenome/HPRCv2)
itself opens with. Every alignment row is a human haplotype, so a row that drops
out belongs to a person who does not carry that segment. Read down a column for
who carries what, across for where each segment starts and stops.

Both matrices are clustered, over different measurements: the callset by
genotype, the alignment by how much of each bin a haplotype aligns and matches
at, where a bin it does not reach scores zero. Each dendrogram comes from its
own measurement, so neither reads as the other's. The graph's attribution is a
third, crediting a segment to whichever assembly first contributed it, where a
genotype names every haplotype that carries the allele. What lines up across all
of them is the span, which is what the band is for.

Clustering the alignment is a run. A MAF usually orders its rows by a guide tree
the file ships, and HPRC's ships none: how the haplotypes group is a property of
the locus. **Cluster rows by identity...** under the track menu's **Clustering**
submenu computes it over the window in view, and **Reset row order** puts back
whatever the file supplied.

The alignment draws sixteen samples rather than all 232, thirty-two haplotype
rows at two per sample, because a row needs enough height for its name to fit
beside it and the whole cohort named is a track several screens tall. Drop
`subtreeFilter` from the session and every haplotype is there, at whatever
height it fits in.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity and codon view, all derived from the alignment with no extra
files.

## Every haplotype in its own coordinates

The alignment above is anchored: each haplotype is drawn on GRCh38's axis, which
is what makes hundreds of rows comparable at all, and what leaves each
assembly's own coordinates out of the picture. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
is the other reading. One lane per haplotype, each in that assembly's own contig
coordinates and carrying that assembly's own CAT gene models, with ribbons
connecting a gene to its copy in the lane below.

No aligner is in the loop. CAT projects the GENCODE gene set onto every release
2 assembly, so a gene keeps its name on every haplotype, and joining the
annotations by name is already the ortholog table: one row per GRCh38 gene in
the window, one column per haplotype, `.` where that haplotype's annotation has
no copy.

### Picking the panel out of the callset

`build_hprc_cfhr_synteny.sh` genotypes the CFHR3/CFHR1 deletion over all 464
haplotypes rather than taking a list, and prints what it found: 139 haplotypes
carry it, 36 samples are homozygous for it and 124 are homozygous reference.

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# the site as the callset states it. One record with two ALTs here, so the
# deletion allele is the one far shorter than the REF span rather than the one
# at a fixed index.
bcftools view -r chr1:196753075-196753075 -Oz -o cfhr_site.vcf.gz "$WAVE"
```

It then walks the homozygous samples in callset order and keeps a haplotype only
if three things hold: its alignment in the window sits on one contig, release 2
annotated it, and its own CAT annotation agrees with the genotype it was picked
on, meaning no _CFHR3_ or _CFHR1_ on a carrier and both on a non-carrier. The
third is the control, since the callset and the annotation are separate products
of the release, and a lane is drawn only where the two say the same thing.

That last check is the one that costs: a CAT annotation is ~110 MB, whole
genome, and ships no index, so the shortlist is fetched concurrently
(`CAT_JOBS`, 6 by default) and each slice is kept, which is what makes a re-run
that only wants the table cheap.

Each kept haplotype's slice then reduces to one plain BED of its gene rows,
keyed on the CAT `Name` that every assembly shares:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# one plain BED per genome, from the gene rows of its own annotation
gzip -dc hprc_cfhr_HG00099.1.genes.gff3.gz \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /Name=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
    }' > hprc_cfhr_HG00099.1.bed
```

Joining those BEDs on that fourth column gives the table the track loads: one
row per GRCh38 gene in the window, one column per haplotype, `.` where an
annotation has no copy.

### Reading it

The session below opens the CFH cluster at chr1:196,640,000-196,900,000, one
lane per haplotype:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "CFH cluster, one lane per haplotype",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:196,640,000-196,900,000",
        "tracks": [
          {
            "trackId": "hg38_ncbiRefSeq_ucsc",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "hprc_cfhr_multiway",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": [
              "HG00097.1",
              "HG00099.1",
              "HG00128.1",
              "HG00133.1",
              "HG01109.1",
              "HG01123.1",
              "HG01960.1",
              "HG02055.1"
            ],
            "height": 460
          }
        ]
      }
    ]
  }
}
```

`rowOrder` puts every non-carrier above every carrier, and that ordering is what
makes the deletion readable. A ribbon joins adjacent lanes and bridges past one
that places nothing for the group, down to the next lane that does, so a chain
stops only where no lane below it kept the gene. With every carrier at the
bottom, that is the first carrier lane.

<Figure caption="The CFH cluster on chr1 as one multi-way synteny track: hg38 genes over a lane per HPRC haplotype, each on its own contig and carrying its own CAT gene models. The CFHR3 and CFHR1 chains run through the non-carrier lanes and stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/pangenome/hprc_cfhr_lane_stack.png" />

Every lane sits at a different coordinate on a different contig, which is what
the headers say, and the flanking genes still line up down the stack because a
lane is fitted to the orthologs rather than projected onto GRCh38. The two
chains that stop are _CFHR3_ and _CFHR1_: the carriers' own annotations have
neither gene, so there is nothing in those lanes for a ribbon to reach.

The same eight lanes over 500 kb bring in more flanking genes, which are the
control on that reading.

<Figure caption="The complement factor H cluster on chr1 over 500 kb: hg38 genes over a lane per HPRC haplotype, the ones homozygous reference at the CFHR3/CFHR1 site above the ones homozygous for the deletion, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

## Every haplotype's walk, straight from the graph {#walks-from-the-graph}

The lanes above were assembled before the session opened: one slice of the
release's PAF per haplotype, one CAT annotation each, and a genotype step to
choose the eight. The graph states the same thing already. A `.gbz` holds one
walk per haplotype, and release 2.1 publishes that graph as a **gbz-base
database**, which is the graph in SQLite with its tables laid out so a window is
a handful of range requests rather than a 10 GB download.

Every graph-derived track on this page reads release **2.1**, so a segment id in
the rGFA tracks and a node id in this database are the same graph's; only the
alignment underneath, the TAF, is release 2.0, which
[the last section](#the-alignment-underneath-both) says why.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hprc_v2_1_gbz_lanes",
  "name": "HPRC release 2.1 haplotypes vs GRCh38, read from the graph (gbz-base)",
  "assemblyNames": [
    "hg38",
    "HG00097.1",
    "HG00099.1",
    "HG00128.1",
    "HG00133.1",
    "HG01109.1",
    "HG01123.1",
    "HG01960.1",
    "HG02055.1"
  ],
  "adapter": {
    "type": "GbzBaseSyntenyAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db",
    "haplotypeIndexLocation": {
      "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db"
    },
    "assemblyNames": [
      "hg38",
      "HG00097.1",
      "HG00099.1",
      "HG00128.1",
      "HG00133.1",
      "HG01109.1",
      "HG01123.1",
      "HG01960.1",
      "HG02055.1"
    ],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG00097.1": "HG00097#1",
      "HG00099.1": "HG00099#1",
      "HG00128.1": "HG00128#1",
      "HG00133.1": "HG00133#1",
      "HG01109.1": "HG01109#1",
      "HG01123.1": "HG01123#1",
      "HG01960.1": "HG01960#1",
      "HG02055.1": "HG02055#1"
    },
    "context": 1000,
    "nodeLimit": 50000
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "hprc_v2_1_gbz_lanes-MultiWaySyntenyDisplay",
      "height": 600,
      "lanes": [
        "HG00097.1",
        "HG00099.1",
        "HG00128.1",
        "HG00133.1",
        "HG01109.1",
        "HG01123.1",
        "HG01960.1",
        "HG02055.1"
      ]
    }
  ]
}
```

The eight lanes are the same eight as above, listed twice: in `assemblyNames` so
each lane is the assembly the session already holds (its gene annotation follows
it), and in the display's `lanes` so the track opens on them rather than on
all 464. **Choose lanes...** on the track menu lists every haplotype the graph
names, grouped by sample, so any other set is a tick away, and **Every lane** is
the whole cohort. The figure's stack is pinned by the same `rowOrder` as the
gene-table session above; a track pasted from the fence opens densest-first.

<Figure caption="The CFH cluster's eight lanes read from the graph at load time, in the same lane order as the gene-table stack above, from two hosted files and no offline step. Each lane is one haplotype's walk aligned to hg38 as a CIGAR, and because the eight assemblies are in the session, each draws that haplotype's own CAT genes at its own coordinates over it." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

`GbzBaseSyntenyAdapter` answers a window rather than reading a file. It locates
the window on GRCh38's own path through the graph, reads the subgraph over it,
and emits one record per haplotype walk, in that haplotype's contig coordinates
and carrying the walk's CIGAR (a walk that leaves the window's nodes and comes
back is joined, the private stretch its insertion and the reference it skipped
its deletion), which is the record a
[multi-way synteny](#every-haplotype-in-its-own-coordinates) lane is drawn from.
The reader's test suite checks those CIGARs against upstream gbz-base's own
query output, and on the E. coli graph they were read against the offline
converter the [E. coli tutorial](/docs/tutorials/pangenome_ecoli)'s alignments
come from: at 1,552 reference points across ten windows, 1,544 put a haplotype
base at the same coordinate, and the eight that differ are one divergent block
the reader scores as an insertion then a deletion where the converter writes
mismatches. No aligner is in the loop here either, and no offline step at all:
the lanes are the graph's own walks.

`haplotypeIndexLocation` is what names them. Upstream gbz-base cannot say which
haplotype a walk belongs to and reports `unknown#1`, `unknown#2`, so a companion
file beside the database names them, and carries anchors along GRCh38 and CHM13
from which a named set of haplotypes can be walked without touching the rest,
which is the route `--keep` and the graph cut take. A lane track does not take
it: the window comes back whole, so the display's `lanes` chooses what is drawn
rather than what is fetched, and the timings below are the ones that apply. What
the file holds and how it is built is in the
[gbz-base README](https://github.com/GMOD/gbz-base-js#readme).

### What a window costs {#gbz-window-cost}

A window comes back as one record per haplotype walk through it, whatever
`context` is set to: `@gmod/gbz-base` joins the pieces of a walk that leaves the
window's nodes and comes back, so a private bubble becomes the record's
insertion and the reference it skipped the deletion. What `context` trades is
nodes read against pieces joined. The C4 window below is 8,083 pieces at
`context: 0` and 463 walks at 1000, for the same 463 records; MHC class II sits
inside a snarl far larger than the window, so it is 1.1 million pieces at 0 and
takes three times as long as at 1000. The default is 1000. These are all at
1000, contained snarls, `@gmod/gbz-base` 2.5.0, reading both files over HTTP,
the database from HPRC's bucket and the companion from ours, timed around the
whole command, two runs each on 2026-09-06 and the median:

| Locus        | Window                         | Nodes  | Records | Companion read | Time   |
| ------------ | ------------------------------ | ------ | ------- | -------------- | ------ |
| C4           | `chr6:31,980,000-31,990,000`   | 1,173  | 463     | 8 req, 0.5 MB  | 17.8 s |
| C4           | `chr6:31,950,000-32,010,000`   | 4,236  | 463     | 9 req, 0.6 MB  | 31.5 s |
| CFH cluster  | `chr1:196,640,000-196,900,000` | 16,372 | 465     | 17 req, 1.1 MB | 31.9 s |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` | 27,438 | 464     | 14 req, 0.9 MB | 33.8 s |
| MHC class II | `chr6:32,510,000-32,600,000`   | 43,540 | 463     | 11 req, 0.7 MB | 31.7 s |
| AMY1         | `chr1:103,690,000-103,780,000` | 12,240 | 1,395   | 24 req, 1.5 MB | 30.3 s |

Every record is named in all six, and the companion is barely touched, a
megabyte and a half at most out of its 7.9 GB. The first five are one record per
haplotype. The times are set by the network the command was timed from rather
than by the window: on the day of this table one 64 kB range request to the
bucket took 0.4-0.8 s, every window came back in about half a minute whatever
its node count, and 2.3.0 timed the same as 2.5.0 on the same connection (15.0
and 15.4 s against 14.9 and 15.4 s at the small C4 window), so the 5-13 s an
earlier run of this table showed were that day's network and not a reader that
has since slowed. A chosen set takes a different route: with `--keep`, the
tutorial's eight at KIV-2 are walked from the anchor before the window, 9
companion requests and 3 s on a fresh open against 3.8 s for all 464, and 0.4 s
cached; the four tutorial windows measured both ways are in the gbz-base README.

_AMY1_ is the row with more records than haplotypes, and it is the locus a
copy-number question would start from. The amylase repeat sends each haplotype
out of the window's nodes and back, so 490 haplotype walks arrive as 1,912
pieces; the pieces of one walk that follow each other along the reference are
joined, and the ones that do not, because an extra copy of the repeat unit
revisits the same stretch of GRCh38, stay separate. That is 1,395 records, and
those extra records, the ones whose reference interval falls on the repeat unit,
are where a copy count per haplotype would be read off the graph. Naming those
pieces is also the one place the companion is walked rather than looked up: a
piece shorter than the 16 kb it samples at holds no recorded position and is
walked to one, 78,506 steps here against zero at every other locus, and since
`@gmod/gbz-base` 2.3.0 that costs 24 requests rather than the 5,202 it did when
the index was scanned across the gaps between the repeat's node-id clusters.

`context` is also the wrong repair for a window like _AMY1_. `context` 20000 and
`overlapping` snarls each pull in enough of the repeat to exhaust a 4 GB heap
after about a minute, so the window that most wants a wider read is the one that
cannot afford it; the contained cut at 1000 is what the table shows.

`nodeLimit` is the guard on the other end. It fails a window rather than letting
the display sit on a whole chromosome, and the failure names a zoom that would
fit, so it has to clear the largest window you mean to open: 12,000 is enough
for C4 and refuses MHC class II. It bounds nodes, not time, and _AMY1_'s 12,240
nodes are under any limit that lets the other loci through.

### The graph view from the GBZ, for a chosen set {#gbz-graph-cut}

The same track feeds the graph view: **Launch → Graph genome view (this
region)** on a GBZ lane track cuts the window from the database, and the cut
carries one W line per haplotype walk, named through the companion. That is what
the rGFA cut cannot say: an rGFA segment names the one assembly that contributed
it, a GBZ cut says which haplotypes walk every node. A cut for every haplotype
names all 464 walks, 21,721 base-level nodes at KIV-2 and 12 s against the two
hosted files, for a Sample rows layout of 232 donors; a cut for the track's
chosen lanes walks only those from the anchor.

For a figure of a chosen set, cut once and load the file. `gbz-base-query`, the
reader's command line, takes `--keep` for each haplotype and writes the
reference walk, the kept walks and only the nodes those walks visit:

```bash
npx -p @gmod/gbz-base gbz-base-query \
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db \
  --haplotype-index https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db \
  --sample GRCh38 --contig chr6 --interval 160616002..160646753 \
  --context 1000 --snarls --format gfa \
  --keep HG00097#1 --keep HG00099#1 --keep HG00128#1 --keep HG00133#1 \
  --keep HG01109#1 --keep HG01123#1 --keep HG01960#1 --keep HG02055#1 \
  > hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa
```

That is the KIV-2 bubble for the eight, 3,140 nodes in 350 kB after 6 s, each
haplotype's walk in the pieces that stay inside the window, and the graph view
opens it as a file (**Add → Graph genome view**, then the file's URL in the load
form, or a session with `gfaLocation`), in Sample rows with `GRCh38` as the
reference path:

<Figure caption="The KIV-2 array cut from the GBZ for the eight haplotypes, in Sample rows over the same window as the rGFA segments lane. Each row is a haplotype of the eight; an allele is drawn in the row of the first of them to walk it, so a row holds what that haplotype is the first to carry, and the hover on any node lists every haplotype that walks it." src="/img/pangenome/hprc_kiv2_gbz_walks.png" />

One step short of carriage, and said plainly: the layout places each node once,
so an allele two of the eight share is drawn in the earlier row only. A layout
that draws a node in every row that walks it is what would turn this into the
carriage figure, and it is the graph view's next change on this route.

### Preparing a graph of your own {#preparing-a-gbz-base-database}

HPRC publishes the database this track reads, so nothing above builds one. For a
`.gbz` of your own, three commands stand between it and the same track, none of
them JBrowse: `vg chains` for the snarl decomposition, `gbz-base construct` for
the database, and `gbz-haplotype-index` for the companion that names the walks.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows all three, and the same page builds every other file this one reads.

The companion HPRC does not publish is the one exception, and it has a script of
its own under [Reproduce it end to end](#reproduce-it-end-to-end).

## T2T-CHM13 as hs1 {#the-one-donor-worth-loading}

CHM13 is the contributor with a published reference behind it, T2T-CHM13v2.0,
which UCSC serves as `hs1` with RefSeq genes and RepeatMasker, so it loads from
that host rather than from GenArk; [](/docs/tutorials/hg002_haplotypes) loads
HG002, the other donor with a reference of its own. Its coordinates are that
assembly's: CHM13 segments on chr17 run past the end of GRCh38's chr17 and
inside hs1's.

Load it under its own name, with the graph's spelling as an alias. The view
resolves a donor through `assemblyManager`, which is keyed by name and aliases
alike, so `hs1` is what the launch opens and `CHM13` is what the graph says:

```json addassembly
{
  "name": "hs1",
  "displayName": "Human (T2T-CHM13v2.0/hs1)",
  "aliases": ["CHM13", "T2T-CHM13v2.0"],
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit"
}
```

Its genes are the same UCSC RefSeq set the hg38 lane above reads, on hs1:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hs1_ncbiRefSeq_ucsc",
  "name": "NCBI RefSeq genes (hs1)",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/hs1/hs1.gff.gz",
    "csi": true
  }
}
```

The segments track can draw on hs1 as well, which is where the
`assemblyNameToPanSN` map earns its second entry: `hs1` asks for `CHM13#0#chr17`
the same way `hg38` asks for `GRCh38#0#chr17`. This replaces the track
[part 1 loads](/docs/tutorials/pangenome_hprc#load-the-graph), same `trackId`,
one more assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38", "hs1"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38", "hs1": "CHM13" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

With both assemblies loaded a CHM13 node opens on either one, and on hs1 its
coordinates are the donor's own rather than the GRCh38 interval it attaches
across. The node in the figure below is 142 kb of chr17 that GRCh38 does not
carry, near the end of the chromosome, and RepeatMasker tiles it with long L1
elements.

Read that lane for what the sequence is made of rather than for how much repeat
is in it. The elements are old L1 subfamilies, long past copying themselves, and
the CHM13 sequence either side of the node is made of the same thing. A
subtelomere built out of decayed L1 is the kind of sequence a BAC-and-Sanger
reference had no way to place, which is the answer to why GRCh38 ends where it
does here.

<Figure caption="A donor node on both coordinate systems: the GRCh38 window, the graph cut from it, then that node on hs1's own chr17 tiled by long L1 elements in red." src="/img/pangenome/hprc_chm13_allele.png" />

CHM13 entered this graph late, after most of the other haplotypes, so little is
credited to it: `tabix hprc-v2.1-mc-grch38.segs.bed.gz 'CHM13#0#chr1'` returns a
short list for the whole of chr1, most of it attaching only to other donors.
Finding one that touches GRCh38, like the node above, means scanning the links
index for CHM13 rows with a GRCh38 endpoint:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.links.bed.gz \
  'CHM13#0#chr17' |
  awk -F'\t' '$6 ~ /^GRCh38/ || $10 ~ /^GRCh38/'
```

With two assemblies loaded the graph's own **Launch** menu offers **Linear
synteny view** as well, one panel per contributor at the locus each contributes
here, if the session holds a synteny track aligning them. UCSC's hg38-to-hs1
liftOver is one, rehosted as an indexed PAF:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg38_hs1_synteny",
  "name": "hg38 vs T2T-CHM13 (UCSC liftOver)",
  "assemblyNames": ["hg38", "hs1"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz",
    "csi": true,
    "assemblyNames": ["hs1", "hg38"]
  }
}
```

Taken at the window above, it opens hg38 over hs1, each panel already at the
interval the graph states for it, with the liftOver ribbons between them.
Without such a track the entry stays, greyed out, and its tooltip says what is
missing. The launch opens every loaded contributor, so a session carrying
several haplotypes opens a panel for each one with a node in the window, whether
or not the track aligns it.

<Figure caption="The graph's own Launch menu at the CHM13 window, with hg38 and hs1 loaded and the liftOver between them in the session. Above, the hg38 window and the cut, the CHM13 node ringed. Below, the synteny view the Linear synteny view entry opened: hg38 over hs1, each panel framed on the locus the graph states for it, with the liftOver ribbons between." src="/img/pangenome/hprc_synteny_launch.png" />

## What kind of sequence GRCh38 was missing

The lane above says the inserted sequence is tiled by L1. Whether that is
unusual, a subtelomere being repeat-dense either way, takes the same measurement
on both assemblies at the same scale: the fraction of each 5 kb bin covered by
one RepeatMasker class, one lane per class, on GRCh38 and CHM13 alike.
`bedtools` measures it, one lane at a time, from a RepeatMasker BED of
`chrom start end class`:

<!-- from: scripts/build_repeat_density.sh -->

```bash
# CHM13's rmsk ships as a bigBed where UCSC's hg38 is a table
bigBedToBed chm13v2.0_rmsk.bb rmsk.raw.bed

# only the chroms the rmsk BED covers, so no lane carries empty scaffold bins
bedtools makewindows -g hs1.main.sizes -w 5000 | sort -k1,1 -k2,2n > windows.bed

# merge first: one fragmented L1 is several overlapping records, and unmerged
# coverage counts the shared bases twice and reports over 100%
awk -F'\t' '$4=="LINE"' rmsk.bed | bedtools merge -i - > line.bed

# -a windows -b class puts the covered fraction of each window in the last column
bedtools coverage -a windows.bed -b line.bed -sorted -g hs1.main.sizes |
  awk -F'\t' '{printf "%s\t%s\t%s\t%.5f\n", $1, $2, $3, $NF}' > line.bg
bedGraphToBigWig line.bg hs1.main.sizes hs1_repeat_density_LINE.bw
```

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "hs1_repeat_density",
  "name": "Repeat density by class (RepeatMasker, 5 kb bins)",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "LINE",
        "color": "rgb(200,60,45)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_LINE.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "SINE",
        "color": "rgb(60,110,180)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_SINE.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "LTR",
        "color": "rgb(70,150,90)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_LTR.bw"
      }
    ]
  },
  "displayDefaults": {
    "defaultRendering": "multirowxy",
    "minScore": 0,
    "maxScore": 1
  }
}
```

Swap `hs1` for `hg38` in the `trackId`/`assemblyNames` and the URLs for the
GRCh38 copy. `DNA`, `Satellite` and `Simple_repeat` are hosted under the same
names if you want them, near zero here but the whole story on a centromere. The
pinned `minScore`/`maxScore` are load-bearing for the same reason they are in
the
[cookbook recipe](/docs/cookbook#multiple-signals-on-one-track-each-its-own-color)
this follows: autoscale runs per row, so each class would rescale to its own
maximum and the comparison the track exists for would disappear.

Open the track on each assembly's last 650 kb of chr17, what each one ends the
chromosome with, since sequence one of them lacks has no lifted-over interval.
`build_repeat_density.sh` reports the two windows at almost the same total
repeat content, so a single density lane would show no difference. What moved is
the composition, in opposite directions: more L1, less Alu.

That comparison is between two whole chromosome ends, which is why it holds. A
single interval is harder. Rank the insertion allele from
[the donor-node figure](#the-one-donor-worth-loading) against windows of its own
size and where it lands moves with the windows you rank it against, which is why
`build_repeat_density.sh` reports several scopes rather than one. Read these
lanes for which class changed, not for how much of it there is.

## Reproduce it end to end

The [repeat-density lanes](#what-kind-of-sequence-grch38-was-missing) come from
a script that bins UCSC's RepeatMasker for both assemblies, with the tools
listed under [Prerequisites](#prerequisites):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_repeat_density.sh
bash build_repeat_density.sh out
```

It writes the twelve bigWigs (six classes x two assemblies, genome-wide) and
prints the per-class table the section above quotes, so the numbers come out of
the same run that builds the lanes. The first run downloads ~500 MB and
re-running skips what is already built, so an interrupted run resumes.

The [haplotype-walk lanes](#walks-from-the-graph) need one file HPRC does not
publish, the companion index that names the walks in its gbz-base database:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

It downloads the 5.5 GB `.gbz`, builds `gbz-haplotype-index` from source and
runs the one command
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows, which takes about a quarter of an hour on 24 cores. The database it
accompanies is read straight from HPRC's bucket and never downloaded.

The [gene-table lanes](#every-haplotype-in-its-own-coordinates) read release 2's
published all-vs-GRCh38 PAF:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_cfhr_synteny.sh
bash build_hprc_cfhr_synteny.sh       # writes ./hprc_cfhr_synteny_build/
```

[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
picks four carriers and four non-carriers of the deletion out of the callset
(`CARRIERS` and `NONCARRIERS`), slices their alignments out of that PAF, and
slices each haplotype's CAT annotation to the same window.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/maf_track)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the multiple alignment, the gbz-base database and the CAT
  annotation of every assembly.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the 5.9 GB alignment addressable by locus.
