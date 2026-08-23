---
title: Variant track
description: VCF variant display
guide_category: Track types
---

**TL;DR:** A variant track displays VCF records, one glyph per call, and a click
opens a per-sample genotype table. The track menu's **Display types** switches
to a multi-sample view (one row per sample), an LD heatmap, or a paired-arc view
for breakends. **Color by...** buckets variants by SnpEff/VEP consequence
severity or SV type with one click, or colors by any INFO field via a jexl
expression (e.g. minor allele frequency).

<Figure caption="Variant track indicating an SNV alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

## Display types

In a linear genome view, the track menu's **Display types** switches between:

- **Variant display**, the default, and what the rest of this page covers.
- **Multi-sample variant display (regular)** draws one row per sample at each
  variant's true genomic position, the only multi-sample display that renders
  structural variants at the right scale.
- **Multi-sample variant display (matrix)** gives every visible variant a full
  column regardless of spacing, so shared haplotypes, runs of homozygosity, and
  population structure become visible. Both are covered in the
  [multi-sample variant guide](/docs/user_guides/multivariant_track).
- **LD heatmap display** computes pairwise r² from the phased genotypes live and
  draws the triangle. See the
  [linkage disequilibrium tutorial](/docs/tutorials/ld_human).
- **Paired arc display** joins the two ends of each breakend record with an arc.

Adding the same track to a [circular view](/docs/user_guides/circular_view)
instead gives a chord display, which draws long-range breakends as chords across
the ring.

## Variant widget

Clicking a variant opens a widget with a per-sample genotype table. Multi-sample
VCFs (like 1000 Genomes) can contain thousands of samples.

<Figure caption="Feature details panel for an SNV (C→T), with a per-sample genotype table in the SAMPLES section." src="/img/variant_panel.png" />

The SAMPLES section lists every sample with its genotype (GT) and other
per-sample fields, and each column has its own filter box accepting plain text
or a regex. For example, typing '1' in the genotype filter keeps only samples
carrying the first alternate allele (0|1 or 1|1), hiding the many
homozygous-reference rows. GT=0 is the REF allele, and any non-zero value is an
ALT allele. Filtering a trio's genotypes this way is how the
[1000 Genomes SV tutorial](/docs/tutorials/sv_multisamples) checks whether a
call is inherited.

## Coloring variants

**Color by...** in the track menu has two one-click presets that read the VCF's
own annotations, plus two escape hatches:

- **Consequence impact** buckets each variant by the severity of its most severe
  predicted consequence, read from SnpEff `ANN` or VEP `CSQ` in the INFO field:
  HIGH red, MODERATE orange, LOW yellow, MODIFIER grey
- **SV type** colors by structural-variant class, with fixed colors per class
  and an ascending rainbow for copy-number alleles (`<CN0>`, `<CN1>`, ...)
- **Attribute...** takes any attribute name and colors by its value, generating
  a `jexl:randomColor(get(feature,'<attr>'))` expression. Distinct values get
  distinct, stable colors, so it works on any categorical INFO field

Both presets draw a floating color key naming only the classes present, which
you can dismiss, and both work on the multi-sample displays, where
[consequence impact](/docs/user_guides/multivariant_track#coloring-by-consequence-impact-snpeffvep-annotations)
and [SV type](/docs/user_guides/multivariant_track#coloring-by-sv-type) are
covered in full, with the terms in each tier and the color per SV class.

For anything else, set the display's `color` slot to a
[jexl](/docs/config_guides/jexl) expression. The variants plugin registers
helper functions for it, so a track can be colored by minor allele frequency,
missingness, or consequence impact without preprocessing the VCF: see
[helper functions for jexl color expressions](/docs/config_guides/variant_track#helper-functions-for-jexl-color-expressions).

## See also

- [](/docs/user_guides/multivariant_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [](/docs/config_guides/customizing_feature_colors)
- [Gallery: variants and populations](/gallery/#variants)
