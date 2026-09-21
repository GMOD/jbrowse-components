---
title: Pangenome (cattle)
description:
  Open the bovine super-pangenome, see where the graph shows sequence it cannot
  attribute, and deconstruct it into the callset that names which assembly
  carries what
guide_category: Tutorials
tutorial_category: Pangenomes
---

The bovine super-pangenome aligns twelve cattle assemblies against ARS-UCD1.2.
The panel is unusually wide for a livestock pangenome, with taurine and indicine
breeds beside yak, bison and gaur, so a locus that varies here varies across
most of the genus.

Each of those assemblies walks the graph as a named path, and `vg deconstruct`
turns those paths into a VCF. The same locus then reads as a graph showing where
sequence is present and absent, and as a callset naming who carries it.

We serve the graph as the same rGFA projections the
[HPRC pangenome page](/docs/tutorials/pangenome_hprc/) opens, so the tracks, the
adapters and the coarse tier are that page's.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way the HPRC page loads it

## Where the data comes from

The projections are hosted beside the graph:

- the segment and link index:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.segs.bed.gz
  and
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.links.bed.gz
- the bubble index:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz
- the allele inventory:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.alleles.bed.gz
- the coarse tier:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000
- the deconstructed callset:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz

[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) describes
what each of those files holds and how a graph produces them.

## Where the graph and the callset show different things

In the BoLA class II region the **graph** shows a lot of sequence present in
some assemblies and absent from the reference. It attributes that sequence only
by convention. These graphs record no construction rank, so `firstSeenIn` in the
allele file names the first assembly in a fixed list, and that assembly need not
carry the sequence.

The **callset** attributes each allele. One `vg deconstruct` call per chromosome
over the same graph gives a genotype per assembly:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# -p writes vg's own PackedGraph format, which deconstruct reads
vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
# -p names the reference path to decompose against; -a walks nested snarls
# too, so a bubble inside a bubble gets its own record rather than being
# folded into its parent's
vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
```

<Figure caption="The BoLA class II region on ARS-UCD1.2: RefSeq genes, the bubbles lane, the deconstructed callset with one row per assembly, and the allele inventory. The callset resolves alleles the graph lanes can only show as bulk presence and absence." src="/img/pangenome/bovine_bola.png" />

Read the genotype rows across. Most assemblies carry a different allele here,
much as human MHC does. The graph lanes around the callset show none of these
genotypes.

The mouse graph is the other end of this. `minigraph` writes no path lines at
all, so there is no callset to deconstruct and nothing recovers carriage.
[](/docs/tutorials/pangenome_mouse) works with what is left.

## A whole chromosome, off the coarse tier

The level-of-detail tier has one node per bubble, which makes a whole chromosome
drawable. Type `chr23` on ARS-UCD1.2 with the tier and the bubble curve showing.
Over a full cattle chromosome the _fine_ segments track refuses with "Too many
features", and the tier draws.

<Figure caption="A whole ARS-UCD1.2 chromosome with the RefSeq genes, the segments-per-bubble curve and the bubble tier on one axis. BoLA is the densest stretch of the curve." src="/img/pangenome/bovine_whole_chromosome.png" />

A graph view pointed at a tier raises `maxRegionBp` explicitly. The view refuses
a cut wider than 5 Mb. That width limit stands in for node count, and it tracks
node count well only at segment granularity.

:::note

The bovine pangenome holds a dozen assemblies, against ninety haplotypes for
HPRC. Its cuts are chains with a few loops, and the anchored layout often reads
better. Check the node and edge counts in the graph pane's header before
switching to the force layout. Use the force layout where the bubbles lane
reports a tangled window.

:::

BoLA came out of the same ranking the
[mouse page](/docs/tutorials/pangenome_mouse#finding-the-loci) describes, which
ranks the coarse tier by segments per bubble and then names each entry off the
reference annotation. It is the densest stretch of chr23 in the figure above,
and the ranking found it without a curated list.

## Build it yourself

[`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
downloads the published archive, recovers rGFA tags from its path lines with
[`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py),
projects the files above, and deconstructs the callset. It takes about half an
hour after the download.

The script writes a `README.txt` beside the data recording the source, the
modifications, the tool versions and the audits that ran. Copy the audits into
your own build. The build stops unless the reference path reproduces the
reference chromosome lengths, and stops on a duplicate segment id after
renumbering. Without these audits, either failure produces a graph with wrong
coordinates, and every downstream check passes on it.

If your own graph has path lines, use
[`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
in place of `build_rgfa_tabix.sh`. The PGGB script walks the paths and writes a
carriage tag, which rGFA has no field for. The graph view then shows which
samples cross each node.

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_prepare_graph)

## References

- Leonard AS, Crysnanto D, Mapel XM, Bhati M, Pausch H. Graph construction
  method impacts variation representation and analyses in a bovine
  super-pangenome. Genome Biology. 2023;24:128.
  https://doi.org/10.1186/s13059-023-02969-y
- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
