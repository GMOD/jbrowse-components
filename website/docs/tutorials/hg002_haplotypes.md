---
title: Comparing one genome's two haplotypes (T2T-HG002)
sidebar_label: Haplotype synteny (T2T-HG002)
description:
  Load T2T-HG002 v1.2 and the Q100 project's own maternal-to-paternal chain,
  plot one haplotype against the other genome-wide, and look at the 8p23.1
  inversion in a linear synteny view
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** T2T-HG002 v1.2 ships both haplotypes in one FASTA, as contigs named
`chr1_MATERNAL` and `chr1_PATERNAL`, so JBrowse loads it as a single assembly
and maternal against paternal is a self-alignment. The Q100 project publishes
the chain between the two haplotypes, so there is nothing to align. A dotplot
with one haplotype per axis shows the two are collinear chromosome by
chromosome; 8p23.1 is one of the blocks that is not, and draws as a sweep
between the panels of a linear view.

## Prerequisites

- nothing to read the figures, which load hosted data
- to build the config yourself: a JBrowse instance to load it into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop)), plus the
  [JBrowse CLI](/docs/cli) if you take the CLI tab under each config below
  rather than editing `config.json` by hand

## The config

There is not much to set up here, which is most of the appeal of this dataset.
The Q100 project serves the assembly and the alignment between the haplotypes
itself, so nothing has to be downloaded, converted or indexed, and the whole
tutorial is two URLs and a view.

Start with the assembly, one entry in `assemblies`. It needs a name and the URL
of its sequence and nothing else: the adapter comes from the file extension, and
the `.fai` and `.gzi` sitting beside the FASTA are found the same way.

```json addassembly
{
  "name": "hg002v1.2",
  "displayName": "T2T-HG002 v1.2 (diploid)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz"
}
```

The alignment goes in as a synteny track. It is the Q100 project's own chain,
read as published, and the thing to notice is that both of its endpoints are the
same assembly, since the two haplotypes are contigs of one:

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

## The whole genome first

With those two in place, the first thing to ask a haplotype-resolved assembly is
whether anything moved between chromosomes at all. That is a dotplot's question
rather than a linear view's: twenty-three pairs of ribbons is not a shape anyone
reads, and a dotplot answers it in one frame.

Open **Add → Dotplot view**. Both axis dropdowns already read
`T2T-HG002 v1.2 (diploid)`, because it is the only assembly here, which is
exactly the problem this dataset poses. The two haplotypes are contigs of one
assembly, so an axis set to that assembly carries both of them, and a plot of it
against itself puts every maternal and paternal contig on both axes,
interleaved.

Switch to **Manual** and use the chromosome box beside each assembly. Each takes
a comma-separated list of contig names, where `*` matches any characters, so
`*_MATERNAL` on the X axis and `*_PATERNAL` on the Y axis give one haplotype per
axis. Leave a box empty and you get the whole assembly, which is what every
other dataset wants. These boxes exist for the fragmented ones.

<Figure caption="The dotplot import form in Manual mode. Both axes are the same assembly, and the chromosome boxes cut each one down to a single haplotype. The Q100 chain is already selected as the synteny track." src="/img/hg002_haplotypes_import_form.png" />

Press **Launch**, then turn on **Color by... → Strand** from the palette icon in
the view's header. Without it the plot is one black diagonal; with it the
collinear blocks are red and the inverted ones blue, which is the only other
signal at this scale.

What comes back is a clean per-chromosome diagonal: every maternal chromosome
aligns to its paternal counterpart along its whole length, and nothing crosses
between chromosomes. The blue ticks on it are the inverted blocks, and the
largest of them is the subject of the next section. The `chrX_MATERNAL` column
and the `chrY_PATERNAL` row are empty, which is not a loading failure: a male
sample's sex chromosomes have no counterpart on the other haplotype to chain to.

<Figure caption="The Q100 maternal-to-paternal chain as a dotplot, maternal contigs on x against paternal on y, colored by strand. Each chromosome pairs with its own counterpart on the diagonal; the blue ticks are inverted blocks and the empty lane and column are chrX and chrY." src="/img/hg002_haplotypes_wholegenome.png" />

## The 8p23.1 inversion

The blue blocks are worth taking one at a time, which is a linear synteny view's
job rather than a dotplot's. Open **Add → Linear synteny view** and pick
`T2T-HG002 v1.2 (diploid)` in both rows. That gives two panels of the same
assembly, so put the maternal copy of a chromosome on top and the paternal
below, and type a locus into either panel's search box to move it. The same
chromosome boxes are on this form too, one per row, if you want the whole-genome
comparison as ribbons instead of as a plot.

It is worth turning that same track on from each panel's own track selector as
well. In a plain linear view it draws as blocks on that panel's ruler rather
than as ribbons between the panels, and those blocks are what the right-click
further down acts on.

Chromosome 8 carries an inversion polymorphism at 8p23.1 that HG002 is
heterozygous for (Bosch _et al._ 2009), so it is one of the places where the two
haplotypes of one person differ at a scale a whole-chromosome view can show.
Colored by strand it is the one sweep crossing an otherwise flat frame, and the
collinear flanks either side are what make it read as an inversion.

Genes underneath the ribbons make the sweep easier to read, since they show the
same sequence arriving in the opposite order on the other haplotype. The
assembly has no annotation of its own, but the JHU Liftoff annotation of HG002
v1.1 is published beside it, one bgzipped GFF per haplotype, with contig names
that already match. Its records carry the gene symbol in `gene_name` and no
`Name`, so point the label there, and load the file once per haplotype (`MAT`
here; the other panel takes the same config with `PAT` in the name and the URL,
under its own `trackId`):

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
At this zoom no gene in that lane can carry a label; a second track over the
same GFF, cut to a few genes with **Filter by...** in its track menu, can.

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) at 8p23.1, colored by strand throughout: forward red, reverse blue. The inverted block is the long blue bar in both panels and the sweep crossing between them. The labeled lane beside the ribbons carries the same genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

## Framing both panels on the same sequence

Zoomed in, the same coordinate stops being the same sequence: an indel anywhere
upstream offsets one haplotype against the other, and the offset accumulates.
Right-click a chain block and choose **Move other panel to the matching
region**, which walks that panel's visible window through the alignment's CIGAR
and sends its neighbor there.

To check the alignment inside a ribbon rather than at its edges, turn on **View
options → Show... → Show location markers**. It draws lines through the ribbon
at regularly spaced positions, each joining a point on the top row to the point
it maps to on the bottom.

<Figure caption="Maternal (top) and paternal (bottom) panels, each carrying the chain blocks on its own haplotype's coordinates. The panels have drifted apart, so nothing in the frame lines up; the ring marks the right-clicked block. After the move the paternal panel is elsewhere and both lanes carry the block the ribbon joins. The last two frames turn on location markers, whose lines through the ribbon pair up positions across the two panels." src="/img/hg002_haplotypes_follow_panel.png" />

## See also

- [](/docs/tutorials/homoeolog_synteny), the same self-alignment arrangement on
  a polyploid rather than a diploid
- [](/docs/tutorials/methylation), the same individual's haplotypes separated by
  read tag rather than by assembly
- [](/docs/tutorials/synteny_visualization), for aligning two genomes yourself
  instead of using a published alignment
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view), the whole-chromosome view of the same
  alignment

## References

- The Q100 / T2T-HG002 assembly releases, including v1.2 and the chains between
  the haplotypes. https://github.com/marbl/HG002
- Bosch, N. _et al._ Nucleotide, cytogenetic and expression impact of the human
  chromosome 8p23.1 inversion polymorphism. _PLOS ONE_ 4, e8269 (2009).
  https://doi.org/10.1371/journal.pone.0008269
