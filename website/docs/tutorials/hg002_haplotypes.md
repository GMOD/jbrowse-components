---
title: Comparing one genome's two haplotypes (T2T-HG002)
sidebar_label: Haplotype synteny (T2T-HG002)
description:
  Draw HG002's maternal and paternal haplotypes against each other from the
  published chain, and read the 8p23.1 inversion off the ribbons
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** T2T-HG002 v1.2 ships both haplotypes as contigs of a single assembly,
and the Q100 project publishes the maternal-to-paternal alignment beside it, so
comparing an individual's two haplotypes is one assembly, one alignment file and
no pipeline.

## One assembly, both haplotypes

Most synteny compares two assemblies. This one does not. The v1.2 release is a
single FASTA whose contigs carry the haplotype in the name, `chr1_MATERNAL` and
`chr1_PATERNAL` and so on, so maternal against paternal is a genome aligned
against **itself**: two panels of one assembly, framed on the two copies of a
chromosome.

That makes it a self-alignment, the same arrangement
[oat against itself](/docs/tutorials/homoeolog_synteny) uses for a polyploid's
subgenomes, for a different reason. The practical consequence is that the
synteny track names its own assembly twice in `assemblyNames`, and no second
assembly is configured anywhere.

## The config

Everything is served already, so the whole config is the assembly and two
tracks. The assembly needs only a name and the URL of its sequence: the adapter
is picked from the file extension, and the `.fai` and `.gzi` beside it are found
the same way.

```json
{
  "assemblies": [
    {
      "name": "hg002v1.2",
      "displayName": "T2T-HG002 v1.2 (diploid)",
      "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz"
    }
  ]
}
```

The alignment is the Q100 project's own chain between the haplotypes, read as
published with no conversion. Both endpoints are the same assembly, which is
what makes it a self-alignment:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg002v1.2_mat_vs_pat",
  "name": "Maternal vs paternal (Q100 chain)",
  "assemblyNames": ["hg002v1.2", "hg002v1.2"],
  "adapter": {
    "type": "ChainAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/changes/hg002v1.2_to_other_haplotype.chain.gz",
    "queryAssembly": "hg002v1.2",
    "targetAssembly": "hg002v1.2"
  }
}
```

That one track also goes in each panel. Turned on from a panel's own track
selector, a synteny track draws its alignments as ordinary features on that
panel's ruler rather than as ribbons between two, which is where the boundaries
the last section is about become visible. It needs no second file and no extra
config: `LGVSyntenyDisplay` is the display a synteny track takes in a plain
linear view, and it colors by strand already.

This resolves per panel because the published chain carries both directions.
Every alignment appears in it twice, once with the maternal contig as the query
and once with the paternal one, so the maternal panel finds the
maternal-coordinate copy and the paternal panel the paternal-coordinate copy.
The blocks in a panel and the ribbons above them are then the same records, and
cannot disagree.

The project also publishes the same alignment as bigChain, one file per
haplotype's coordinates (`mat2pat` built on the maternal contigs, `pat2mat` on
the paternal ones), for loading as a plain feature track instead.

The project also publishes the heterozygous sites called between the two
haplotypes, which the last section uses as a check on the alignment:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg002v1.2_hetsites",
  "name": "Heterozygous sites",
  "assemblyNames": ["hg002v1.2"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/haplotypes/v1.2.hetsites.bb"
  }
}
```

A chain this size is read whole, so nothing needs indexing. If you bring your
own alignment and it outgrows that, convert it with `chain2paf` and
[`jbrowse make-pif`](/docs/cli#jbrowse-make-pif) and load the result with
`PairwiseIndexedPAFAdapter` instead.

## Opening the two haplotypes

Launch a linear synteny view with the maternal copy of a chromosome on top and
the paternal copy below, both from the same assembly. Type a locus into either
panel's search box to move it.

The two panels move independently, which matters more here than in a
cross-species comparison because both rulers carry the same coordinates and it
is easy to assume they are locked. They are not, and the same number is not the
same sequence: an indel anywhere upstream offsets one haplotype against the
other, so a locus typed into both panels frames two places that do not
correspond. Three things bring them back together:

- right-click a ribbon and choose **Center on feature**, which recenters both
  panels on that alignment
- right-click a chain block in a panel and choose **Move other panel to the
  matching region**, which sends the other panel to the sequence this panel's
  visible window aligns to
- turn on **Link views** from the **View options** button in the view header,
  which replays a pan or zoom in one panel onto the other

Which of the first two to reach for depends on the size of the alignment.
Centering on a feature moves both panels to its midpoint, which is the right
answer for a short block and the wrong one for a chain tens of megabases long:
its midpoint is nowhere near what is on screen. Moving the other panel instead
resolves the visible window through the alignment's own CIGAR, so it keeps the
panel you are reading where it is and matches the other one to it, scale
included. It needs the chain track open in the panel, which is the same track
the ribbons come from.

<Figure caption="The same 70 kb of coordinates typed into both panels, on the collinear block left of the inversion. Top: the paternal window lands past the end of that chain, so its chain lane is empty, its gene lane is a different neighbourhood, and the ribbon leaves the frame. Bottom: after moving the other panel from a maternal chain block, the corresponding paternal sequence is under it and the alignment's indel wedge stands upright." src="/img/hg002_haplotypes_follow_panel.png" />

Link views is the third option and a different one: it moves both panels by the
same number of base pairs, so it holds only as long as the haplotypes stay in
register and drifts again across the next indel. Re-anchoring on an alignment is
what corrects it.

The vertical **guidelines** each panel draws are worth keeping on here, and are
the toggle under a panel's own menu, **Show...** then **Show guidelines**. A
long collinear ribbon is one flat block of colour with no landmark in it, so
without the ticks behind it there is nothing in the frame that says how far
along the block a feature sits, or how far the two panels have drifted since
they were last anchored. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view) for the
rest of the view's controls.

## The 8p23.1 inversion

Chromosome 8 carries a large inversion polymorphism at 8p23.1, between two
blocks of segmental duplication that hold olfactory receptor and defensin
repeats, REPD and REPP. Its reported size is a 3.8 to 4.5 Mb segment (Bosch _et
al._ 2009). HG002 is heterozygous for it, so it is one of the few places where
the two haplotypes of one person disagree at a scale a whole-chromosome view can
show.

Colored by strand, the inversion is the one block whose ribbons sweep across the
frame, and the same block is the long reverse-strand bar in each panel's chain
track. The flanks stay collinear at this scale, which is what makes it legible:
a segment reads as inverted only because the sequence around it did not move.
They are not uniformly collinear, though. Smaller reverse-strand chains sit
inside them, drawn as short bars in the panels and as thin off-color threads
among the flank ribbons, well short of the scale the sweep is drawn at.

The assembly has no gene annotation of its own. What it has is the JHU Liftoff
annotation of HG002 v1.1, published beside it as one bgzipped GFF per haplotype,
whose contig names already match and whose coordinates are within a few bases of
v1.2 across chromosome 8. Added as a track per panel it says what kind of
sequence the inverted block is: ordinary gene-carrying euchromatin, not a blank
segment that happened to flip.

At 9 Mb no gene in that lane can carry a label. Add a second lane over the same
GFF and cut it to a few genes with **Edit filters...** in its track menu: those
do get labels, and they read in one order under the maternal panel and in the
reverse order under the paternal one.

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) across 9 Mb of 8p23.1, ribbons colored by strand. The inverted block is the long blue bar in both panels and the sweep crossing between them, and the labelled lane beside the ribbons carries the same six genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

Set the ribbon coloring from the palette button in the view header, and turn on
**Show curved lines** under **View options** then **Show...** so a block landing
far from where it started is easier to follow across the gap.

The Liftoff GFF carries its gene symbol in `gene_name` and no `Name` attribute,
so the default label falls through to the assembly's own ordinal identifier
(`hg002_chr8_maternal_195` for ENPP7P1). Point the display's name label at
`gene_name` instead:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg002_genes_mat",
  "name": "Genes (JHU Liftoff v0.6, HG002 v1.1 MAT)",
  "assemblyNames": ["hg002v1.2"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": {
      "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1.MAT.loff.v0.6.gff.gz"
    },
    "index": {
      "location": {
        "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1.MAT.loff.v0.6.gff.gz.tbi"
      },
      "indexType": "TBI"
    }
  },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "displayId": "hg002_genes_mat-LinearBasicDisplay",
      "labels": {
        "name": "jexl:get(feature,'gene_name') || get(feature,'name') || get(feature,'id')"
      }
    }
  ]
}
```

## Collinear does not mean identical

Structural agreement and sequence identity are separate claims, and the view
above only makes the first one. Zooming into the collinear block beside the
inversion and turning on the heterozygous-sites track makes the second one
checkable in the same frame: the ribbon runs as one band apart from a single
indel, and the sites underneath it are dense in both panels. The solid run of
sites beneath that indel on the paternal panel is where the two haplotypes stop
agreeing base for base.

At this width the gene lane is readable, and each panel carries its own
haplotype's annotation rather than one shared lane, so the sites can be read
against the genes they fall in.

<Figure caption="A window inside the collinear block left of the inversion, with each haplotype's genes and heterozygous sites under its own panel. The ribbon runs as one band, so the haplotypes agree structurally, while the sites below show they differ at base level throughout. The pale wedge is an indel." src="/img/hg002_haplotypes_hetsites.png" />

This has to be its own view for two reasons worth knowing before you try to
combine them. Across the whole inversion the het-site track is over its
feature-count limit and paints a warning instead of data. And a window centered
on a breakpoint cannot work at all: the flanking sequence and the inverted
sequence land megabases apart on the other haplotype, so no single paternal
window contains both and the ribbons come back empty. Frame one side or the
other.

Each site is named for its own coordinate and alleles, so at this density the
labels are the ruler written a second time over the data. The track menu's
**Show labels** setting turns them off.

## What this alignment cannot show

The published chains were built by aligning each haplotype to a target with
minimap2, splitting the result, and trimming it to one-to-one; the Q100
repository's `assemblies/changes/README.txt` gives the pipeline. Three
consequences bound what the view can be read to mean, and each one is an absence
rather than a mark on screen:

- **Only homologous chromosomes were kept.** An alignment between one chromosome
  and a different-numbered one on the other haplotype was discarded, so
  interchromosomal rearrangement cannot appear here at all. Its absence is a
  property of the file, not a finding about HG002.
- **Chains are split at large gaps.** No single chain therefore holds an indel
  above that threshold, and the largest indels in the file are the threshold
  rather than a measurement. The chain track is where this is visible: the gaps
  between its blocks are where the alignment was cut, not places the haplotypes
  stop corresponding.
- **The alignment is trimmed to one-to-one.** Every position has exactly one
  counterpart, so a segmental duplication is represented once rather than fanned
  out. This is what makes the view easy to read, and also what makes it the
  wrong file for asking about copy number.

For a comparison that keeps those, align the haplotypes yourself and load the
result as in [](/docs/tutorials/synteny_visualization).

## See also

- [](/docs/tutorials/homoeolog_synteny), the same self-alignment arrangement on
  a polyploid rather than a diploid
- [](/docs/tutorials/synteny_visualization), for aligning two genomes yourself
  instead of using a published alignment
- [](/docs/tutorials/genomes_synteny), the hosted pairwise alignments on
  genomes.jbrowse.org
- [](/docs/user_guides/linear_synteny_view)

## References

- The Q100 / T2T-HG002 assembly releases, including v1.2 and the chain
  construction described in `assemblies/changes/README.txt`.
  https://github.com/marbl/HG002
- Bosch, N. _et al._ Nucleotide, cytogenetic and expression impact of the human
  chromosome 8p23.1 inversion polymorphism. _PLOS ONE_ 4, e8269 (2009).
  https://doi.org/10.1371/journal.pone.0008269
- Taudien, S. _et al._ Polymorphic segmental duplications at 8p23.1 challenge
  the determination of individual defensin gene repertoires and the assembly of
  a contiguous human reference sequence. _BMC Genomics_ 5, 92 (2004).
  https://doi.org/10.1186/1471-2164-5-92
