---
title: Pangenomes beyond human, mouse and cattle
sidebar_label: Pangenome (mouse, cattle)
description:
  Open a mouse strain pangenome and the bovine super-pangenome the same way the
  HPRC graph opens, and see what changes when the species does
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: download
---

**TL;DR:** the machinery on the
[HPRC pangenome page](/docs/tutorials/pangenome_hprc/) is not human-specific.
Two more graphs are hosted the same way, on references JBrowse already serves: a
mouse strain graph over GRCm39 and the bovine super-pangenome over ARS-UCD1.2.
Opening them needs no new adapters and no new track types. What differs between
the three is **what each graph is able to say.**

## The three graphs, and what separates them

All three are SV-resolution minigraph rGFA, so the tracks, the adapters and the
coarse tier are identical, and each is served as the same five files:

| file                      | what it holds                                    |
| ------------------------- | ------------------------------------------------ |
| `<prefix>.segs.bed.gz`    | one row per graph node, with its rank            |
| `<prefix>.links.bed.gz`   | one row per edge per endpoint                    |
| `<prefix>.bubbles.bed.gz` | `gfatools bubble` output                         |
| `<prefix>.alleles.bed.gz` | one row per allele, with a CIGAR for its size    |
| `<prefix>.tier10000.*`    | one node per bubble, so a chromosome is drawable |

What separates them is **carriage**: whether the graph can say _which_ samples
carry a given allele:

- **HPRC** can. Minigraph-Cactus records per-haplotype walks, so carriage is a
  query against the graph and a callset beside it.
- **Cattle** can, indirectly. The published graphs are plain GFA with one path
  per assembly, so `vg deconstruct` turns those paths into a VCF.
- **Mouse** cannot. `minigraph` writes no path lines at all, so the information
  is not in the file to recover.

Only a graph that records haplotypes can say who carries an allele.

## Mouse: a deletion that appears as an insertion

The mouse graph is GRCm39 plus eighteen inbred and wild-derived strain
assemblies from the Mouse Genomes Project, as rehosted in UCSC GenArk. Each
chromosome is one `minigraph` call over the reference followed by the strains,
reference first, which is what makes it rank 0:

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
minigraph -cxggs -t "$THREADS" $(tr '\n' ' ' < "chrom/$c/order.txt")
```

Start at `Nnt`. C57BL/6J carries a well-known multi-exon deletion there that
abolishes the protein and is why B6J mice are glucose intolerant, and **GRCm39
is C57BL/6J**, so the backbone of this graph is the strain with the deletion.
The deletion shows up with the opposite sign from every description of it: as
sequence the _other_ strains carry and the reference lacks.

<Figure caption="The Nnt locus on GRCm39: RefSeq genes, the bubbles lane, the allele inventory drawn at each allele's real size, and the rGFA segments, over the same window as an anchored graph. The one large allele sits inside Nnt, and it is an insertion because the reference is the strain that lacks the sequence." src="/img/pangenome/mouse_nnt.png" />

The allele lane is what makes that readable. An insertion consumes almost no
reference, so on a plain feature track a large one and a small one draw at the
same minimum width; reading the file as alignments lets each allele be drawn at
its real size from its CIGAR.

## Cattle: where the graph and the callset say different things

The bovine super-pangenome is twelve assemblies on ARS-UCD1.2, and the panel is
unusually wide for a livestock pangenome: taurine and indicine breeds plus yak,
bison and gaur.

The BoLA class II region is where its two routes diverge. The **graph** shows
that a lot of sequence is present in some assemblies and absent from the
reference, but it can only attribute it by convention: these graphs record no
construction rank, so `firstSeenIn` in the allele file means "first in a fixed
list", not "carries it".

The **callset** can say. One `vg deconstruct` call per chromosome over the same
graph gives a genotype per assembly:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
```

<Figure caption="The BoLA class II region on ARS-UCD1.2: RefSeq genes, the bubbles lane, the allele inventory, the deconstructed callset with one row per assembly, and the rGFA segments, over the same window as an anchored graph. The callset lane resolves alleles the graph lanes can only show as bulk presence and absence." src="/img/pangenome/bovine_bola.png" />

Read the genotype rows across: most assemblies carry a different allele here,
which is cattle MHC behaving much like human MHC. None of it is visible in the
graph lanes above.

## A whole chromosome, off the coarse tier

The level-of-detail tier is one node per bubble instead of one per segment,
which is what makes a whole chromosome drawable, and it is not a human-only
trick. Over a full cattle chromosome the _fine_ segments track refuses with "Too
many features"; the tier draws.

<Figure caption="A whole ARS-UCD1.2 chromosome with the RefSeq genes, the segments-per-bubble curve and the bubble tier on one axis, and the tier drawn as an anchored graph below. Every x in the graph pane is a reference coordinate, so the backbone runs left to right under the linear view." src="/img/pangenome/bovine_whole_chromosome.png" />

Two settings make it work. The view refuses a cut wider than 5 Mb, which is a
proxy for node count and a good one only at segment granularity, so a session
pointed at a tier raises `maxRegionBp` explicitly. The layout is anchored rather
than force-directed: a tier is one node per bubble in reference order, which is
a chain, and a force layout draws a chain as an arc.

:::note

That applies to the locus figures above too. These panels are a dozen or two
assemblies rather than ninety haplotypes, so their cuts are chains with a few
loops and the anchored layout reads better at every scale here. Check the node
and edge counts in the graph pane's header before reaching for the force layout;
it earns its place where the bubbles lane says a window is genuinely tangled.

:::

## Finding the loci

`Nnt` and BoLA are both loci someone had already written about, and that does
not generalise: a panel nobody has published on has no literature to read, which
is most panels. The graph can answer the question itself. The coarse tier
records how many segments each bubble holds, so ranking it says where the graph
varies most, and intersecting the result with the reference annotation names
what it found.

On these two datasets that recovers the beta-defensin cluster, the vomeronasal
receptor and Speer families, the immunoglobulin heavy chain locus and BoLA, with
nobody curating a list. The densest window it returns for mouse is a single
bubble sitting inside one intron of `Dock2`:

<Figure caption="The densest bubble in the mouse graph that still fits in one cut, found by ranking the coarse tier and named off the reference annotation. The gene lane holds nothing but intron, the bubbles lane is a single row, and the allele inventory below it draws each alternative path through that bubble at its real size." src="/img/pangenome/mouse_dock2.png" />

It is also the counterexample to the note above. Every other panel on this page
is a chain and is drawn anchored; this cut is loops hanging off a backbone,
which is the shape the force-directed layout exists for, and it was found by
ranking a file rather than by knowing anything about mouse.

Ranking the graph rather than the literature is what makes the method repeatable
for a panel nobody has written about yet. The ranking lives in
[`generatePangenomeLoci.ts`](https://github.com/GMOD/jb2hubs/blob/main/website/generatePangenomeLoci.ts)
in the genomes.jbrowse.org repo, which publishes the derived catalogues at
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
  projects the same five files, and deconstructs the callset. About half an hour
  after the download.

Both write a `README.txt` beside the data recording the source, what was
modified, the tool versions and the audits that ran. The audits are the part
worth copying: each build refuses unless the reference path reproduces the
reference's own chromosome lengths, and refuses on a duplicate segment id after
renumbering. Either failure would otherwise produce a graph whose coordinates
are quietly wrong, and every check downstream would pass on it.

If your own graph has path lines, use
[`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
rather than `build_rgfa_tabix.sh`: it walks the paths, so it can write the
carriage tag that rGFA has nowhere to put, and the graph view will show which
samples cross each node.
