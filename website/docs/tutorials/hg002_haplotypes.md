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
diploid assembly lets us lay them against each other. We use T2T-HG002 v1.2, the
Q100 project's telomere-to-telomere assembly of the HG002 reference individual,
and:

- plot the mother's copy of every chromosome against the father's in a dotplot
- find the 8p23.1 inversion (short arm of chromosome 8) HG002 has on one
  haplotype, in a linear synteny view

## Prerequisites

- a JBrowse instance to load the config into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

T2T-HG002 v1.2, the [Q100 project](https://github.com/marbl/HG002)'s diploid
assembly, and the maternal-to-paternal chain the project publishes
([Hansen _et al._ 2026](https://doi.org/10.1016/j.cell.2026.06.016)), plus JHU
Liftoff v0.6 gene models built on v1.1.

Nothing to download: the track configs and the `curl` check below read these
files by URL.

<details>
<summary>The files</summary>

- the diploid assembly, both haplotypes in one FASTA (e.g. `chr1_MATERNAL`,
  `chr1_PATERNAL`):
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz
- the Q100 project's maternal-to-paternal chain:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/changes/hg002v1.2_to_other_haplotype.chain.gz
- the JHU Liftoff v0.6 gene models, maternal haplotype (the paternal file sits
  beside it, `PAT` in place of `MAT`):
  https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1.MAT.loff.v0.6.gff.gz

</details>

## Loading the assembly and the alignment

JBrowse reads the assembly and the chain from their published URLs, picking the
adapter from the extension and finding the `.fai` and `.gzi` beside the FASTA.

```json addassembly
{
  "name": "hg002v1.2",
  "displayName": "T2T-HG002 v1.2 (diploid)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/hg002v1.2.fasta.gz"
}
```

The alignment is a synteny track over the Q100 chain. Its query and target
assemblies are both `hg002v1.2`, since the two haplotypes are contigs of one:

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

We'll set up the dotplot in the import form:

- **Add → Dotplot view** opens it with both axes reading
  `T2T-HG002 v1.2 (diploid)`, which has both haplotypes interleaved.
- Switch to **Manual** and tick **Plot only certain chromosomes**.
- Enter `*_MATERNAL` on the X axis and `*_PATERNAL` on the Y axis. Each box
  takes a comma-separated list of contig names with `*` as a wildcard, so each
  axis gets one haplotype.

<Figure caption="The dotplot import form in Manual mode. Both axes are the same assembly, and the chromosome boxes cut each one down to a single haplotype. The Q100 chain is already selected as the synteny track." src="/img/hg002_haplotypes_import_form.png" />

Press **Launch**, then click the palette icon in the view's header and pick
**Strand**, which draws the collinear blocks red and the inverted ones blue.

<Video src="/media/synteny/hg002_dotplot_import.mp4" caption="Building the whole-genome dotplot from the import form: switching modes, opening the chromosome boxes, restricting each axis to one haplotype, and coloring the launched plot by strand." />

HG002 is male, so `chrX_MATERNAL` and `chrY_PATERNAL` have nothing to chain to
on the other haplotype, and their column and row stay empty.

Genome-wide, an inversion of a few megabases is a pixel or two of the line, so
open a second dotplot the same way with `chr8_MATERNAL` and `chr8_PATERNAL` in
the boxes, colored by strand.

<Figure caption="The Q100 maternal-to-paternal chain as dotplots colored by strand, maternal on x against paternal on y: the whole genome above, chr8 alone below. Genome-wide each chromosome pairs with its homolog along one red diagonal, the empty row and column being chrX and chrY; on chr8 the 8p23.1 inversion is the blue stretch running against the diagonal near the start." src="/img/hg002_haplotypes_wholegenome.png" />

## Opening the 8p23.1 inversion in a linear synteny view

HG002 is heterozygous for the 8p23.1 inversion polymorphism (Bosch _et al._
2009), so the maternal and paternal copies of that arm run in opposite
directions, and the Q100 chain records it as its largest inverted block. A
linear synteny view lays the two copies against each other, with each
haplotype's tracks beside the ribbons.

Open **Add → Linear synteny view**. Its **Quick start** offers the two rows the
chain implies and the chain between them, so press **Launch**; both panels open
on the whole assembly.[^from-dotplot]

Click the follow button, the arrows icon in the header. With follow on, the view
places the panel below on the sequence that aligns to the top panel through the
chain, so navigate the top panel only. Type `chr8_MATERNAL:5,250,000-14,250,000`
into its search box, and the view moves the paternal panel to the matching
stretch of `chr8_PATERNAL`. Then:

- pick **Strand** from the palette icon, matching the plot's coloring: collinear
  red, inverted blue
- turn the chain track on in each panel's track selector, where it draws as
  blocks on that panel's ruler. The inverted block is the long blue bar in both

The gene annotation shows the inversion too. The JHU Liftoff GFFs are published
beside the assembly, one per haplotype, on matching contig names:

- the files annotate v1.1, and on chromosome 8 the gene tracks still land where
  the v1.2 ribbons do
- the gene symbol is in `gene_name`, so the label points there
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

Set these on each gene track:

- `geneGlyphMode` draws one representative transcript per gene, the RefSeq or
  MANE Select one where the file tags it and the longest coding one otherwise,
  so the track is one row deep
- **Color by... → Strand** paints forward red and reverse blue, matching the
  ribbons
- at this zoom the labels come from a second track over the same GFF under its
  own `trackId`, with **Filter by...** set to
  `jexl:feature.gene_name == 'MFHAS1' || feature.gene_name == 'ERI1' || feature.gene_name == 'TNKS' || feature.gene_name == 'MSRA' || feature.gene_name == 'PINX1' || feature.gene_name == 'XKR6' || feature.gene_name == 'BLK' || feature.gene_name == 'GATA4'`,
  the longest protein-coding genes in the inverted block

**Advanced → Edit plot...** in a gene track's menu shows its `color` (a color
scale) and `filter` (drops records) as text and applies edits live.

<Figure caption="HG002 v1.2 maternal (top) against paternal (bottom) at 8p23.1, colored by strand. The inverted block is the long blue bar in both panels, and the labeled gene track beside the ribbons shows the same genes in opposite orders." src="/img/hg002_haplotypes_8p23_inversion.png" />

## Keeping the two haplotypes in register with the follow button

At 9 Mb across, a few pixels of offset between the haplotypes are invisible, so
one window typed into both panels looks lined up. Zoomed in, every upstream
indel shifts one haplotype against the other and the offset fills the screen.

The figure below types the same 70 kb into both panels with follow off, and the
follow button fills the paternal panel and closes the ribbon. Turn follow off to
pan the paternal panel by hand, or right-click a chain block for **Move other
panel to the matching region**, which does the follow move once.

<Figure caption="Before and after the follow button, maternal over paternal with the Q100 chain blocks in each haplotype's coordinates. The paternal panel is empty on the left because those coordinates land past the end of the block above them." src="/img/hg002_haplotypes_follow_panel.png" />

**Location markers**, in the header's settings menu, draw a line through each
ribbon from a point on the top row to where it maps on the bottom. The clip
types the same coordinates into both panels, 2 Mb into the collinear chain past
the inversion.

<Video src="/media/synteny/hg002_follow_panels.mp4" caption="Maternal over paternal at chr8:13-15 Mb with gene tracks and location markers on. The follow button places the paternal panel from the maternal one through the chain, so the same genes line up and the markers stay vertical as the top panel is dragged." />

## Checking the 8p23.1 inversion against the chain

The chain file lists each inverted block as a chain on the `-` strand, and the
longest on maternal chr8 is the 8p23.1 inversion, the stretch the blue bar spans
in both panels:

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
