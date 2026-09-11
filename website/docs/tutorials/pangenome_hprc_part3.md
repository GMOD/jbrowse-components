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
which makes hundreds of haplotypes comparable in one lane and leaves each
assembly's own coordinates out of the picture. This page starts from the
multiple alignment both products were derived from, then puts each haplotype
back on its own contigs, first from a gene table and then straight out of the
graph, and ends on the one donor that has a published reference of its own.

## Prerequisites

- [part 1](/docs/tutorials/pangenome_hprc), whose session this page adds to:
  hg38 with its genes, and the rGFA segments track loaded on it
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the tracks that use `GbzBaseSyntenyAdapter` and `RgfaTabixAdapter`; every
  other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), to slice the annotations the lanes carry

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

**T2T-CHM13**

- the T2T-CHM13v2.0 reference (hs1), loaded as its own donor assembly:
  https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit
- hs1's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hs1/hs1.gff.gz

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

The `uri` shorthand resolves the sibling `.tai`, which downloads once. The same
alignment is published as a 53 GB MAF under `v2.1/`, which `BgzipMafAdapter`
reads with the same shorthand, and the v2.0 TAF is the build
[the graph](/docs/tutorials/pangenome_hprc#load-the-graph) and
[the callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) come
from. The figure below puts all three products on one axis.

<Figure caption="The C4 locus on one axis: the NCBI RefSeq genes, the graph's rGFA segments, the callset's haplotypes clustered by genotype, a subtree of those haplotypes as alignment rows clustered by identity, and the same window as a force-directed subgraph. The band marks the pseudogene pair between C4A and C4B, where the haplotypes that carry nothing there gather into a block." src="/img/maf_hprc_pangenome.png" />

The locus is C4, the example [HPRCv2](https://github.com/pangenome/HPRCv2)
itself opens with. Every alignment row is a human haplotype, so a row that drops
out belongs to a person who does not carry that segment. Read down a column for
who carries what, across for where each segment starts and stops.

Clustering the alignment is a run, since HPRC's file ships no guide tree to
order its rows by. **Cluster rows by identity...** under the track menu's
**Clustering** submenu computes it over the window in view, and **Reset row
order** puts back whatever the file supplied. The alignment draws thirty-two
haplotype rows because a row needs enough height for its name beside it; drop
`subtreeFilter` from the session and every haplotype is there.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity and codon view, all derived from the alignment with no extra
files.

## Every haplotype in its own coordinates

The alignment above draws each haplotype on GRCh38's axis. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
is the other reading: one lane per haplotype, each in that assembly's own contig
coordinates and carrying that assembly's own CAT gene models, with ribbons
connecting a gene to its copy in the lane below.

Eight haplotypes carry that stack, and this section fills their lanes from the
annotations before the session opens; [the next one](#walks-from-the-graph)
draws the same eight from the graph itself. No aligner is in the loop: CAT
projects the GENCODE gene set onto every release 2 assembly, so joining the
annotations by gene name is already the ortholog table.

### Picking the panel out of the callset

`build_hprc_cfhr_synteny.sh` genotypes the CFHR3/CFHR1 deletion over all 464
haplotypes and keeps the homozygous samples whose own CAT annotation agrees with
the genotype:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# the site as the callset states it. One record with two ALTs here, so the
# deletion allele is the one far shorter than the REF span rather than the one
# at a fixed index.
bcftools view -r chr1:196753075-196753075 -Oz -o cfhr_site.vcf.gz "$WAVE"
```

Each kept haplotype's annotation then reduces to one plain BED of its gene rows,
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

`rowOrder` puts every non-carrier above every carrier, which is what makes the
deletion readable: a ribbon bridges past a lane that places nothing, so a chain
stops at the first carrier lane. Every lane sits at a different coordinate on a
different contig, and the flanking genes still line up down the stack because a
lane is fitted to the orthologs. The two chains that stop are _CFHR3_ and
_CFHR1_, which the carriers' own annotations do not have.

<Figure caption="The CFH cluster on chr1 as one multi-way synteny track: hg38 genes over a lane per HPRC haplotype, each on its own contig and carrying its own CAT gene models. The CFHR3 and CFHR1 chains run through the non-carrier lanes and stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/pangenome/hprc_cfhr_lane_stack.png" />

The same eight lanes over 500 kb bring in more flanking genes, which are the
control on that reading.

<Figure caption="The complement factor H cluster on chr1 over 500 kb: hg38 genes over a lane per HPRC haplotype, the ones homozygous reference at the CFHR3/CFHR1 site above the ones homozygous for the deletion, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

## Every haplotype's walk, straight from the graph {#walks-from-the-graph}

The graph states the same thing already: a `.gbz` holds one walk per haplotype,
and release 2.1 publishes that graph as a **gbz-base database**, the graph in
SQLite with its tables laid out so a window is a handful of range requests.
Every graph-derived track on this page reads release **2.1**, so a segment id in
the rGFA tracks and a node id in this database are the same graph's.

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

The eight lanes are listed twice: in `assemblyNames` so each lane is the
assembly the session already holds, and in the display's `lanes` so the track
opens on them. **Choose lanes...** on the track menu lists every haplotype the
graph names, grouped by sample, and **Every lane** is the whole cohort.

<Figure caption="The CFH cluster's eight lanes read from the graph at load time, in the same lane order as the gene-table stack above, from two hosted files and no offline step. Each lane is one haplotype's walk aligned to hg38 as a CIGAR, and because the eight assemblies are in the session, each draws that haplotype's own CAT genes at its own coordinates over it." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

`GbzBaseSyntenyAdapter` answers a window: it locates the window on GRCh38's own
path through the graph and emits one record per haplotype walk, in that
haplotype's contig coordinates and carrying the walk's CIGAR. Upstream gbz-base
reports `unknown#1`, `unknown#2` for those walks, so the companion file at
`haplotypeIndexLocation` names them and carries anchors a named set can be
walked from. The display's `lanes`, and whatever the reader picks from **Choose
lanes...**, reach the adapter as the set to fetch.

`context` defaults to 1000, the nodes read on either side of the window.
`nodeLimit` refuses a window that would not fit and names a zoom that would.
_AMY1_ returns more records than there are haplotypes, because an extra copy of
the repeat unit revisits the same stretch of GRCh38 and those pieces of one walk
stay separate; those extra records are where a copy count per haplotype would be
read off the graph.

### The graph view from the GBZ, for a chosen set {#gbz-graph-cut}

The same track feeds the graph view. **Launch → Graph genome view (this
region)** in the linear view's own menu cuts the window from the database for
the lanes on screen — whatever **Choose lanes...** is set to, or the track's
configured lanes until you change it — and the cut carries one W line per
haplotype walk, named through the companion. For a figure of a chosen set, cut
once and load the file. `gbz-base-query`, the reader's command line, takes
`--keep` for each haplotype:

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

The graph view opens that file (**Add → Graph genome view**, then the file's URL
in the load form, or a session with `gfaLocation`), in Sample rows with `GRCh38`
as the reference path.

<Figure caption="The KIV-2 array cut from the GBZ for the eight haplotypes, in Sample rows over the same window as the rGFA segments lane. Each row is a haplotype of the eight; an allele is drawn in the row of the first of them to walk it, so a row holds what that haplotype is the first to carry, and the hover on any node lists every haplotype that walks it." src="/img/pangenome/hprc_kiv2_gbz_walks.png" />

### Preparing a graph of your own {#preparing-a-gbz-base-database}

HPRC publishes the database this track reads, so nothing above builds one. For a
`.gbz` of your own, three commands stand between it and the same track, none of
them JBrowse: `vg chains` for the snarl decomposition, `gbz-base construct` for
the database, and `gbz-haplotype-index` for the companion that names the walks.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows all three. The companion HPRC does not publish has a script of its own
under [Reproduce it end to end](#reproduce-it-end-to-end).

## T2T-CHM13 as hs1 {#the-one-donor-worth-loading}

CHM13 is the contributor with a published reference behind it, T2T-CHM13v2.0,
which UCSC serves as `hs1` with RefSeq genes and RepeatMasker;
[](/docs/tutorials/hg002_haplotypes) loads HG002, the other donor with a
reference of its own.

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
coordinates are the donor's own. The node in the figure below is 142 kb of chr17
that GRCh38 does not carry, near the end of the chromosome, and RepeatMasker
tiles it with long L1 elements.

<Figure caption="A donor node on both coordinate systems: the GRCh38 window, the graph cut from it, then that node on hs1's own chr17 tiled by long L1 elements in red." src="/img/pangenome/hprc_chm13_allele.png" />

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
interval the graph states for it. Without such a track the entry stays, greyed
out, and its tooltip says what is missing.

<Figure caption="The graph's own Launch menu at the CHM13 window, with hg38 and hs1 loaded and the liftOver between them in the session. Above, the hg38 window and the cut, the CHM13 node ringed. Below, the synteny view the Linear synteny view entry opened: hg38 over hs1, each panel framed on the locus the graph states for it, with the liftOver ribbons between." src="/img/pangenome/hprc_synteny_launch.png" />

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
