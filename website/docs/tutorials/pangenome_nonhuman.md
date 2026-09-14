---
title: Pangenomes beyond human, mouse and cattle
sidebar_label: Pangenome (mouse, cattle)
description:
  Open a mouse strain pangenome and the bovine super-pangenome the same way the
  HPRC graph opens, and see what changes when the species does
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

The tracks and adapters on the
[HPRC pangenome page](/docs/tutorials/pangenome_hprc/) work for other species
too. We host two more graphs the same way, on references JBrowse already serves:
a mouse strain graph over GRCm39 and the bovine super-pangenome over ARS-UCD1.2.
Opening them needs no new adapters and no new track types. The three graphs
differ in **what each one records.**

## The three graphs, and what separates them

All three are SV-resolution minigraph rGFA, so the tracks, the adapters and the
coarse tier are identical. We serve each graph as the same five files:

| file                      | what it holds                                    |
| ------------------------- | ------------------------------------------------ |
| `<prefix>.segs.bed.gz`    | one row per graph node, with its rank            |
| `<prefix>.links.bed.gz`   | one row per edge per endpoint                    |
| `<prefix>.bubbles.bed.gz` | `gfatools bubble` output                         |
| `<prefix>.alleles.bed.gz` | one row per allele, with a CIGAR for its size    |
| `<prefix>.tier10000.*`    | one node per bubble, so a chromosome is drawable |

The graphs differ in **carriage**, which is whether a graph records _which_
samples carry a given allele.

- **HPRC** records carriage. Minigraph-Cactus records a walk per haplotype, so
  you can query carriage against the graph and against a callset beside it.
- **Cattle** records carriage indirectly. The published graphs are plain GFA
  with one path per assembly, and `vg deconstruct` turns those paths into a VCF.
- **Mouse** does not record carriage. `minigraph` writes no path lines, so the
  file holds no carriage to recover.

Only a graph that records haplotypes identifies who carries an allele.

## Mouse: a deletion that appears as an insertion

The mouse graph is GRCm39 plus eighteen inbred and wild-derived strain
assemblies from the Mouse Genomes Project, as rehosted in UCSC GenArk. Each
chromosome comes from one `minigraph` call over the reference followed by the
strains. The reference goes first, which gives it rank 0.

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
minigraph -cxggs -t "$THREADS" $(tr '\n' ' ' < "chrom/$c/order.txt")
```

Start at `Nnt`. C57BL/6J carries a well-known multi-exon deletion there that
abolishes the protein and makes B6J mice glucose intolerant. **GRCm39 is
C57BL/6J**, so the backbone of this graph is the strain with the deletion. The
graph therefore shows the deletion as sequence that the _other_ strains carry
and the reference lacks, the opposite sign from every description of it.

<Figure caption="The Nnt locus on GRCm39: RefSeq genes, the bubbles lane, the allele inventory drawn at each allele's real size, and the rGFA segments, over the same window as an anchored graph. The one large allele sits inside Nnt, and it is an insertion because the reference is the strain that lacks the sequence." src="/img/pangenome/mouse_nnt.png" />

An insertion consumes almost no reference, so a plain feature track draws a
large insertion and a small one at the same minimum width. The allele lane reads
the file as alignments and draws each allele at its real size from its CIGAR.

## Cattle: where the graph and the callset show different things

The bovine super-pangenome is twelve assemblies on ARS-UCD1.2. The panel is
unusually wide for a livestock pangenome, with taurine and indicine breeds plus
yak, bison and gaur.

In the BoLA class II region the graph and the callset show different things. The
**graph** shows a lot of sequence present in some assemblies and absent from the
reference. It attributes that sequence only by convention. These graphs record
no construction rank, so `firstSeenIn` in the allele file names the first
assembly in a fixed list, and that assembly need not carry the sequence.

The **callset** attributes each allele. One `vg deconstruct` call per chromosome
over the same graph gives a genotype per assembly:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
```

<Figure caption="The BoLA class II region on ARS-UCD1.2: RefSeq genes, the bubbles lane, the deconstructed callset with one row per assembly, and the allele inventory. The callset resolves alleles the graph lanes can only show as bulk presence and absence." src="/img/pangenome/bovine_bola.png" />

Read the genotype rows across. Most assemblies carry a different allele here,
much as human MHC does. The graph lanes around the callset show none of these
genotypes.

## A whole chromosome, off the coarse tier

The level-of-detail tier has one node per bubble, which makes a whole chromosome
drawable, and it works on the cattle graph too. Type `chr23` on ARS-UCD1.2 with
the tier and the bubble curve showing. Over a full cattle chromosome the _fine_
segments track refuses with "Too many features", and the tier draws.

<Figure caption="A whole ARS-UCD1.2 chromosome with the RefSeq genes, the segments-per-bubble curve and the bubble tier on one axis. BoLA is the densest stretch of the curve." src="/img/pangenome/bovine_whole_chromosome.png" />

A graph view pointed at a tier raises `maxRegionBp` explicitly. The view refuses
a cut wider than 5 Mb. That width limit stands in for node count, and it tracks
node count well only at segment granularity.

:::note

These panels hold a dozen or two assemblies, against ninety haplotypes for HPRC.
Their cuts are chains with a few loops, and the anchored layout often reads
better. Check the node and edge counts in the graph pane's header before
switching to the force layout. Use the force layout where the bubbles lane
reports a tangled window.

:::

## Finding the loci

`Nnt` and BoLA are both loci someone had already written about. Most panels have
no published literature to read, so the loci have to come from the graph. The
coarse tier records how many segments each bubble holds. Ranking the tier by
that count reports where the graph varies most, and intersecting the result with
the reference annotation names the loci.

On these two datasets the ranking recovers the beta-defensin cluster, the
vomeronasal receptor and Speer families, the immunoglobulin heavy chain locus
and BoLA, without a curated list. The densest window it returns for mouse is a
single bubble inside one intron of `Dock2`, at `chr11:34,516,044-34,560,497` on
GRCm39:

<Figure caption="The densest bubble in the mouse graph that still fits in one cut, found by ranking the coarse tier and named off the reference annotation. The gene lane holds nothing but intron, the bubbles lane is a single row, the allele inventory draws each alternative path at its real size, and the graph carries one label naming the whole cut as a superbubble, with Dock2 pinned under the backbone." src="/img/pangenome/mouse_dock2.png" />

The _Dock2_ cut is the exception to the note above. Every other panel on this
page is a chain and is drawn anchored. The _Dock2_ cut is loops hanging off a
backbone, the structure force-directed layout suits, and the ranking found it
with no prior knowledge of mouse. Clicking the superbubble's label opens it. The
view derives the bubbles inside from the popped graph's layering, so you can
keep descending level by level, as
[a bubble inside a bubble](/docs/tutorials/pangenome_graph_nested) shows.

Because the ranking reads the graph, the method repeats on a panel nobody has
written about yet.
[`generatePangenomeLoci.ts`](https://github.com/GMOD/jb2hubs/blob/main/website/generatePangenomeLoci.ts)
in the genomes.jbrowse.org repo computes the ranking. That repo publishes the
derived catalogues at
[genomes.jbrowse.org/pangenomes](https://genomes.jbrowse.org/pangenomes) so a
locus can be opened without building anything.

## Building one for your own panel

Both graphs are reproducible from committed scripts:

- [`build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
  downloads the assemblies, extracts one sequence per chromosome renamed to
  PanSN, runs `minigraph` per chromosome, concatenates, and projects the five
  files. It is a long run, most of a day of alignment.
- [`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
  downloads the published archive, recovers rGFA tags from its path lines with
  [`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py),
  projects the same five files, and deconstructs the callset. It takes about
  half an hour after the download.

Both scripts write a `README.txt` beside the data. The README records the
source, the modifications, the tool versions and the audits that ran. Copy the
audits into your own build. Each build stops unless the reference path
reproduces the reference chromosome lengths, and stops on a duplicate segment id
after renumbering. Without these audits, either failure produces a graph with
wrong coordinates, and every downstream check passes on it.

If your graph has path lines, use
[`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
in place of `build_rgfa_tabix.sh`. The PGGB script walks the paths and writes a
carriage tag, which rGFA has no field for. The graph view then shows which
samples cross each node.
