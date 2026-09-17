---
title: Pangenome (HPRC) part 3, every haplotype in its own coordinates
sidebar_label: Pangenome (HPRC 3, haplotypes in their own coordinates)
description:
  The multiple alignment HPRC release 2's graph and callset both come from, then
  the same haplotypes off GRCh38's axis and on their own contigs
guide_category: Tutorials
tutorial_category: Pangenomes
---

Parts [1](/docs/tutorials/pangenome_hprc) and
[2](/docs/tutorials/pangenome_hprc_part2) draw everything on GRCh38's axis,
which makes hundreds of haplotypes comparable in one lane and leaves each
assembly's own coordinates out of the picture. We start from the multiple
alignment both products were derived from, then put each haplotype back on its
own contigs straight out of the graph, and end on the one donor that has a
published reference of its own.

## Prerequisites

- [part 1](/docs/tutorials/pangenome_hprc), whose session this page adds to:
  hg38 with its genes and the rGFA segments track loaded on it, plus
  [part 2's callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset)
  for the first figure
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the track that uses `GbzBaseSyntenyAdapter` and part 1's segments track;
  every other track here is a URL you can paste
- `bcftools`, to genotype the panel out of the callset

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose multiple
alignment and gbz-base database are read straight off S3, beside T2T-CHM13 from
UCSC and the companion index we host.

**The alignment and the assemblies**

- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz
- the release's all-vs-GRCh38 alignment, which the panel's build script slices:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

**The graph as a walk database**

- release 2.1's Minigraph-Cactus graph as a gbz-base database, 10 GB, read by
  range request and never downloaded:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- the `.gbz` that database was built from, which also names its haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- our companion haplotype index for that database, which HPRC does not publish:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

**T2T-CHM13**

- the T2T-CHM13v2.0 reference (hs1), loaded as its own donor assembly:
  https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit
- hs1's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hs1/hs1.gff.gz
- hs1's RepeatMasker annotation, from UCSC:
  https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb
- UCSC's hg38-to-hs1 liftOver, rehosted as an indexed PAF:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz

## The route

Three ways to see a haplotype's own sequence, in the order they leave GRCh38's
axis:

1. [Add the multiple alignment](#the-alignment-underneath-both) and put it under
   the graph and the callset at one locus.
2. [Read eight haplotypes' walks out of the graph](#walks-from-the-graph) as one
   lane each, in their own contig coordinates.
3. [Load T2T-CHM13 as an assembly](#the-one-donor-worth-loading) and open a node
   on it, then launch a synteny view between the two.

## The alignment the graph and callset came from {#the-alignment-underneath-both}

The graph and the callset are both derived from the multiple alignment, and
release 2.1 publishes that too: `hprc-v2.1-mc-grch38.full.maf.gz`, 53 GB, 464
haplotypes, beside a `.tai` index written by
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy). The index makes it
addressable, so a locus is a ranged read rather than a 53 GB download:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "hprc_v2_0_mc_grch38",
  "name": "HPRC release 2 pangenome alignment (464 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BgzipMafAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz"
  }
}
```

The `uri` shorthand resolves the sibling `.tai`, which downloads once. This is
the build [the graph](/docs/tutorials/pangenome_hprc#add-the-graph-track) and
[the callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) come
from. Release 2.0 publishes the same alignment as a 5.9 GB TAF, which
`BgzipTaffyAdapter` reads with the same shorthand — a quarter of the bytes per
locus, but an earlier build, with more underalignment and unpatched centromeres.

Type `chr6:31,980,000-32,050,000`, the C4 window from part 1's table, and show
four lanes: the genes, the segments, the callset with part 2's structural
filter, and this alignment. Every alignment row is a human haplotype, so a row
that drops out belongs to a person who does not carry that segment. Read down a
column for who carries what, across for where each segment starts and stops. C4
is the locus [HPRCv2](https://github.com/pangenome/HPRCv2) itself opens with.

Two clustering runs order the rows. On the callset, part 2's **Clustering →
Cluster rows by genotype...**. On the alignment, **Clustering → Cluster rows by
identity...** in its track menu, which computes over the window in view, since
HPRC's file ships no guide tree; **Reset row order** puts back whatever the file
supplied. Then cut the window from the segments track with **Launch → Graph
genome view (this region)** for the graph pane under all four.

<Figure caption="The C4 locus on one axis: the NCBI RefSeq genes, the graph's rGFA segments, the callset's haplotypes clustered by genotype (grey reference, teal alt allele, magenta other alt, tan no call, an insertion widened to the inserted length with that bp count inside), a subtree of those haplotypes as alignment rows clustered by identity, grey where a haplotype aligns to GRCh38 and white where it has no aligned sequence, and the same window as a force-directed subgraph in reference-position colors. The band marks the pseudogene pair between C4A and C4B; the haplotypes with no aligned sequence across the module gather into one block." src="/img/maf_hprc_pangenome.png" />

:::tip 💡 See also

[Part 1](/docs/tutorials/pangenome_hprc#reading-what-you-cut) labels the
backbone, an allele and a bubble on the C4 cut.

:::

The figure keeps thirty-two haplotype rows so each has the height for its name
beside it; the track as configured above draws every haplotype. The
[MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity and codon view, all derived from the alignment with no extra
files.

## Every haplotype's walk, straight from the graph {#walks-from-the-graph}

The alignment above draws each haplotype on GRCh38's axis. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
is the other reading: one lane per haplotype, each in that assembly's own contig
coordinates and carrying that assembly's own CAT gene models. The graph already
holds what the lanes need. A `.gbz` holds one walk per haplotype, and release
2.1 publishes that graph as a **gbz-base database**, the graph in SQLite with
its tables laid out so a window is a handful of range requests. Every
graph-derived track on this page reads release **2.1**, so a segment id in the
rGFA tracks and a node id in this database are the same graph's.

### Picking the panel out of the callset

Eight haplotypes make the panel at the CFH cluster. `build_hprc_cfhr_synteny.sh`
genotypes the CFHR3/CFHR1 deletion over all 464 haplotypes and keeps the
homozygous samples whose own CAT annotation agrees with the genotype:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# the site as the callset states it. One record with two ALTs here, so the
# deletion allele is the one far shorter than the REF span rather than the one
# at a fixed index.
bcftools view -r chr1:196753075-196753075 -Oz -o cfhr_site.vcf.gz "$WAVE"
```

HG01109, HG01123, HG01960 and HG02055 carry the deletion; HG00097, HG00099,
HG00128 and HG00133 do not. The script also slices each one's CAT annotation to
the window, and those are the gene models the lanes draw.

### The lanes from the database

Each haplotype in the panel is an assembly in the session, and the track names
them all. The eight assemblies are the ones
[the panel script](#picking-the-panel-out-of-the-callset) writes, each a
chromosome-lengths file the way
[Synteny from a pangenome graph](/docs/tutorials/hprc_multiway_synteny#the-assemblies-and-their-gene-models)
loads them.

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
    "assemblyNames": ["hg38"],
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
      "height": 600
    }
  ]
}
```

The track opens on the assemblies its `assemblyNames` lists beside hg38, and
`assemblyNameToPanSN` names which haplotype each one is. **Lanes → Choose
lanes...** on the track menu lists every haplotype the graph names, grouped by
sample. Ticking every one draws the whole cohort, and the dialog's reset goes
back to the eight.

Type `chr1:196,640,000-196,900,000` and show the track. The session below is
that state, and its live link opens it on the hosted config with the eight
assemblies already in:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "CFH cluster, one lane per haplotype walk",
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
            "trackId": "hprc_v2_1_gbz_lanes",
            "type": "MultiWaySyntenyDisplay",
            "domain": [
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

`domain` puts every non-carrier above every carrier, making the deletion
readable. Every lane sits at a different coordinate on a different contig.
Between the last non-carrier and the first carrier the ribbon over _CFHR3_ and
_CFHR1_ narrows to a point, because the carriers' walks skip that stretch of
GRCh38, and the carriers' own annotations have no model there.

<Figure caption="The CFH cluster's eight lanes read from the graph at load time, the non-carriers above the carriers, from two hosted files and no offline step. Each lane is one haplotype's walk aligned to hg38 as a CIGAR, and because the eight assemblies are in the session, each draws that haplotype's CAT genes at that haplotype's coordinates over it: a lane whose genes stop where hg38's CFHR3 and CFHR1 are is a haplotype that lacks them." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

:::tip 💡 See also

[Synteny from a pangenome graph](/docs/tutorials/hprc_multiway_synteny#the-cfh-cluster-eight-haplotypes)
places the same eight haplotypes from the graph's own alignment, unpacked
offline into a whole-genome index.

:::

`GbzBaseSyntenyAdapter` locates a window on GRCh38's own path through the graph
and emits one record per haplotype walk, in that haplotype's contig coordinates
and carrying the walk's CIGAR. Upstream gbz-base reports `unknown#1`,
`unknown#2` for those walks, so the companion file at `haplotypeIndexLocation`
names them and carries anchors a named set can be walked from. The lanes in
force, the track's own or whatever the reader picks from **Choose lanes...**,
reach the adapter as the set to fetch. A lane hidden from its header menu stays
in that set, so showing it again draws it at once.

`context` defaults to 1000, the nodes read on either side of the window.
`nodeLimit` refuses a window that would not fit and names a zoom that would.
_AMY1_ returns more records than there are haplotypes, because an extra copy of
the repeat unit revisits the same stretch of GRCh38 and those pieces of one walk
stay separate; those extra records are where a copy count per haplotype would be
read off the graph.

### The graph view from the GBZ, for a chosen set {#gbz-graph-cut}

The `hprc_v2_1_gbz_lanes` track also feeds the graph view. Type
`chr6:160,616,002-160,646,753`, the KIV-2 array inside _LPA_, and take **Launch
→ Graph genome view (this region)** from the linear view's own menu. That cuts
the window from the database for the lanes on screen, which are the track's
configured lanes until **Choose lanes...** picks others. The cut carries one W
line per haplotype walk, named through the companion, and **Sample rows** in the
**Layout** dropdown gives each haplotype a row.

Pick **Force-directed layout** in the same dropdown, where the walks are easiest
to see. A node draws thicker the more of the nine walks carry it, so the
reference is fat and each haplotype's private run of kringle copies is a thin
loop. Now open the **Walk** dropdown and pick `HG00133`: its route stays
colored, the rest fades, and a readout gives its length against the reference
walk.

:::tip 💡 See also

[Part 4](/docs/tutorials/pangenome_graph_reading#lift-one-haplotype-out) draws
this cut with `HG00133` lifted, and walks through it from the rGFA window.

:::

### Preparing a graph of your own {#preparing-a-gbz-base-database}

HPRC publishes the database this track reads, so nothing above builds one. For a
`.gbz` of your own, three commands stand between it and the same track, none of
them JBrowse: `vg chains` for the snarl decomposition, `gbz-base construct` for
the database, and `gbz-haplotype-index` for the companion that names the walks.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows all three. The companion that HPRC does not publish has a script of its
own under [Reproduce it end to end](#reproduce-it-end-to-end).

## T2T-CHM13 as hs1 {#the-one-donor-worth-loading}

CHM13 is the contributor with a published reference behind it, T2T-CHM13v2.0,
which UCSC serves as `hs1`; [](/docs/tutorials/hg002_haplotypes) loads HG002,
the other donor with a reference of its own.

```json addassembly
{
  "name": "hs1",
  "displayName": "Human (T2T-CHM13v2.0/hs1)",
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit"
}
```

A view launched on hs1 shows whatever the session annotates hs1 with, and the
lane the figure below reads is UCSC's RepeatMasker:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hs1_rmsk_ucsc",
  "name": "RepeatMasker (T2T-CHM13v2.0)",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb"
  }
}
```

The segments track draws on hs1, and a CHM13 node opens there, once `hs1` joins
its `assemblyNames` and `"hs1": "CHM13"` its `assemblyNameToPanSN`, the two
edits
[part 1 makes for NA20809.2](/docs/tutorials/pangenome_hprc#loading-a-haplotype-as-an-assembly).

Type `chr17:83,010,000-83,040,000`, near the end of chromosome 17, and cut it
from the segments track. Inside the one bubble the lane draws there, the graph
holds a charcoal node of 142 kb that GRCh38 does not carry. Right-click it and
take **Open in hs1**. The view that opens is hs1's own chr17, where the node
draws as one long dark bar in the segments lane and RepeatMasker tiles it with
long L1 elements.

<Figure caption="A donor node on both coordinate systems: the GRCh38 window, with the bubble it sits in and the rGFA segments in reference-position colors; the graph cut from it, where the boxed charcoal node is the sequence hg38 has no coordinate for, haloed as a bubble and labelled a repeat array; then that node on hs1's own chr17, drawn as one dark bar under RepeatMasker, which is tiled by long L1 elements in red." src="/img/pangenome/hprc_chm13_allele.png" />

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

With that track in the session, open the graph pane's **Launch** menu and pick
**Linear synteny view (2 assemblies)**. It opens hg38 over hs1, each panel
already at the interval the graph gives for it. Without such a track the entry
stays, greyed out, and its tooltip names what is missing.

## Reproduce it end to end

The [haplotype-walk lanes](#walks-from-the-graph) need one file HPRC does not
publish, the companion index that names the walks in its gbz-base database:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

`build_hprc_gbz_index.sh` downloads the 5.5 GB `.gbz`, builds
`gbz-haplotype-index` from source and runs the one command
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows, which takes about a quarter of an hour on 24 cores. The database it
accompanies is read straight from HPRC's bucket and never downloaded.

The [panel](#picking-the-panel-out-of-the-callset) and its CAT annotations have
a script of their own:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_cfhr_synteny.sh
bash build_hprc_cfhr_synteny.sh       # writes ./hprc_cfhr_synteny_build/
```

[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
picks four carriers and four non-carriers of the deletion out of the callset
(`CARRIERS` and `NONCARRIERS`), slices their alignments out of release 2's
all-vs-GRCh38 PAF, and slices each haplotype's CAT annotation to the same
window.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_graph_reading)
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
