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
  each gene to its single longest coding transcript when you are zoomed out, so
  dense regions stay legible.
- All transcripts - always draws every transcript on its own row.
- Longest coding transcript - collapses each gene to one isoform: the longest by
  protein length, or, for a gene with no coding isoform at all, the one with the
  widest genomic span.

## Collapsing introns

Genes often span far more intronic than exonic sequence, so the coding parts are
spread thinly across the view. Right-click a gene and choose **Collapse
introns** to replace the view's displayed regions with just the gene's exons
placed side by side. A window-size setting controls how many base pairs of
flanking sequence to keep around each splice boundary. Right-clicking a specific
transcript offers that isoform as well as the whole gene, whose exons are
unioned; the dialog also has a transcript dropdown, which is how to reach an
isoform that isn't drawn. This makes it easy to read a gene's coding sequence
(or inspect reads spanning it) without scrolling past large introns.

This pairs especially well with an [RNA-seq track](/docs/tutorials/rnaseq): the
spliced reads draw **sashimi arcs** connecting splice donors and acceptors, and
with the introns collapsed those arcs span directly between the adjacent exons.

<Figure caption="Collapsing introns on PTEN (hg38). Top: right-click the gene and choose Collapse introns. Bottom: the reshaped view with the exons side by side, where the NA12878 direct-RNA nanopore track's sashimi arcs (auto-placed above and below to minimize crossings) now span directly between adjacent exons." src="/img/gene_track_collapse_introns.png" />

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

By default CDS segments use the track's feature color. Turning on **Show CDS
colored by reading frame** instead tints each CDS segment by its frame, so
frameshifts and the phase relationship between exons are visible at a glance.

Enable it from the linear genome view's hamburger menu → **Show...** → **Show
CDS colored by reading frame**. The setting applies to every gene track in that
view and is remembered across sessions.

<Figure caption="Turning on Color by CDS for the human BRCA1 gene (hg19, NCBI RefSeq). Top: the view's Show... submenu with the 'Show CDS colored by reading frame' toggle. Bottom: the result at base-pair resolution, each CDS codon tinted by its reading frame with its amino acid drawn over it, lined up to the codons in the reference sequence track above." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The `color` slot takes a jexl expression evaluated against each drawn part, so a
per-transcript number carried in the GFF3 attribute column can drive the fill.
Two things to know before writing one:

- **Attribute names arrive lowercased**, and their values arrive as strings. An
  attribute written `dIF=0.79` is read as `feature.dif`, and comparing it
  numerically needs `parseFloat`.
- **The expression is evaluated against the box being painted** — an exon, CDS,
  or UTR — not against the transcript above it. Repeat the attribute onto those
  children when you write the file. Set `utrColor` to the same expression too,
  or UTRs keep the default contrasting fill and only part of each glyph carries
  the encoding.
- **Test the significance flag, not the magnitude.** A large effect on a
  transcript the test could not separate is not a result, so the expression
  below branches on a `dtu` attribute the analysis wrote and only then reads the
  size. Thresholding on the number alone colors those too.

A `jexl:` color is a lookup table only its author can read, so declare what it
means in the `legend` slot; the key is drawn over the track and can be
dismissed.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dtu_muscle_vs_liver",
  "name": "Transcript usage: skeletal muscle vs liver (satuRn)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/dtu/dtu_muscle_vs_liver.gff3.gz"
  },
  "displayDefaults": {
    "subfeatureLabels": "below",
    "color": "jexl:feature.dtu=='muscle'?(parseFloat(feature.dif)>0.6?'#901e21':parseFloat(feature.dif)>0.3?'#c63335':'#d5716a'):feature.dtu=='liver'?(parseFloat(feature.dif)<-0.6?'#124f95':parseFloat(feature.dif)<-0.3?'#2370cc':'#6394d5'):'#b2b1ac'",
    "utrColor": "jexl:feature.dtu=='muscle'?(parseFloat(feature.dif)>0.6?'#901e21':parseFloat(feature.dif)>0.3?'#c63335':'#d5716a'):feature.dtu=='liver'?(parseFloat(feature.dif)<-0.6?'#124f95':parseFloat(feature.dif)<-0.3?'#2370cc':'#6394d5'):'#b2b1ac'",
    "mouseover": "jexl:feature.transcript_name+(feature.dif?' — ΔIF '+feature.dif+' (usage '+feature.if_muscle+' muscle vs '+feature.if_liver+' liver, FDR '+feature.fdr+')':' — not tested')",
    "legend": [
      { "label": "muscle-preferred, ΔIF > 0.6", "color": "#901e21" },
      { "label": "muscle-preferred, ΔIF 0.3–0.6", "color": "#c63335" },
      { "label": "muscle-preferred, ΔIF 0.1–0.3", "color": "#d5716a" },
      { "label": "no usage shift (FDR ≥ 0.05)", "color": "#b2b1ac" },
      { "label": "liver-preferred, ΔIF 0.1–0.3", "color": "#6394d5" },
      { "label": "liver-preferred, ΔIF 0.3–0.6", "color": "#2370cc" },
      { "label": "liver-preferred, ΔIF > 0.6", "color": "#124f95" }
    ]
  }
}
```

`mouseover` is the other half of the encoding: the ramp gives a reader the
direction and roughly the size at a glance, and hovering a transcript reads back
the numbers behind its color.

See the [jexl configuration guide](/docs/config_guides/jexl) for the expression
syntax.

At the whole gene the encoding earns its keep: ten annotated isoforms, the two
the test separated colored, and the eight it could not staying neutral rather
than competing for attention. Zoomed to one cassette exon, the same color says
which isoform the reads under it belong to.

<Figure caption="ATP5F1C in the hosted differential-transcript-usage demo (hg38). ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the change in isoform fraction that satuRn measured between the two tissues. ATP5F1C-201 (muscle-preferred) and ATP5F1C-202 (liver-preferred) carry the color and the other eight are gray. The marked column is the 37 bp cassette exon that separates them: no muscle reads, a clear liver peak, and an exon drawn on the liver-preferred transcript alone." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

## Peptide lettering

The translated protein is drawn on coding features by default, independently of
the frame coloring above. As you zoom in, the amino acids are first drawn as an
alternating per-codon shading over the CDS, and once you are zoomed in far
enough (roughly base-pair resolution) the single-letter amino acid code is drawn
over each codon, as in the lower frame of the figure above. The letters line up
with the codons in the reference sequence track, so you can read the genomic
sequence, the codons, and the resulting peptide in register. The translation
uses the standard genetic code (NCBI table 1).

Translating needs the reference sequence, so if you would rather the view not
fetch it, turn off **Show amino acids when zoomed in** in the same menu.

The translation follows the transcript's strand and CDS phase, and codons that
straddle an exon boundary are split across the two exons. When a CDS carries a
`transl_table` attribute in the GFF (the NCBI convention, e.g. `transl_table=2`
for the vertebrate mitochondrial code), that alternative genetic code is used
for the translation, so a mitochondrial gene translates `TGA` as tryptophan
rather than a stop. The first codon of the CDS is shown as `M` when it is a
valid start codon for that table (including alternative initiators such as `GTG`
or `TTG`), and `transl_except` overrides (e.g. selenocysteine `U`) are applied
and highlighted.

<Figure caption="The selenoprotein GPX1 (glutathione peroxidase 1) on hg19. Its in-frame UGA codon is recoded to selenocysteine via the GFF transl_except attribute, so codon 49 is drawn as a highlighted U on the CDS instead of a stop. The reference sequence track's plain six-frame translation above, which has no CDS context, still shows that codon as a stop (*)." src="/img/gene_track_selenocysteine.png" />

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

The [Protein3d plugin](/docs/tutorials/protein_structure) builds on the same
transcript-to-protein mapping. Right click a gene and launch the protein
structure viewer to open an interactive 3D structure (from AlphaFold DB or
UniProt) linked to the genome view: hovering a position in the genome highlights
the corresponding residue on the structure, and vice versa. Color-by-CDS and the
peptide lettering give you the protein in the linear track, while Protein3d
shows where each residue sits in the folded structure, useful for seeing whether
a coding variant lands in a functional domain.

See the
[Protein structures and multiple sequence alignments tutorial](/docs/tutorials/protein_structure)
for installation and connected-view examples.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [RNA-seq tutorial](/docs/tutorials/rnaseq)
- [Track configuration](/docs/config_guides/tracks)
- [Gallery: genes and proteins](/gallery/#genes)
