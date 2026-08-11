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

**TL;DR:** T2T-HG002 v1.2 puts both haplotypes in one FASTA, as contigs named
`chr1_MATERNAL` and `chr1_PATERNAL`, so JBrowse loads it as a single assembly.
The Q100 project publishes the alignment between the two haplotypes, so nothing
has to be aligned, and the inversion at 8p23.1, which HG002 is heterozygous for,
draws as a sweep between the two panels.

## One assembly, both haplotypes

Most synteny compares two assemblies. This one does not: the v1.2 contigs carry
the haplotype in the name, so maternal against paternal is a genome aligned
against **itself**, two panels of one assembly framed on the two copies of a
chromosome. It is the arrangement
[oat against itself](/docs/tutorials/homoeolog_synteny) uses for a polyploid's
subgenomes, with the same practical consequence: the synteny track names its own
assembly twice in `assemblyNames`, and no second assembly is configured
anywhere.

## The config

Everything is served already. The assembly needs only a name and the URL of its
sequence: the adapter is picked from the file extension, and the `.fai` and
`.gzi` beside it are found the same way.

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

Turn that same track on from a panel's own track selector and it draws as blocks
on that panel's ruler rather than as ribbons, needing no second file. It
resolves in either panel because the published chain carries both directions, so
the blocks in a panel and the ribbons above them are the same records and cannot
disagree.

The heterozygous sites called between the two haplotypes are published beside
it, and [a later section](#collinear-does-not-mean-identical) uses them as a
check on the alignment:

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

**Add → Linear synteny view**, with `T2T-HG002 v1.2 (diploid)` in both rows. A
same-assembly pair is matched only by a track that names that assembly twice, so
the chain above is the one offered. Put the maternal copy of a chromosome on top
and the paternal below, and type a locus into either panel's search box to move
it.

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

Color the ribbons by strand, and the flanks are the control: a segment reads as
inverted only because the sequence around it did not move. They are not
uniformly collinear. Smaller reverse-strand chains sit inside them, drawn as
thin off-color threads far shorter than the inversion.

The assembly has no gene annotation of its own. The JHU Liftoff annotation of
HG002 v1.1 is published beside it, one bgzipped GFF per haplotype, with contig
names that already match and coordinates within a few bases of v1.2 across
chromosome 8. A lane per panel says what kind of sequence the inverted block is:
ordinary gene-carrying euchromatin, not a blank segment that happened to flip.

That GFF carries its gene symbol in `gene_name` and no `Name`, so the default
label falls through to the assembly's own ordinal identifier
(`hg002_chr8_maternal_195` for ENPP7P1). Point the name label at `gene_name`,
and load the file once per haplotype (`MAT` here, `PAT` in both places for the
other panel):

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg002_genes_mat",
  "name": "Genes (JHU Liftoff v0.6, HG002 v1.1 MAT)",
  "assemblyNames": ["hg002v1.2"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1.MAT.loff.v0.6.gff.gz"
  },
  "displayDefaults": {
    "labels": { "name": "jexl:feature.gene_name || feature.name || feature.id" }
  }
}
```

**Color by... → Strand** on each gene lane paints forward red and reverse blue,
which is the scheme the ribbons already use, so one vocabulary covers the frame.

At 9 Mb no gene in that lane can carry a label. A second track over the same
GFF, cut to a few genes with **Filter by...** in its track menu, can: a view
holds a track once, so the labeled lane is a second `trackId` rather than a
second display of the first.

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) across 9 Mb of 8p23.1, colored by strand throughout: forward red, reverse blue. The inverted block is the long blue bar in both panels and the sweep crossing between them. The labeled lane beside the ribbons carries the same genes in opposite orders, so each one is the other panel's color." src="/img/hg002_haplotypes_8p23_inversion.png" />

The palette button in the view header sets what the ribbons are colored by.
**View options → Show... → Show curved lines** makes a block landing far from
where it started easier to follow across the gap.

To see where else the two haplotypes disagree, put the same track on both axes
of a [dotplot view](/docs/user_guides/dotplot_view), the way
[oat against itself](/docs/tutorials/homoeolog_synteny) is drawn.

## Framing both panels on the same sequence

Zoomed in, the same number stops being the same sequence: an indel anywhere
upstream offsets one haplotype against the other, and the offset accumulates.

Right-click a chain block in a panel and choose **Move other panel to the
matching region**. It walks that panel's visible window through the alignment's
CIGAR and sends its neighbor there, leaving the panel you are reading alone.
This is the one control that needs the chain track open in the panel.

<Figure caption="Maternal (top) and paternal (bottom) panels on the same coordinates, each carrying the chain blocks and its own haplotype's genes. The paternal window lands past the end of this chain, so nothing in it corresponds; moving it from a maternal chain block brings the matching sequence under it. The search boxes hold the same locus in frame one and different ones in frame two." src="/img/hg002_haplotypes_follow_panel.png" />

Two neighboring controls do something different. **Center on feature**, on a
ribbon's right-click menu, moves both panels to the alignment's midpoint, which
on a chain tens of megabases long is nowhere near what is on screen. **View
options → Link views** replays a pan from one panel onto the other, so it drifts
again at the next indel.

Each panel's vertical guidelines (**Show... → Show guidelines** in its own menu)
are on by default and carry the ruler's ticks down through the ribbon, which is
what places a feature inside a long collinear block.

## Collinear does not mean identical

Structural agreement and sequence identity are separate claims, and the view
above only makes the first one. Turn on the heterozygous-sites track over a
collinear block and the second becomes checkable in the same frame: the ribbon
runs as one band while the sites below it are dense the whole way across.

Two things bound where that works. Across the whole inversion the track is over
its feature-count limit and paints a warning with a **FORCE LOAD** button
instead of data. And a window centered on a breakpoint cannot work at all: the
flanking and inverted sequence land megabases apart on the other haplotype, so
no single paternal window holds both and the ribbons come back empty. Frame one
side or the other.

Pick the block, not just the width. The collinear block immediately beside the
inversion is inside 8p23.1's defensin and FAM90A duplications, whose repertoire
differs between individuals and between haplotypes (Taudien _et al._ 2004). Each
haplotype's array copies are annotated against whichever hg38 paralog they best
match, so the two gene lanes come back with different symbols for the same
sequence. That is a real difference between the haplotypes, and it is not the
one this section is about.

Each site is named for its own coordinate and alleles, so at this density the
labels are the ruler written twice. Turn them off with **Show... → Labels →
None**.

## What this alignment cannot show

The Q100 repository's `assemblies/changes/README.txt` gives the pipeline behind
the chains in that directory: minimap2, split wherever an unaligned segment runs
past 1 kb or a gap past 10 kb, only alignments between homologous chromosomes
kept, overlaps trimmed to one-to-one. Its worked example is the GRCh38 pair
rather than this one, and the haplotype-to-haplotype file matches it on all
three counts. Each is an absence rather than a mark on screen:

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

A fourth limit is the arrangement rather than the file. A self-alignment has no
outgroup, so the two panels say that the haplotypes differ and never which one
moved. Calling an orientation derived takes a third genome, and the same
directory publishes chains from v1.2 to GRCh38 and CHM13v2.0 for that: **View
options → Add assembly row...** stacks the panel to hang one on.

For a comparison that keeps what the trimming drops, align the haplotypes
yourself and load the result as in [](/docs/tutorials/synteny_visualization).

## See also

- [](/docs/tutorials/homoeolog_synteny), the same self-alignment arrangement on
  a polyploid rather than a diploid
- [](/docs/tutorials/methylation), the same individual's haplotypes separated by
  read tag rather than by assembly
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
