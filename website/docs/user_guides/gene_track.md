---
title: Gene tracks
description:
  Color by CDS reading frame and peptide lettering on gene/transcript tracks
guide_category: Track types
---

Gene and transcript features (GFF3, GTF, BED12, and similar) render as glyphs
with their exons, UTRs, and CDS segments. Two display options help you read the
coding sequence directly off the track: **color by CDS** and **peptide
lettering**.

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
straddle an exon boundary are split across the two exons. Only the standard
genetic code is used; alternative codon tables are not currently applied here.

### Mature peptides (polyproteins)

Many viral genomes encode a single large polyprotein that is cleaved into
several mature peptides. When a CDS has `mature_protein_region` (or
`mature_protein_region_of_CDS`) subfeatures, each cleavage product is drawn as
its own stacked row, colored from a distinct palette so adjacent peptides are
easy to tell apart. Each region is individually hoverable and clickable, and its
name comes from the feature's `product` attribute when the track's
`labels.name` is configured to read it, e.g.:

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
