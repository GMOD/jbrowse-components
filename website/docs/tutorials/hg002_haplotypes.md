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

Turn that same track on from each panel's own track selector too: in a plain
linear view a synteny track draws as blocks on that panel's ruler rather than as
ribbons, needing no second file and no extra config. It resolves per panel
because the published chain carries both directions, so the blocks in a panel
and the ribbons above them are the same records and cannot disagree. The project
also publishes the alignment as bigChain, one file per haplotype's coordinates,
for loading as a plain feature track instead.

The heterozygous sites called between the two haplotypes are published beside
it, and the last section uses them as a check on the alignment:

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

Both rulers carry the same coordinates, so it is easy to assume the panels are
locked together. They are not, which becomes
[its own step](#framing-both-panels-on-the-same-sequence) once you zoom in. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view) for the
rest of the controls.

## The 8p23.1 inversion

Chromosome 8 carries a large inversion polymorphism at 8p23.1, between two
blocks of segmental duplication that hold olfactory receptor and defensin
repeats, REPD and REPP. Its reported size is a 3.8 to 4.5 Mb segment (Bosch _et
al._ 2009). HG002 is heterozygous for it, so it is one of the few places where
the two haplotypes of one person disagree at a scale a whole-chromosome view can
show.

Color by strand, and the flanks are the control: a segment reads as inverted
only because the sequence around it did not move. They are not uniformly
collinear, though. Smaller reverse-strand chains sit inside them, drawn as thin
off-color threads well short of the scale the inversion is drawn at.

The assembly has no gene annotation of its own. The JHU Liftoff annotation of
HG002 v1.1 is published beside it, one bgzipped GFF per haplotype, with contig
names that already match and coordinates within a few bases of v1.2 across
chromosome 8. A lane per panel says what kind of sequence the inverted block is:
ordinary gene-carrying euchromatin, not a blank segment that happened to flip.

At 9 Mb no gene in that lane can carry a label. Add a second lane over the same
GFF and cut it to a few genes with **Edit filters...** in its track menu.

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) across 9 Mb of 8p23.1, ribbons colored by strand. The inverted block is the long blue bar in both panels and the sweep crossing between them. The labelled lane beside the ribbons carries the same genes in opposite orders, coloured by strand, so each one is the other panel's colour: an arrowhead is unreadable at this zoom and the colour is not." src="/img/hg002_haplotypes_8p23_inversion.png" />

Ribbon coloring is the palette button in the view header; **Show curved lines**,
under **View options** then **Show...**, makes a block landing far from where it
started easier to follow across the gap.

To see where else the two haplotypes disagree, put the same track on both axes
of a [dotplot view](/docs/user_guides/dotplot_view), the way
[oat against itself](/docs/tutorials/homoeolog_synteny) is drawn.

The Liftoff GFF carries its gene symbol in `gene_name` and no `Name`, so the
default label falls through to the assembly's own ordinal identifier
(`hg002_chr8_maternal_195` for ENPP7P1). Point the name label at `gene_name`:

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

## Framing both panels on the same sequence

Zoomed in, the same number stops being the same sequence: an indel anywhere
upstream offsets one haplotype against the other, and the offset accumulates.

Right-click a chain block in a panel and choose **Move other panel to the
matching region**. It walks that panel's visible window through the alignment's
CIGAR and sends its neighbour there, leaving the panel you are reading alone.
This is the one control that needs the chain track open in the panel.

<Figure caption="Maternal (top) and paternal (bottom) panels on the same 70 kb of coordinates, each carrying the chain blocks and its own haplotype's genes. The paternal window lands past the end of this chain, so nothing in it corresponds; moving it from a maternal chain block brings the matching sequence under it." src="/img/hg002_haplotypes_follow_panel.png" />

Two neighbouring controls do something different. **Center on feature**, on a
ribbon's right-click menu, moves both panels to the alignment's midpoint, which
on a chain tens of megabases long is nowhere near what is on screen. **Link
views**, under **View options**, replays a pan from one panel onto the other, so
it drifts again at the next indel.

Each panel's vertical **guidelines** (its menu, **Show...** then **Show
guidelines**) are on by default and carry the ruler's ticks down through the
ribbon, which is what places a feature inside a long collinear block.

## Collinear does not mean identical

Structural agreement and sequence identity are separate claims, and the view
above only makes the first one. Zoom into the collinear block beside the
inversion, turn on the heterozygous-sites track, and the second becomes
checkable in the same frame. Each panel carries its own haplotype's annotation,
so the sites can be read against the genes they fall in.

<Figure caption="A window inside the collinear block left of the inversion, with each haplotype's genes and heterozygous sites under its own panel. The ribbon runs as one band, so the haplotypes agree structurally, while the sites below show they differ at base level throughout. The pale wedge is an indel." src="/img/hg002_haplotypes_hetsites.png" />

This has to be its own view. Across the whole inversion the het-site track is
over its feature-count limit and paints a warning instead of data, and a window
centered on a breakpoint cannot work at all: the flanking and inverted sequence
land megabases apart on the other haplotype, so no single paternal window holds
both and the ribbons come back empty. Frame one side or the other.

Each site is named for its own coordinate and alleles, so at this density the
labels are the ruler written twice. Turn them off with **Show labels**.

## What this alignment cannot show

The published chains were built by aligning each haplotype to a target with
minimap2, splitting the result, and trimming it to one-to-one; the Q100
repository's `assemblies/changes/README.txt` gives the pipeline. Three
consequences bound what the view can be read to mean, and each one is an absence
rather than a mark on screen:

- **Only homologous chromosomes were kept.** Interchromosomal rearrangement
  cannot appear here at all, and its absence is a property of the file, not a
  finding about HG002.
- **Chains are split at large gaps.** The largest indels in the file are that
  threshold rather than a measurement, and the gaps between blocks in the chain
  track are where the alignment was cut, not places the haplotypes stop
  corresponding.
- **The alignment is trimmed to one-to-one.** A segmental duplication is
  represented once rather than fanned out, which makes the view easy to read and
  makes it the wrong file for asking about copy number.

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
- [](/docs/user_guides/dotplot_view), the whole-chromosome view of the same
  alignment

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
