---
title: Synteny from a pangenome graph (eight HPRC haplotypes)
sidebar_label: Synteny (pangenome graph lanes, HPRC)
description:
  Stack eight HPRC haplotypes under GRCh38, whole genome, with the pairwise
  alignments unpacked from the Minigraph-Cactus graph's own projection and each
  lane carrying its own CAT gene models
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** we look at one human locus across eight assembled haplotypes from the
Human Pangenome Reference Consortium, whole genome, without running an aligner.
The consortium's pangenome graph carries every haplotype as a walk through
shared nodes, so each haplotype's pairwise alignment to the reference is already
inside it: a small converter walks the GFA once and unpacks each haplotype's
alignment to GRCh38 into PAF, `jbrowse make-pif` indexes the result, and each
haplotype becomes a lane under the reference carrying the consortium's own gene
annotation of it. At the complement factor H cluster, half the lanes carry a
deletion that removes two genes, and that is where the page ends.

## Prerequisites

- `pigz` (or `gzip`), to stream the graph
- htslib (`bgzip`, `tabix`)
- `python3`
- The [JBrowse CLI](/docs/cli) (`jbrowse`), for `make-pif`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph carries every haplotype as a walk, published beside the
same alignment projected onto GRCh38 and a CAT gene annotation of every
assembly.

- the graph, which the lanes are unpacked from, 63 GB:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- GRCh38's chromosome lengths, which bound each chromosome's read of that
  projection:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
- hg38's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz
- the finished index, chromosome lengths, annotations and config, rehosted so
  the lanes load without rerunning the pipeline:
  https://jbrowse.org/demos/hprc_multiway/config.json, with the build recorded
  beside it at https://jbrowse.org/demos/hprc_multiway/README.txt

## The graph's own alignment, unpacked

The alignment here is the graph itself. Minigraph-Cactus writes every haplotype
into the graph as a walk through its nodes, and two walks that pass through one
node carry identical sequence there. A haplotype's pairwise alignment to GRCh38
is therefore its walk read against the reference walk: the nodes both traverse
are matches, the nodes only one of them traverses between two shared ones are
the indels and substitutions. Nothing is aligned on this page; what the lanes
draw is the graph.

`gfa_to_pairwise_paf.py` streams the GFA once and keeps only the reference walks
and the haplotypes asked for; every other walk is skipped unparsed, which is
what makes the whole graph tractable on a laptop. For each haplotype it chains
the shared nodes in reference order into records, one per run that stays on one
strand and skips at most `--max-gap` private bases on either side, and writes an
`=`/`X`/`I`/`D` CIGAR off the node lengths with PanSN names, which is what
`make-pif` and the adapter below expect. A walk states where a contig's piece
starts and ends but not the contig's full length, so `--contig-lengths` takes
the assemblies' `.fai` files and `--chrom-sizes-dir` writes each haplotype's
contigs and lengths, which is all an assembly needs when its lane never reads
sequence:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/gfa_to_pairwise_paf.py
pigz -dc hprc-v2.1-mc-grch38.gfa.gz \
  | python3 gfa_to_pairwise_paf.py --reference GRCh38#0 \
      --queries HG01109#1,HG00099#1 --max-gap 10000 \
      --contig-lengths contig_lengths.fai \
      --chrom-sizes-dir sizes/ > hprc_multiway_gfa.paf
```

The converter reports on stderr, per haplotype, the walks it read, the records
it wrote and the bases it aligned, and a haplotype that wrote none is a wrong
sample spelling. The graph is written one chromosome at a time with the
reference walk first, which is the order the converter expects; a graph whose
haplotype walks precede the reference's wants `--hold-queries`. `make-pif`
sorts, bgzips and indexes the PAF with a fine tier for the per-base CIGARs and a
coarse one for whole-chromosome zooms:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
jbrowse make-pif hprc_multiway_gfa.paf --csi --out hprc_multiway_gfa.pif.gz
```

## The assemblies and their gene models

Each haplotype is an assembly of its chromosome lengths alone, a
`ChromSizesAdapter` over the file the converter wrote, since the lanes never
read sequence. Its gene track is the release's CAT annotation of that assembly,
whole genome, from the index above: the GFF3 sorted, bgzipped and tabix-indexed
as in the [web quickstart](/docs/quickstart_web), with the intron and codon rows
dropped. A lane finds its gene models through the session, so the track only has
to exist under the lane's assembly name.

## The alignment track

One `SyntenyTrack` names hg38 and every haplotype, and its adapter is a
`MultiGenomeIndexedPAFAdapter` over the index. The PAF names every sequence
PanSN-style, `HG01109#1#<contig>`, while the assemblies are named `HG01109.1`,
and `assemblyNameToPanSN` is the map between the two, with GRCh38 as `GRCh38#0`.
The list below is cut to three haplotypes for the page; the hosted config
carries all eight.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hprc_multiway",
  "name": "HPRC haplotypes vs GRCh38 (hg38 + 8 haplotypes, unpacked from the release 2 graph)",
  "assemblyNames": ["hg38", "HG01109.1", "HG01123.1", "HG00099.1"],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
    "uri": "hprc_multiway_gfa.pif.gz",
    "csi": true,
    "assemblyNames": ["hg38", "HG01109.1", "HG01123.1", "HG00099.1"],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG01109.1": "HG01109#1",
      "HG01123.1": "HG01123#1",
      "HG00099.1": "HG00099#1"
    }
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "hprc_multiway-MultiWaySyntenyDisplay",
      "height": 600
    }
  ]
}
```

Every record aligns one haplotype to GRCh38, so the file is a star with the
reference at the centre, which is the shape a lane stack anchored on hg38 reads.
The [linear synteny view guide](/docs/user_guides/linear_synteny_view) covers
the lane controls, the ribbons and the launches each lane header offers.

<Figure caption="The header menu of one haplotype lane: re-anchor the view on it, open it at the matching region in its own view, or move and hide the lane." src="/img/multiway_synteny/hprc_lane_menu.png" />

## The CFH cluster, eight haplotypes

The eight are the panel the
[pangenome page](/docs/tutorials/pangenome_hprc_part3#every-haplotype-in-its-own-coordinates)
picks out of the release's callset at the CFHR3/CFHR1 deletion. HG01109,
HG01123, HG01960 and HG02055 carry it; HG00097, HG00099, HG00128 and HG00133 do
not. That page draws the panel from a gene table over one window; here the same
haplotypes are placed by the graph's alignment, whole genome.

```json session config=https://jbrowse.org/demos/hprc_multiway/config.json
{
  "defaultSession": {
    "name": "The CFH cluster across eight HPRC haplotypes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:196,700,000-197,000,000",
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

Opened on hg38 over the cluster, each lane's header names the haplotype, the
contig it sits on and where on it the window lands, and every lane draws its own
CAT gene models at its own coordinates. In a non-carrier lane the alignment runs
the whole window and the lane's annotation holds every gene the reference does.
In a carrier lane the alignment stops at the start of _CFHR3_ and resumes past
_CFHR1_, the ribbons leave that stretch of the reference unplaced, and the
lane's own annotation has no model there to draw. The flanking genes, _CFH_ on
one side and _CFHR4_ onward on the other, place in every lane.

<Figure caption="The CFH cluster on hg38 over eight HPRC haplotype lanes placed by the graph's own alignment, each lane drawing its own CAT gene models on its own contig. The non-carrier lanes align straight through; in the carrier lanes the alignment stops before CFHR3 and resumes past CFHR1, and nothing is drawn in between." src="/img/multiway_synteny/hprc_cfh_haplotypes.png" />

The four carriers also sort together, at the bottom of this stack, because lane
order is densest first over the fetched window and a lane whose alignment skips
the cluster places less of it; `rowOrder` is what pins an order that has to
hold.

## The whole chromosome

The deletion reads the same way at any zoom the index serves. Over the whole of
chr1 the coarse tier answers the fetch in one pass and the picture is the
assembly: the centromere splits each lane where the graph aligns nothing, and a
haplotype whose chr1 was assembled as two scaffolds shows one of them, with the
other named in its header. The track menu's **Level of detail** entry picks the
tier by hand.

<Figure caption="All of hg38 chr1 over the eight haplotype lanes, served from the coarse tier of the graph-derived index. Each lane is a haplotype's chromosome in its own frame, split at the centromere; three lanes name a second scaffold in their headers because their chr1 was assembled in two pieces." src="/img/multiway_synteny/hprc_chr1_whole.png" />

## Reproduce it end to end

The script fetches the graph, unpacks the eight haplotypes' walks in one pass
over it, indexes the PAF, fetches and trims each haplotype's CAT annotation and
writes the config; see [Prerequisites](#prerequisites). The 63 GB download is
the cost, and it is kept, so a rerun starts from the file it already has.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_multiway_synteny.sh
bash build_hprc_multiway_synteny.sh
```

## See also

- [](/docs/tutorials/hg38_vertebrates_synteny)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph alignment and CAT annotations this page reads.
- Hickey G, et al. Pangenome graph construction from genome alignments with
  Minigraph-Cactus. Nat Biotechnol (2024).
  https://doi.org/10.1038/s41587-023-01793-w
- Armstrong J, et al. Progressive Cactus is a multiple-genome aligner for the
  thousand-genome era. Nature (2020). https://doi.org/10.1038/s41586-020-2871-y
