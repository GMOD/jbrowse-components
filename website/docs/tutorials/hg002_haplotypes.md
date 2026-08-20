---
title: Comparing one genome's two haplotypes (T2T-HG002)
sidebar_label: Synteny (haplotypes, T2T-HG002)
description:
  Load T2T-HG002 v1.2 and the Q100 project's own maternal-to-paternal chain,
  plot one haplotype against the other genome-wide, and look at the 8p23.1
  inversion in a linear synteny view
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** T2T-HG002 v1.2 ships both haplotypes as contigs of one FASTA, named
`chr1_MATERNAL` and `chr1_PATERNAL`, so JBrowse loads it as a single assembly
and maternal against paternal is a self-alignment. The Q100 project publishes
the chain between them, so there is nothing to align.

## Prerequisites

- nothing to read the figures, which load hosted data
- to build the config yourself: a JBrowse instance to load it into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop)), plus the
  [JBrowse CLI](/docs/cli) if you take the CLI tab under each config below
  rather than editing `config.json` by hand

## The config

The Q100 project serves both the assembly and the alignment between the
haplotypes, so nothing here has to be downloaded, converted or indexed.

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
whether anything moved between chromosomes at all. A dotplot answers that in one
frame.

Open **Add → Dotplot view**. Both axis dropdowns already read
`T2T-HG002 v1.2 (diploid)`, since it is the only assembly here, and an axis set
to it carries both haplotypes: left alone, the plot puts every maternal and
paternal contig on both axes, interleaved.

Switch to **Manual** and tick **Plot only certain chromosomes**, which puts a
box beside each assembly. Each takes a comma-separated list of contig names,
where `*` matches any characters, so `*_MATERNAL` on the X axis and `*_PATERNAL`
on the Y axis give one haplotype per axis. Leave a box empty and you get the
whole assembly.

<Figure caption="The dotplot import form in Manual mode. Both axes are the same assembly, and the chromosome boxes cut each one down to a single haplotype. The Q100 chain is already selected as the synteny track." src="/img/hg002_haplotypes_import_form.png" />

Press **Launch**, then click the palette icon in the view's header and pick
**Strand**. Without it the plot is one black diagonal; with it the collinear
blocks are red and the inverted ones blue.

HG002 is male, so `chrX_MATERNAL` and `chrY_PATERNAL` have nothing on the other
haplotype to chain to, and their column and row stay empty.

<Figure caption="The Q100 maternal-to-paternal chain as a dotplot, maternal contigs on x against paternal on y, colored by strand. Each chromosome pairs with its own counterpart; the empty lane and column are chrX and chrY." src="/img/hg002_haplotypes_wholegenome.png" />

## The 8p23.1 inversion

Chromosome 8 carries an inversion polymorphism at 8p23.1 that HG002 is
heterozygous for (Bosch _et al._ 2009), so the two haplotypes of one person
differ there at a scale a whole-chromosome view can show. Open **Add → Linear
synteny view**, then:

- pick `T2T-HG002 v1.2 (diploid)` in both rows
- go to `chr8_MATERNAL:5,250,000-14,250,000` in the top panel's search box, and
  the same range on `chr8_PATERNAL` below
- pick **Strand** from the palette icon
- turn the chain track on in each panel's own track selector, where it draws as
  blocks on that panel's ruler rather than as ribbons between the panels

Genes read the inversion a second way. The assembly has no annotation of its
own, but the JHU Liftoff GFFs are published beside it, one per haplotype, on
contig names that already match:

- they annotate v1.1, the newest gene set the project publishes, and on
  chromosome 8 the lanes still land where the v1.2 ribbons do
- the gene symbol is in `gene_name` and there is no `Name`, so the label points
  there
- load one file per haplotype; the other panel takes the same config with `PAT`
  in the name and the URL, under its own `trackId`

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
    "geneGlyphMode": "longestCoding",
    "labels": { "name": "jexl:feature.gene_name || feature.name || feature.id" }
  }
}
```

Then, on each gene lane:

- `geneGlyphMode` keeps the longest coding transcript, so the lane is one row
  deep rather than a stack of every RefSeq isoform
- **Color by... → Strand** paints forward red and reverse blue, matching the
  ribbons
- no gene can carry a label at this zoom; a second track over the same GFF, cut
  to a few genes with **Filter by...**, can

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) at 8p23.1, colored by strand. The inverted block is the long blue bar in both panels, and the labeled lane beside the ribbons carries the same genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

## Framing both panels on the same sequence

Zoomed in, the same coordinate stops being the same sequence: an indel anywhere
upstream offsets one haplotype against the other, and the offset accumulates.
The follow button in the view's header walks the top panel's visible window
through the alignment's CIGAR and sends the panel below it there, again every
time you pan. Right-click on a chain block offers **Move other panel to the
matching region**, which does the same walk once.

<Figure caption="Before and after the follow button, maternal over paternal with the Q100 chain blocks on each haplotype's own coordinates. The paternal lane is empty on the left because those coordinates land past the end of the block above them." src="/img/hg002_haplotypes_follow_panel.png" />

To check the alignment inside a ribbon rather than at its edges, turn on
**Location markers** in the header's settings panel. It draws lines through the
ribbon at regularly spaced positions, each joining a point on the top row to the
point it maps to on the bottom.

<Figure caption="The same pair of panels with location markers on, and the settings panel that turned them on still open over it." src="/img/hg002_haplotypes_location_markers.png" />

## See also

- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)

## References

- The Q100 / T2T-HG002 assembly releases, including v1.2 and the chains between
  the haplotypes. https://github.com/marbl/HG002
- Bosch, N. _et al._ Nucleotide, cytogenetic and expression impact of the human
  chromosome 8p23.1 inversion polymorphism. _PLOS ONE_ 4, e8269 (2009).
  https://doi.org/10.1371/journal.pone.0008269
