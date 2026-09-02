---
title: Gene track
description:
  Transcript display modes, collapsing introns, color by CDS reading frame,
  coloring transcripts from a file attribute, peptide lettering, and mature
  peptides on gene/transcript tracks
guide_category: Track types
---

**TL;DR:** Gene and transcript features (GFF3, GTF, BED12, and similar) render
as glyphs with their exons, UTRs, and CDS segments. Beyond that the track can
translate the CDS in place (reading frame colors, amino-acid lettering, mature
peptides), color each transcript from a value carried in the file, and reshape
the view around a gene by collapsing its introns.

## Choosing which transcripts to show

The **Gene glyph** option in the track menu controls how a gene's transcripts
are drawn:

- Auto (default) - stacks every transcript zoomed in, collapses each gene to one
  transcript zoomed out, and keeps only as many isoforms per gene as the track's
  height has rows for
- All transcripts - every transcript on its own row, whatever the zoom or track
  height. A stack taller than the track scrolls
- Representative transcript - one isoform per gene

The representative isoform is the one the annotation tags: `RefSeq Select` or
`MANE Select` (NCBI), `MANE_Select` or `Ensembl_canonical` (Ensembl, GENCODE).
It is also drawn first when a gene is stacked. Without a tag, it is the longest
by protein length, or by genomic span for a gene with no coding isoform. The
`canonicalTranscriptField` and `canonicalTranscriptTags` config slots name the
attribute and tags.

A gene drawn with fewer transcripts than it has shows **+N more** beside its
name. Clicking it opens that one gene, and the badge then reads **show fewer**.
The **Gene glyph** submenu grows a row to re-collapse every gene opened this
way. The badge appears wherever the gene is wide enough on screen to hold it.

While transcripts are being left out, a chip in the track's bottom-right corner
names the rule: `Isoforms trimmed` where the track's height is the constraint,
otherwise the tag that picked most genes on screen (`RefSeq Select`,
`MANE Select`, or `Longest isoform`). Its tooltip counts the genes under each
rule. Clicking it opens the same three modes.

## Collapsing introns

**Collapse introns**, from a gene's right-click menu, replaces the view's
displayed regions with that gene's exons side by side. A window-size setting
keeps some flanking sequence around each splice boundary. Right-clicking a
transcript offers that isoform as well as the whole gene (exons unioned), and
the dialog's transcript dropdown reaches an isoform that isn't drawn.

With an [RNA-seq track](/docs/tutorials/rnaseq), the spliced reads' **sashimi
arcs** then span directly between adjacent exons.

<Figure caption="Collapsing introns on PTEN (hg38). Top: the right-click menu. Bottom: the reshaped view with the exons side by side, where the direct-RNA nanopore track's sashimi arcs now span between adjacent exons." src="/img/gene_track_collapse_introns.png" />

## Display density and labels

Track-menu toggles:

- Display mode - _Normal_, _Compact_, or _Super-compact_ feature heights
- Show subfeature labels - each transcript's name on its row
- Show chevrons - strand chevrons along the intron lines (on by default)
- Show only genes - hides non-gene features

## Color by CDS

**Color CDS by reading frame**, in the linear genome view's hamburger menu,
tints each CDS segment by the frame it is read in, so one colour is one frame
across the view. Frame is constant within a segment, so a colour change across a
junction is a frame shift. The setting applies to every gene track in the view
and is remembered across sessions.

<Figure caption="Turning on Color by CDS for BRCA1 (hg19). Top: the hamburger menu with the 'Color CDS by reading frame' toggle. Bottom: the result at base-pair resolution, each codon tinted by its reading frame with its amino acid and protein position drawn over it." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The `color` slot takes a jexl expression evaluated against each drawn part, so a
per-transcript number in the GFF3 attribute column can drive the fill:

- **Attribute names arrive lowercased**, values as strings. `dIF=0.79` is read
  under the key `dif`, and comparing it numerically needs `parseFloat`
- **The expression is evaluated against the box being painted** (an exon, CDS,
  or UTR), so a transcript's own attribute is `feature.parent.dif`. A UTR
  follows `color` unless `utrColor` claims it
- **Test the significance flag, not the magnitude.** The expression in the
  tutorial below branches on a `dtu` attribute the analysis wrote and only then
  reads the size

Declare what the colors mean in the `legend` slot; the key is drawn over the
track and can be dismissed. See the
[jexl configuration guide](/docs/config_guides/jexl).

<Figure caption="ATP5F1C in the hosted differential-transcript-usage demo (hg38): ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon that tells the two colored transcripts apart." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

The [differential transcript usage tutorial](/docs/tutorials/dtu) has the track
configuration behind that figure and the pipeline that writes the attributes.

## Peptide lettering

The translated protein is drawn on coding features by default. Zooming in, the
amino acids first appear as alternating per-codon shading, then at roughly
base-pair resolution as single-letter code over each codon, in register with the
reference sequence track. Turn off **Show amino acids when zoomed in**, in the
view menu's **Show...** submenu, to keep the view from fetching the reference.

The translation follows the transcript's strand and CDS phase, splitting codons
that straddle an exon boundary. A CDS with a `transl_table` attribute (NCBI
convention, e.g. `transl_table=2` for vertebrate mitochondria) translates with
that code. The first codon shows as `M` when it is a valid start for that table
(including `GTG` or `TTG`), and `transl_except` overrides (e.g. selenocysteine
`U`) are applied and highlighted.

<Figure caption="The selenoprotein GPX1 on hg19. Its in-frame UGA codon is recoded to selenocysteine via the GFF transl_except attribute, so codon 49 draws as a highlighted U rather than a stop. The reference sequence track's plain six-frame translation above still shows a stop there." src="/img/gene_track_selenocysteine.png" />

## Mature peptides (polyproteins)

Many viral genomes encode one polyprotein cleaved into mature peptides. When a
CDS has `mature_protein_region` (or `mature_protein_region_of_CDS`) subfeatures,
each cleavage product is drawn as its own stacked row in a distinct color,
hoverable and clickable. Its name comes from the `product` attribute when the
track's `labels.name` reads it:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "enterovirus_d_genes",
  "name": "Genes",
  "assemblyNames": ["GCF_000861205.1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://example.com/GCF_000861205.1.gff.gz"
  },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.product || feature.name || feature.id"
    }
  }
}
```

See the [jexl configuration guide](/docs/config_guides/jexl) for the expression
syntax.

<Figure caption="The enterovirus D (GCF_000861205.1) ORF1 polyprotein. The CDS is cleaved into its mature peptides (VP0, VP1–VP4, the 2A–2C and 3A–3D proteins), each drawn on its own row in a distinct color; hovering a region shows its product name." src="/img/gene_track_mature_peptides.png" />

## Reading a feature's protein sequence

Click the feature and use the Sequence section of the details panel for the
protein, CDS, cDNA or genomic sequence. See
[](/docs/user_guides/feature_sequence).

## Using gene tracks with the Protein3d plugin

The [Protein3d plugin](/docs/tutorials/genomes_proteins) uses the same
transcript-to-protein mapping. Right click a gene and launch the protein
structure viewer for an interactive 3D structure (AlphaFold DB or UniProt)
linked to the genome view: hovering a position highlights the residue, and vice
versa. See the [proteins tutorial](/docs/tutorials/genomes_proteins) for launch
routes and installation.

## A whole chromosome of genes

Zoomed out far enough, a gene track stops fetching and shows a "region too
large" message with a **Force load** button. A track can carry a sidecar
instead: a bigWig of feature counts per kilobase, built once from the file,
drawn as a band wherever the features are too many to fetch. The band names its
peak in its corner, and hovering reads the count under the cursor.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with the RefSeq curated genes and three RepeatMasker families, each drawn from its density sidecar. Each band is that track's features per kilobase, scaled to its own peak." />

`jbrowse make-density` writes the sidecar beside the file, and
`jbrowse add-track` attaches one it finds there; `--density` names one
elsewhere. What it writes is the `densityAdapter` slot on the track's adapter:

```bash
jbrowse make-density genes.gff3.gz --chrom-sizes hg38.chrom.sizes
jbrowse add-track genes.gff3.gz --load copy
```

The track menu's **Density band** submenu: **Automatic** swaps where the fetch
would be too large, **Features only** keeps the message, **Density only** always
draws the band. While the band is standing in for a fetch that was too large,
the same submenu carries **Load features anyway**, the banner's force-load. See
the [gene density tutorial](/docs/tutorials/gene_density).

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [RNA-seq tutorial](/docs/tutorials/rnaseq)
- [Track configuration](/docs/config_guides/tracks)
- [Gallery: genes and proteins](/gallery/#genes)
