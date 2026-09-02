---
title: Comparing one genome's two haplotypes (T2T-HG002)
sidebar_label: Synteny (haplotypes, T2T-HG002)
description:
  Load T2T-HG002 v1.2 and the Q100 project's own maternal-to-paternal chain,
  plot one haplotype against the other genome-wide, and look at the 8p23.1
  inversion in a linear synteny view
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** T2T-HG002 v1.2 ships both haplotypes as contigs of one FASTA, named
`chr1_MATERNAL` and `chr1_PATERNAL`, so JBrowse loads it as a single assembly
and maternal against paternal is a self-alignment. The Q100 project publishes
the chain between them, so there is nothing to align.

## Prerequisites

- a JBrowse instance to load the config into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop)). Every file here is a URL, so
  Desktop needs nothing hosted. The [JBrowse CLI](/docs/cli) is needed only for
  the CLI tab under each config below

## Where the data comes from

T2T-HG002 v1.2, the [Q100 project](https://github.com/marbl/HG002)'s diploid
assembly and its own maternal-to-paternal chain
([Hansen _et al._ 2026](https://doi.org/10.1016/j.cell.2026.06.016)), plus JHU
Liftoff v0.6 gene models built on v1.1.

- the diploid assembly, both haplotypes in one FASTA (e.g. `chr1_MATERNAL`,
  `chr1_PATERNAL`):
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz
- the Q100 project's maternal-to-paternal chain:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/changes/hg002v1.2_to_other_haplotype.chain.gz
- the JHU Liftoff v0.6 gene models, maternal haplotype (the paternal file sits
  beside it, `PAT` in place of `MAT`):
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1.MAT.loff.v0.6.gff.gz

## Loading the assembly and the alignment

JBrowse reads the assembly and the chain from their published URLs, so there is
nothing to download. The assembly is a name and the FASTA URL; the adapter comes
from the extension and the `.fai` and `.gzi` sit beside it.

```json addassembly
{
  "name": "hg002v1.2",
  "displayName": "T2T-HG002 v1.2 (diploid)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz"
}
```

The alignment is a synteny track over the Q100 chain. Both endpoints are the
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

A dotplot shows whether anything moved between chromosomes. Open **Add → Dotplot
view**. Both axes read `T2T-HG002 v1.2 (diploid)`, and an axis set to it carries
both haplotypes interleaved.

Switch to **Manual** and tick **Plot only certain chromosomes**. Each box takes
a comma-separated list of contig names with `*` as a wildcard, so `*_MATERNAL`
on the X axis and `*_PATERNAL` on the Y axis give one haplotype per axis.

<Figure caption="The dotplot import form in Manual mode. Both axes are the same assembly, and the chromosome boxes cut each one down to a single haplotype. The Q100 chain is already selected as the synteny track." src="/img/hg002_haplotypes_import_form.png" />

Press **Launch**, then click the palette icon in the view's header and pick
**Strand**, which draws the collinear blocks red and the inverted ones blue.

<Video src="/media/synteny/hg002_dotplot_import.mp4" caption="Building the whole-genome dotplot from the import form: switching modes, opening the chromosome boxes, restricting each axis to one haplotype, and coloring the launched plot by strand." />

HG002 is male, so `chrX_MATERNAL` and `chrY_PATERNAL` have nothing on the other
haplotype to chain to, and their column and row stay empty.

<Figure caption="The Q100 maternal-to-paternal chain as a dotplot, maternal contigs on x against paternal on y, colored by strand. Each chromosome pairs with its own counterpart; the empty lane and column are chrX and chrY." src="/img/hg002_haplotypes_wholegenome.png" />

## The 8p23.1 inversion

Every chromosome in the plot is a red diagonal against its own counterpart, and
chromosome 8 is the one to look at closely. HG002 is heterozygous for the 8p23.1
inversion polymorphism (Bosch _et al._ 2009), so the maternal and paternal
copies of that arm run in opposite directions, and the Q100 chain carries it as
its largest inverted block, close to 4 Mb. The plot places it; a linear synteny
view is where the two copies can be read against each other, with each
haplotype's own tracks beside the ribbons.

There are two ways into that view. From the plot, drag a box around the cell
where `chr8_MATERNAL` meets `chr8_PATERNAL` and pick **Zoom in**; near the start
of the short arm the diagonal breaks into a blue block running the other way,
and a box dragged around it, with some red either side, offers **Linear synteny
view** and opens the panels framed on the box. From the **Add** menu, **Linear
synteny view** opens on **Quick start**, which already offers the two rows the
chain implies and the chain between them, so **Launch** is the only click it
needs, and both panels open on the whole assembly. This section takes the second
route, since it gives a window to write down.

Click the follow button in the view's header, the arrows icon, before framing
anything. It makes the top panel the anchor: wherever it goes, the panel below
is placed on the sequence that aligns to it, resolved through the chain. From
here on the top panel is the only one to navigate. Type
`chr8_MATERNAL:5,250,000-14,250,000` into its search box, and the paternal panel
arrives on the matching stretch of `chr8_PATERNAL` on its own. Then:

- pick **Strand** from the palette icon, the coloring the plot used: collinear
  red, inverted blue
- turn the chain track on in each panel's own track selector, where it draws as
  blocks on that panel's own ruler. The inverted block is the long blue bar in
  both

Genes read the inversion a second way. The JHU Liftoff GFFs are published beside
the assembly, one per haplotype, on matching contig names:

- they annotate v1.1, and on chromosome 8 the lanes still land where the v1.2
  ribbons do
- the gene symbol is in `gene_name` with no `Name`, so the label points there
- the paternal panel takes the same config with `PAT` in the name and URL, under
  its own `trackId`

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
  deep
- **Color by... → Strand** paints forward red and reverse blue, matching the
  ribbons
- labels arrive at this zoom on a second track over the same GFF, cut to a few
  genes with **Filter by...**

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) at 8p23.1, colored by strand. The inverted block is the long blue bar in both panels, and the labeled lane beside the ribbons carries the same genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

## Why the panel below follows

At 9 Mb across, the two haplotypes sit some tens of kilobases out of register,
which is a few pixels, so the same window typed into both panels would have
looked lined up. Zoomed in, the offset is the whole screen: the same coordinate
is no longer the same sequence, because every upstream indel shifts one
haplotype against the other. Following is what keeps the panels on the same
sequence. It walks the top panel's window through the chain's CIGAR and sends
the panel below there on every pan, so the ribbons stay near-vertical however
far you go.

The figure below is 70 kb typed into both panels with follow off. The maternal
panel carries a chain block and the paternal panel's lane is empty, because
those coordinates land in the gap past that block's end on the other haplotype.
The follow button fills the lane and closes the ribbon. Turn it off to pan the
paternal panel by hand, and right-click a chain block for **Move other panel to
the matching region**, the same walk done once.

<Figure caption="Before and after the follow button, maternal over paternal with the Q100 chain blocks on each haplotype's own coordinates. The paternal lane is empty on the left because those coordinates land past the end of the block above them." src="/img/hg002_haplotypes_follow_panel.png" />

The clip below opens 2 Mb into the collinear chain past the inversion, both
panels typed to the same coordinates, where the Liftoff lanes name the same
genes about 240 kb out of register.

<Video src="/media/synteny/hg002_follow_panels.mp4" caption="Maternal over paternal at chr8:13-15 Mb with the gene lanes and location markers on. The follow button places the paternal panel from the maternal one through the chain, so the same genes land under each other and the markers stand upright, and the panel below keeps pace as the top one is dragged 2.4 Mb along." />

**Location markers**, in the header's settings menu, draws lines through each
ribbon at regular positions, joining a point on the top row to where it maps on
the bottom.

<Figure caption="The same pair of panels with location markers on, and the settings menu that turned them on still open over it." src="/img/hg002_haplotypes_location_markers.png" />

## See also

- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)

## References

- The Q100 / T2T-HG002 assembly releases, including v1.2 and the chains between
  the haplotypes. https://github.com/marbl/HG002
- Hansen, N. F. _et al._ A complete diploid human genome benchmark for
  personalized genomics. _Cell_ (2026).
  https://doi.org/10.1016/j.cell.2026.06.016
- Bosch, N. _et al._ Nucleotide, cytogenetic and expression impact of the human
  chromosome 8p23.1 inversion polymorphism. _PLOS ONE_ 4, e8269 (2009).
  https://doi.org/10.1371/journal.pone.0008269
