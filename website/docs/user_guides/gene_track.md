---
title: Gene tracks
description:
  Transcript display modes, collapsing introns, color by CDS reading frame,
  peptide lettering, and mature peptides on gene/transcript tracks
guide_category: Track types
---

Gene and transcript features (GFF3, GTF, BED12, and similar) render as glyphs
with their exons, UTRs, and CDS segments. The sections below cover the display
and analysis options available on gene tracks, from reading the coding sequence
directly off the track to reshaping the view around a gene's exons.

### Choosing which transcripts to show

Genes with many isoforms can stack into tall, hard-to-read blocks. The **Gene
glyph** option in the track menu controls how a gene's transcripts are drawn:

- **Auto** (default) — stacks every transcript when you are zoomed in, but
  collapses each gene to its single longest coding transcript when you are
  zoomed out, so dense regions stay legible.
- **All transcripts** — always draws every transcript on its own row.
- **Longest coding transcript** — always draws only the longest coding isoform
  of each gene.

### Collapsing introns

Genes often span far more intronic than exonic sequence, so the coding parts are
spread thinly across the view. Right-click a gene and choose **Collapse
introns** to replace the view's displayed regions with just the gene's exons
placed side by side, dropping the introns. A window-size setting controls how
many base pairs of flanking sequence to keep around each splice boundary. By
default the union of exons across all transcripts is used; you can instead pick
a single transcript from the dialog. This makes it easy to read a gene's coding
sequence — or inspect reads spanning it — without scrolling past large introns.

This pairs especially well with an RNA-seq track: the spliced reads draw
**sashimi arcs** connecting splice donors and acceptors, and with the introns
collapsed those arcs span directly between the adjacent exons.

<Figure caption="BRCA1 (hg38) with its introns collapsed, so the exons sit side by side. The NA12878 direct-RNA nanopore track below shows per-exon coverage and sashimi arcs joining the spliced exon junctions." src="/img/gene_track_collapse_introns.png" />

### Display density and labels

Several track-menu toggles tune how gene glyphs are drawn:

- **Display mode** — _Normal_, _Compact_, or _Super-compact_ progressively
  shrink each feature's height to fit more rows in dense regions.
- **Show subfeature labels** — draws each transcript's name on its row, not just
  the gene name.
- **Show chevrons** — directional chevrons along the intron lines indicating the
  strand (on by default).
- **Show only genes** — hides non-gene features in the track.

### Color by CDS

By default CDS segments use the track's feature color. Turning on **Color by
CDS** instead tints each CDS segment by its reading frame, so frameshifts and
the phase relationship between exons are visible at a glance.

Enable it from the linear genome view's hamburger menu → **Color by CDS and draw
amino acids**. The setting applies to every gene track in that view and is
remembered across sessions.

<Figure caption="The human BRCA1 gene (hg19, NCBI RefSeq) with color-by-CDS turned on. Each CDS exon is tinted by its reading frame, so neighboring coding exons in different frames get different colors; introns are drawn as the connecting line." src="/img/gene_track_color_by_cds.png" />

### Peptide lettering

The same menu option also draws the translated protein. As you zoom in, the
amino acids are first drawn as a colored background band over the CDS, and once
you are zoomed in far enough (roughly base-pair resolution) the single-letter
amino acid code is drawn over each codon. The letters line up with the codons in
the reference sequence track, so you can read the genomic sequence, the codons,
and the resulting peptide in register.

<Figure caption="Zoomed into a CDS exon with the reference sequence track above. Each codon is labeled with its single-letter amino acid, aligned to the bases that encode it. The translation uses the standard genetic code (NCBI table 1)." src="/img/gene_track_peptides.png" />

The translation follows the transcript's strand and CDS phase, and codons that
straddle an exon boundary are split across the two exons. When a CDS carries a
`transl_table` attribute in the GFF (the NCBI convention, e.g. `transl_table=2`
for the vertebrate mitochondrial code), that alternative genetic code is used
for the translation — so a mitochondrial gene translates `TGA` as tryptophan
rather than a stop. The first codon of the CDS is shown as `M` when it is a
valid start codon for that table (including alternative initiators such as `GTG`
or `TTG`), and `transl_except` overrides (e.g. selenocysteine `U`) are applied
and highlighted.

<Figure caption="The selenoprotein GPX1 (glutathione peroxidase 1) on hg19. Its in-frame UGA codon is recoded to selenocysteine via the GFF transl_except attribute, so codon 49 is drawn as a highlighted U on the CDS instead of a stop. The reference sequence track's plain six-frame translation above, which has no CDS context, still shows that codon as a stop (*)." src="/img/gene_track_selenocysteine.png" />

### Mature peptides (polyproteins)

Many viral genomes encode a single large polyprotein that is cleaved into
several mature peptides. When a CDS has `mature_protein_region` (or
`mature_protein_region_of_CDS`) subfeatures, each cleavage product is drawn as
its own stacked row, colored from a distinct palette so adjacent peptides are
easy to tell apart. Each region is individually hoverable and clickable, and its
name comes from the feature's `product` attribute when the track's `labels.name`
is configured to read it, e.g.:

```json
"labels": {
  "name": "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')"
}
```

<Figure caption="The enterovirus D (GCF_000861205.1) ORF1 polyprotein. The CDS is cleaved into its mature peptides (VP0, VP1–VP4, the 2A–2C and 3A–3D proteins), each drawn on its own row in a distinct color; hovering a region shows its product name." src="/img/gene_track_mature_peptides.png" />

### Reading a feature's protein sequence

To extract the full protein (or CDS, cDNA, or genomic sequence) for a single
transcript, click the feature and use the sequence panel in the feature detail
sidebar. See [Feature sequence panel](/docs/user_guides/feature_sequence) for
the available options.

### Using gene tracks with the Protein3d plugin

The [Protein3d plugin](/docs/tutorials/protein_structure) builds on the same
transcript-to-protein mapping. Right click a gene and launch the protein
structure viewer to open an interactive 3D structure (from AlphaFold DB or
UniProt) linked to the genome view: hovering a position in the genome highlights
the corresponding residue on the structure, and vice versa. Color-by-CDS and the
peptide lettering give you the protein in the linear track, while Protein3d
shows where each residue sits in the folded structure — useful for seeing
whether a coding variant lands in a functional domain.

See the
[Protein structures and multiple sequence alignments tutorial](/docs/tutorials/protein_structure)
for installation and connected-view examples.
