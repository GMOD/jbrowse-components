---
title: Comparing one genome's two haplotypes (T2T-HG002)
sidebar_label: Synteny (haplotypes, T2T-HG002)
description:
  Load T2T-HG002 v1.2 and the Q100 project's own maternal-to-paternal chain,
  plot one haplotype against the other genome-wide, and look at the 8p23.1
  inversion in a linear synteny view
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

A person has two copies of each chromosome, one from each parent, and a complete
diploid assembly lets us lay them against each other. We plot the mother's copy
of every chromosome against the father's in T2T-HG002 v1.2, the Q100 project's
telomere-to-telomere assembly of the HG002 reference individual, and find the
8p23.1 inversion (short arm of chromosome 8) HG002 has on one haplotype. The
assembly ships both haplotypes as contigs of one FASTA, named `chr1_MATERNAL`
and `chr1_PATERNAL`, so JBrowse loads it as a single assembly and maternal
against paternal is a self-alignment. The Q100 project publishes the chain
between them, which we load as a synteny track.

## Prerequisites

- a JBrowse instance to load the config into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

T2T-HG002 v1.2, the [Q100 project](https://github.com/marbl/HG002)'s diploid
assembly, and the maternal-to-paternal chain the project publishes
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

JBrowse reads the assembly and the chain from their published URLs. The assembly
is a name and the FASTA URL; JBrowse picks the adapter from the extension and
finds the `.fai` and `.gzi` beside the FASTA.

```json addassembly
{
  "name": "hg002v1.2",
  "displayName": "T2T-HG002 v1.2 (diploid)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz"
}
```

The alignment is a synteny track over the Q100 chain. The chain's query and
target assemblies are both `hg002v1.2`, since the two haplotypes are contigs of
one:

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

For two haplotypes of your own, put both in one FASTA with contig names that
tell them apart (`_MATERNAL` and `_PATERNAL`, as above), and align the file
against itself; `-X` leaves out the self-alignments. Give the track a
`PAFAdapter` with `assemblyNames` naming that one assembly twice:

```bash
minimap2 -cx asm5 --eqx -X hap.fa.gz hap.fa.gz > hap.paf
```

## Plotting maternal against paternal genome-wide

A dotplot shows whether anything moved between chromosomes. Open **Add → Dotplot
view**. Both axes read `T2T-HG002 v1.2 (diploid)`, and an axis set to it has
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

<Figure caption="The Q100 maternal-to-paternal chain as a dotplot, maternal contigs on x against paternal on y, colored by strand. Each chromosome pairs with the same chromosome on the other haplotype; the empty lane and column are chrX and chrY." src="/img/hg002_haplotypes_wholegenome.png" />

## Opening the 8p23.1 inversion in a linear synteny view

In the whole-genome plot, every chromosome is a red diagonal against the same
chromosome on the other haplotype, and a few have small blue marks where a
stretch runs inverted. At genome scale those marks look alike, so the literature
picks which to open: HG002 is heterozygous for the 8p23.1 inversion polymorphism
(Bosch _et al._ 2009), so the maternal and paternal copies of that arm run in
opposite directions, and the Q100 chain records it as its largest inverted
block, close to 4 Mb. A linear synteny view reads the two copies against each
other, with the tracks for each haplotype beside the ribbons.

Open **Add → Linear synteny view**. Its **Quick start** already offers the two
rows the chain implies and the chain between them, so press **Launch**; both
panels open on the whole assembly.[^from-dotplot]

Click the follow button in the view's header, the arrows icon. With follow on,
the view places the panel below on the sequence that aligns to the top panel,
resolved through the chain, so the top panel is the only one to navigate. Type
`chr8_MATERNAL:5,250,000-14,250,000` into its search box, and the view moves the
paternal panel to the matching stretch of `chr8_PATERNAL`. Then:

- pick **Strand** from the palette icon, matching the plot's coloring: collinear
  red, inverted blue
- turn the chain track on in each panel's track selector, where it draws as
  blocks on that panel's ruler. The inverted block is the long blue bar in both

The gene annotation shows the inversion too. The JHU Liftoff GFFs are published
beside the assembly, one per haplotype, on matching contig names:

- the files annotate v1.1, and on chromosome 8 the lanes still land where the
  v1.2 ribbons do
- the gene symbol is in `gene_name` with no `Name`, so the label points there
- the paternal panel takes the same config with `PAT` in the name and URL, under
  a different `trackId`

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

Set these on each gene lane:

- `geneGlyphMode` draws one representative transcript per gene, the RefSeq or
  MANE Select one where the file tags it and the longest coding one otherwise,
  so the lane is one row deep
- **Color by... → Strand** paints forward red and reverse blue, matching the
  ribbons
- at this zoom the labels come from a second track over the same GFF under its
  own `trackId`, with **Filter by...** set to
  `jexl:feature.gene_name == 'MFHAS1' || feature.gene_name == 'ERI1' || feature.gene_name == 'TNKS' || feature.gene_name == 'MSRA' || feature.gene_name == 'PINX1' || feature.gene_name == 'XKR6' || feature.gene_name == 'BLK' || feature.gene_name == 'GATA4'`,
  the longest protein-coding genes in the inverted block

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) at 8p23.1, colored by strand. The inverted block is the long blue bar in both panels, and the labeled lane beside the ribbons shows the same genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

## Keeping the two haplotypes in register with the follow button

At 9 Mb across, the offset between the two haplotypes is a few pixels, so one
window typed into both panels looks lined up. Zoomed in, the offset fills the
screen, because every upstream indel shifts one haplotype against the other.
With follow on, the view maps the top panel's window through the chain's CIGAR
(its alignment string) and moves the panel below to match on every pan, so the
ribbons stay near-vertical.

The figure below types the same 70 kb into both panels with follow off. The
maternal panel shows a chain block and the paternal panel's lane is empty,
because those coordinates land in the gap past the block's end on the other
haplotype. The follow button fills the lane and closes the ribbon. Turn follow
off to pan the paternal panel by hand, or right-click a chain block for **Move
other panel to the matching region**, which does the follow move once.

<Figure caption="Before and after the follow button, maternal over paternal with the Q100 chain blocks in each haplotype's coordinates. The paternal lane is empty on the left because those coordinates land past the end of the block above them." src="/img/hg002_haplotypes_follow_panel.png" />

The clip below starts 2 Mb into the collinear chain past the inversion, with
both panels typed to the same coordinates, so the Liftoff lanes name the same
genes a few hundred kilobases out of register. **Location markers**, in the
header's settings menu, draw a line through each ribbon from a point on the top
row to where it maps on the bottom.

<Video src="/media/synteny/hg002_follow_panels.mp4" caption="Maternal over paternal at chr8:13-15 Mb with gene lanes and location markers on. The follow button places the paternal panel from the maternal one through the chain, so the same genes line up and the markers stay vertical as the top panel is dragged." />

## Checking the 8p23.1 inversion against the chain

The chain file lists each inverted block as a chain on the `-` strand. The
longest on the maternal chr8 is the 8p23.1 inversion, the stretch the blue bar
spans in both panels:

```bash
# the longest inverted chains on maternal chr8: start, end and length
curl -s https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/changes/hg002v1.2_to_other_haplotype.chain.gz \
  | gzip -dc \
  | awk '$1 == "chain" && $3 == "chr8_MATERNAL" && $10 == "-" {print $6, $7, $7 - $6}' \
  | sort -k3,3nr | head -3
```

## See also

- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/syri_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)

## External links

- The Q100 / T2T-HG002 assembly releases, including v1.2 and the chains between
  the haplotypes. https://github.com/marbl/HG002

## Citations

- Hansen, N. F. _et al._ A complete diploid human genome benchmark for
  personalized genomics. _Cell_ (2026).
  https://doi.org/10.1016/j.cell.2026.06.016
- Bosch, N. _et al._ Nucleotide, cytogenetic and expression impact of the human
  chromosome 8p23.1 inversion polymorphism. _PLOS ONE_ 4, e8269 (2009).
  https://doi.org/10.1371/journal.pone.0008269

[^from-dotplot]:
    The dotplot opens the same view framed on a region. Drag a box around the
    cell where `chr8_MATERNAL` meets `chr8_PATERNAL` and pick **Zoom in**; near
    the start of the short arm the diagonal breaks into a blue block running the
    other way. A box dragged around that block offers **Linear synteny view**.
