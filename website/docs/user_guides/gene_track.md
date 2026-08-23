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

Genes with many isoforms can stack into tall, hard-to-read blocks. The **Gene
glyph** option in the track menu controls how a gene's transcripts are drawn:

- Auto (default) - stacks every transcript when you are zoomed in, but collapses
  each gene to a single transcript when you are zoomed out, so dense regions
  stay legible. Zoomed in it also keeps only as many isoforms per gene as the
  track's height has rows for.
- All transcripts - always draws every transcript on its own row.
- Representative transcript - collapses each gene to one isoform.

Which isoform that is comes from the annotation where it says: a transcript
tagged `RefSeq Select` or `MANE Select` (NCBI), or `MANE_Select` /
`Ensembl_canonical` (Ensembl, GENCODE) is the one kept, and it is also the first
one drawn when a gene is stacked. Failing a tag, it is the longest by protein
length — or, for a gene with no coding isoform at all, the one with the widest
genomic span. The attribute read and the tags that count are the
`canonicalTranscriptField` and `canonicalTranscriptTags` config slots.

A gene left short by the track's height says so on its own label: a small **+N
more** beside the gene name, counting the isoforms that gene is missing.
Clicking it opens that one gene, and the badge then reads **show fewer** and
closes it again. The count sits on the gene, since one gene in a window can be
missing twenty isoforms and its neighbour one. The **Gene glyph** submenu grows
a row to re-collapse every gene opened this way. Representative transcript puts
no badge on a gene you have not opened, since that mode is a choice you made and
the chip below already names it. A gene you did open keeps its badge in every
mode, which is the way back to a collapsed one.

While transcripts are being left out, the track's bottom-right corner says so
with a chip naming the rule that did it: `Isoforms trimmed to fit` where the
track's height is the constraint, otherwise the tag that picked most of the
genes on screen — `RefSeq Select`, `MANE Select`, or `Longest isoform` for an
annotation that tags nothing. Its tooltip counts the genes under each rule when
a window holds a mix, which is usual: NCBI tags its protein-coding genes and
leaves most non-coding ones alone. Clicking the chip opens the same three modes,
and its (×) shrinks it to the small icon that stays in that corner.

## Collapsing introns

Genes often span far more intronic than exonic sequence, so the coding parts are
spread thinly across the view.

- **Collapse introns**, from a gene's right-click menu, replaces the view's
  displayed regions with just that gene's exons placed side by side.
- A window-size setting controls how many base pairs of flanking sequence to
  keep around each splice boundary.
- Right-clicking a specific transcript offers that isoform as well as the whole
  gene, whose exons are unioned; the dialog also has a transcript dropdown,
  which is how to reach an isoform that isn't drawn.

This pairs especially well with an [RNA-seq track](/docs/tutorials/rnaseq): the
spliced reads draw **sashimi arcs** connecting splice donors and acceptors, and
with the introns collapsed those arcs span directly between the adjacent exons.

<Figure caption="Collapsing introns on PTEN (hg38). Top: the right-click menu. Bottom: the reshaped view with the exons side by side, where the direct-RNA nanopore track's sashimi arcs now span between adjacent exons." src="/img/gene_track_collapse_introns.png" />

## Display density and labels

Several track-menu toggles tune how gene glyphs are drawn:

- Display mode - _Normal_, _Compact_, or _Super-compact_ progressively shrink
  each feature's height to fit more rows in dense regions.
- Show subfeature labels - draws each transcript's name on its row, not just the
  gene name.
- Show chevrons - directional chevrons along the intron lines indicating the
  strand (on by default).
- Show only genes - hides non-gene features in the track.

## Color by CDS

By default CDS segments use the track's feature color. Turning on **Color CDS by
reading frame** tints each CDS segment by the frame it is read in, so one colour
is one frame across the whole view.

Frame is constant within a CDS segment, so the colour changes at a junction
rather than inside an exon: two consecutive coding exons in the same colour are
in phase, and a change of colour across a junction is a shift. Both need enough
of the gene in frame to see two exons at once, which is a wider window than the
one below.

Enable it from the linear genome view's hamburger menu → **Color CDS by reading
frame**. The setting applies to every gene track in that view and is remembered
across sessions.

<Figure caption="Turning on Color by CDS for BRCA1 (hg19). Top: the hamburger menu with the 'Color CDS by reading frame' toggle. Bottom: the result at base-pair resolution, each codon tinted by its reading frame with its amino acid and protein position drawn over it." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The `color` slot takes a jexl expression evaluated against each drawn part, so a
per-transcript number carried in the GFF3 attribute column can drive the fill.
Two things to know before writing one:

- **Attribute names arrive lowercased**, and their values arrive as strings. An
  attribute written `dIF=0.79` is read under the key `dif`, and comparing it
  numerically needs `parseFloat`.
- **The expression is evaluated against the box being painted** — an exon, CDS,
  or UTR — so a transcript's own attribute is read with `feature.parent.dif`.
  One expression covers the whole glyph: a UTR follows `color` unless `utrColor`
  claims it.
- **Test the significance flag, not the magnitude.** A large effect on a
  transcript the test could not separate is not a result, so the expression
  below branches on a `dtu` attribute the analysis wrote and only then reads the
  size. Thresholding on the number alone colors those too.

A `jexl:` color is a lookup table only its author can read, so declare what it
means in the `legend` slot; the key is drawn over the track and can be
dismissed. Hovering a transcript names the isoform and the exon under the
cursor; clicking one opens that transcript's own attributes in the details
panel.

See the [jexl configuration guide](/docs/config_guides/jexl) for the expression
syntax.

<Figure caption="ATP5F1C in the hosted differential-transcript-usage demo (hg38): ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon that tells the two colored transcripts apart." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

The [differential transcript usage tutorial](/docs/tutorials/dtu) has the track
configuration behind that figure, and the pipeline that writes the attributes
the expression reads.

## Peptide lettering

The translated protein is drawn on coding features by default, independently of
the frame coloring above. As you zoom in, the amino acids are first drawn as an
alternating per-codon shading over the CDS, and once you are zoomed in far
enough (roughly base-pair resolution) the single-letter amino acid code is drawn
over each codon, as in the lower frame of the figure above. The letters line up
with the codons in the reference sequence track, so you can read the genomic
sequence, the codons, and the resulting peptide in register. The translation
uses the standard genetic code (NCBI table 1).

Translating needs the reference sequence. Turn off **Show amino acids when
zoomed in**, in the view menu's **Show...** submenu, to keep the view from
fetching it.

The translation follows the transcript's strand and CDS phase, and codons that
straddle an exon boundary are split across the two exons. When a CDS carries a
`transl_table` attribute in the GFF (the NCBI convention, e.g. `transl_table=2`
for the vertebrate mitochondrial code), that alternative genetic code is used
for the translation, so a mitochondrial gene translates `TGA` as tryptophan
rather than a stop. The first codon of the CDS is shown as `M` when it is a
valid start codon for that table (including alternative initiators such as `GTG`
or `TTG`), and `transl_except` overrides (e.g. selenocysteine `U`) are applied
and highlighted.

<Figure caption="The selenoprotein GPX1 on hg19. Its in-frame UGA codon is recoded to selenocysteine via the GFF transl_except attribute, so codon 49 draws as a highlighted U rather than a stop. The reference sequence track's plain six-frame translation above still shows a stop there." src="/img/gene_track_selenocysteine.png" />

## Mature peptides (polyproteins)

Many viral genomes encode a single large polyprotein that is cleaved into
several mature peptides. When a CDS has `mature_protein_region` (or
`mature_protein_region_of_CDS`) subfeatures, each cleavage product is drawn as
its own stacked row, colored from a distinct palette so adjacent peptides are
easy to tell apart. Each region is individually hoverable and clickable, and its
name comes from the feature's `product` attribute when the track's `labels.name`
is configured to read it, e.g.:

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

To extract the full protein (or CDS, cDNA, or genomic sequence) for a single
transcript, click the feature and use the Sequence section of the feature
details panel. See [](/docs/user_guides/feature_sequence) for the available
options.

## Using gene tracks with the Protein3d plugin

The [Protein3d plugin](/docs/tutorials/genomes_proteins) builds on the same
transcript-to-protein mapping. Right click a gene and launch the protein
structure viewer to open an interactive 3D structure (from AlphaFold DB or
UniProt) linked to the genome view: hovering a position in the genome highlights
the corresponding residue on the structure, and vice versa. Color-by-CDS and the
peptide lettering give you the protein in the linear track; Protein3d shows
where each residue sits in the folded structure.

See the [proteins tutorial](/docs/tutorials/genomes_proteins) for the launch
routes, installation and connected-view examples.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [RNA-seq tutorial](/docs/tutorials/rnaseq)
- [Track configuration](/docs/config_guides/tracks)
- [Gallery: genes and proteins](/gallery/#genes)
