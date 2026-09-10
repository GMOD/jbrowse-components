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
Two more graphs are hosted in the same five files, on references JBrowse already
serves — a mouse strain graph over GRCm39 and the bovine super-pangenome over
ARS-UCD1.2 — and opening them needs no new adapters and no new track types. What
differs between the three is not the mechanism but **what each graph is able to
say**, and that difference is worth understanding before you build one of your
own.

## The three graphs, and the one thing that separates them

All three are SV-resolution minigraph rGFA. HPRC's is the `sv.gfa` stage of its
Minigraph-Cactus build, not the 63 GB base-level graph beside it; the mouse one
was built here with `minigraph -cxggs`; the bovine one is published by
[Leonard et al. 2023](https://doi.org/10.1186/s13059-023-02969-y). So the
tracks, the adapters and the coarse tier are identical in all three, and each is
served as:

| file                      | what it holds                                    |
| ------------------------- | ------------------------------------------------ |
| `<prefix>.segs.bed.gz`    | one row per graph node, with its rank            |
| `<prefix>.links.bed.gz`   | one row per edge per endpoint                    |
| `<prefix>.bubbles.bed.gz` | `gfatools bubble` output                         |
| `<prefix>.alleles.bed.gz` | one row per allele, with a CIGAR for its size    |
| `<prefix>.tier10000.*`    | one node per bubble, so a chromosome is drawable |

What separates them is **carriage** — whether the graph can say _which_ samples
carry a given allele:

- **HPRC** can, because Minigraph-Cactus records per-haplotype walks. Its
  `.gbz.db` answers carriage at query time and its `wave` VCF answers it as a
  callset.
- **Bovine** can, indirectly. The published graphs are plain GFA with 12 `P`
  lines, so the walks are there; `vg deconstruct` turns them into a VCF.
- **Mouse** cannot, at all. `minigraph` writes no `P` or `W` lines — a line
  census of the finished rGFA finds `H`, `S` and `L` and nothing else — so the
  information is not in the file to recover.

That is not a bug in any of them. It is the difference between a graph built to
record structure and a graph built to record haplotypes, and it decides what
figures the data can honestly support.

## Mouse: a deletion that appears as an insertion

The mouse graph is 19 sequence sets — GRCm39 plus 18 inbred and wild-derived
strain assemblies from the Mouse Genomes Project, as rehosted in UCSC GenArk.

Each chromosome's graph is one `minigraph` call over the reference followed by
the 18 strains, in that order — the reference first is what makes it rank 0 and
every allele below it rank 1 or more:

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
minigraph -cxggs -t "$THREADS" $(tr '\n' ' ' < "chrom/$c/order.txt")
```

The best first locus is `Nnt`, and not because it is the biggest thing in the
graph. C57BL/6J carries a five-exon deletion in `Nnt` (exons 7–11, published as
~17.8 kb) that abolishes the protein and is why B6J mice are glucose intolerant.
**GRCm39 _is_ C57BL/6J.** So the graph's backbone is the strain with the
deletion, and the deletion shows up with the opposite sign from every
description of it in the literature: as sequence the _other_ strains carry and
the reference lacks.

<Figure caption="The Nnt locus on GRCm39 over 160 kb: RefSeq genes, the bubbles lane, the allele inventory drawn at each allele's real size, and the rGFA segments, over the same window as an anchored graph. The 16 kb allele hangs below the point in Nnt where it attaches, and it is an insertion because the reference is the strain that lacks the sequence." src="/img/pangenome/mouse_nnt.png" />

Reading it off the hosted allele inventory rather than off the picture:

```bash
tabix https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.alleles.bed.gz \
  chr13:119440000-119600000
```

gives exactly one allele over 10 kb in the window — an insertion of 16,458 bp at
`chr13:119,511,984` with CIGAR `13M16458I`, inside `Nnt`
(`chr13:119,472,063-119,566,380`) — with three smaller insertions of 7,101,
4,313 and 1,290 bp beside it.

16,458 bp is not 17,800 bp, and the difference is instructive rather than an
error. A published deletion size is measured on the B6 side, between its
breakpoints; minigraph's insertion is the non-reference sequence the other
strains carry at the point where it attaches. They agree in position and in
scale, which is as much as either measurement claims.

:::note

The allele lane is an `AlignmentsTrack` over the allele inventory rather than a
feature track, and that is what makes the 16 kb readable. An insertion consumes
almost no reference, so on a plain feature track a 16 kb insertion and a 50 bp
one both draw at the same minimum width. The CIGAR is what lets it be drawn at
its real magnitude.

:::

## Mouse: H2, where the strains actually diverge

`H2` is mouse's MHC and the locus the mouse pangenome literature leads with. The
window below is the class I (K) region, picked by measurement the same way the
loci on the HPRC page are: 44 bubbles and 94 segments in 150 kb, against 503
segments for the full K-to-D span, which draws as a thread.

<Figure caption="The H2 class I region on GRCm39: RefSeq genes, the segments-per-bubble curve, and the rGFA segments, with the same window as an anchored graph. Four insertions over 1.5 kb sit in the window, the largest 2,909 bp." src="/img/pangenome/mouse_h2.png" />

## Cattle: where the graph and the callset disagree, and both are right

The bovine super-pangenome is 12 assemblies over the 29 autosomes on ARS-UCD1.2
(= UCSC `bosTau9`), and the panel is unusually wide for a livestock pangenome:
nine _Bos taurus_ and _Bos indicus_ breeds plus yak, bison and gaur.

The BoLA class II region around `BTNL2` is where its two routes say different
things about the same 124 kb.

The **graph route** reports 52 segments and 7 bubbles here, with two very large
insertions — 157,021 bp and 110,779 bp. But it can only attribute them by
convention: the published graphs record no `SR`, so rank is the order the 12
paths appear in, and `firstSeenIn` in the allele file means "the first of that
fixed order carrying this segment". Nothing in the BED files says who _else_ has
it.

The **variant route** does say, and it is one call per chromosome over the same
graph the BED files came from:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
```

That gives 26 records in this window, and the site at `chr23:25,864,769` is
nine-allelic — reference span 84 kb, longest alternate 362 kb — with a genotype
row reading `1 2 3 4 1 5 6 7 8 9 1`. Angus, gaur and yak share one allele; the
other eight assemblies each carry their own. Cattle MHC behaving exactly like
human MHC, and invisible in the graph lanes.

<Figure caption="The BoLA class II region on ARS-UCD1.2: RefSeq genes, the bubbles lane, the allele inventory, the deconstructed callset with one row per assembly, and the rGFA segments, over the same window as an anchored graph. The callset lane is what distinguishes nine alleles that the graph lanes can only show as two large insertions." src="/img/pangenome/bovine_bola.png" />

## Cattle: a whole chromosome, off the coarse tier

The level-of-detail tier is one node per bubble instead of one per segment,
which is what makes a whole chromosome drawable — and it is not a human-only
trick. Over all 52.5 Mb of `bosTau9` chr23 the _fine_ segments track refuses
with "Too many features"; the tier draws.

<Figure caption="All 52.5 Mb of ARS-UCD1.2 chr23 with the RefSeq genes, the segments-per-bubble curve and the bubble tier on one axis, and the tier drawn as an anchored graph below. Every x in the graph pane is a chr23 coordinate, so the backbone runs left to right under the linear view." src="/img/pangenome/bovine_whole_chromosome.png" />

One setting has to move for this to render at all: the graph view refuses a cut
wider than 5 Mb, which is a proxy for node count and a good one only at segment
granularity. A session pointed at a tier says `maxRegionBp` explicitly.
`maxGraphNodes` is untouched and still counts what actually came back.

The layout is anchored rather than force-directed, and at this scale that is
forced: one node per bubble in reference order with one edge between consecutive
bubbles is a **path**, and a force layout of a path is a long wiggly line that
says nothing about the chromosome.

## Why every figure on this page is anchored

This is the one place the two non-human graphs behave differently from HPRC's in
practice, and it is worth stating because it is not what the HPRC page would
lead you to expect. Its locus figures are force-directed, and they work because
90 human haplotypes make genuinely tangled bubbles at the loci it picks — C4,
amylase, MHC class II.

Neither panel here has that density anywhere. The BoLA cut is 90 nodes and 118
edges; the H2 cut is 149 and 206; Nnt is 98 and 130. On a connected drawing, a
**path** has exactly n−1 edges, so all three are chains with a handful of loops
in them, and a force layout draws a chain as an arc. Rendered, the H2 arc fills
the pane at 17% zoom and runs off the bottom edge with nothing about `H2`
legible in it.

That is a consequence of panel size, not of species: 12 or 19 assemblies at SV
resolution simply do not produce the tangles that 90 haplotypes do. Anchored
puts every x on a reference coordinate, so the backbone runs under the linear
view's axis and each allele hangs below where it attaches — which is also what
lets the graph pane and the lanes above it be read as one picture. Reach for the
force layout when the bubbles lane tells you a cut is genuinely tangled, and
check the node and edge counts in the pane's own header before assuming it is.

## Building one of these for your own panel

Both graphs above are reproducible from committed scripts:

- [`scripts/build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
  downloads the assemblies, extracts one sequence per chromosome renamed to
  PanSN, runs `minigraph -cxggs` per chromosome, renumbers and concatenates, and
  projects the five files. It is 27.4 h of minigraph wall time at 8 threads.
- [`scripts/build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
  downloads the Zenodo archive, reconstructs rGFA tags from the `P` lines with
  [`scripts/gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py),
  projects the same five files, and runs `vg deconstruct` for the callset. About
  30 minutes after the download.

Both write a `README.txt` beside the data recording the source and its
checksums, what was modified, the tool versions and the audits that ran. The
audits are the part worth copying: the bovine build refuses unless the reference
path of every chromosome sums to `bosTau9`'s own length for it, and the mouse
build refuses on an unexpected `SN` tag or a duplicate segment id after
renumbering. Each of those failures would otherwise produce a graph whose
coordinates are quietly wrong, and every check downstream would pass on it.

If your own graph has `P` or `W` lines, use
[`scripts/build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
rather than `build_rgfa_tabix.sh`: it walks the paths, so it can write the
`SM:Z:` carriage tag that rGFA has nowhere to put, and the graph view will show
which samples cross each node.
