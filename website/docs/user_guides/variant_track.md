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

- **Variant display**, the default, covered on this page
- **Multi-sample variant display (regular)** draws one row per sample at each
  variant's genomic position, the only multi-sample display that renders
  structural variants at scale
- **Multi-sample variant display (matrix)** gives every visible variant a full
  column regardless of spacing, so shared haplotypes and runs of homozygosity
  show. Both are in the
  [multi-sample variant guide](/docs/user_guides/multivariant_track)
- **LD heatmap display** computes pairwise r² from phased genotypes live. See
  the [linkage disequilibrium tutorial](/docs/tutorials/ld_human)
- **Paired arc display** joins the two ends of each breakend record with an arc

In a [circular view](/docs/user_guides/circular_view) the same track gives a
chord display, drawing breakends as chords across the ring.

## Variant widget

Clicking a variant opens a widget with a per-sample genotype table.

<Figure caption="Feature details panel for an SNV (C→T), with a per-sample genotype table in the SAMPLES section." src="/img/variant_panel.png" />

The SAMPLES section lists every sample's genotype (GT) and other per-sample
fields, with a plain-text or regex filter box per column. Typing '1' in the
genotype filter keeps only samples carrying the first alternate allele (0|1 or
1|1). The [1000 Genomes SV tutorial](/docs/tutorials/sv_multisamples) filters a
trio's genotypes this way to check whether a call is inherited.

## Coloring variants

**Color by...** in the track menu:

- **Consequence impact** buckets each variant by the severity of its most severe
  predicted consequence, read from SnpEff `ANN` or VEP `CSQ` in the INFO field:
  HIGH red, MODERATE orange, LOW yellow, MODIFIER grey
- **SV type** colors by structural-variant class, with fixed colors per class
  and an ascending rainbow for copy-number alleles (`<CN0>`, `<CN1>`, ...)
- **Attribute...** takes any attribute name and colors by its value, generating
  a `jexl:randomColor(get(feature,'<attr>'))` expression. Distinct values get
  distinct, stable colors, so it works on any categorical INFO field

The presets draw a dismissable color key naming the classes present, and work on
the multi-sample displays too, where
[consequence impact](/docs/user_guides/multivariant_track#coloring-by-consequence-impact-snpeffvep-annotations)
and [SV type](/docs/user_guides/multivariant_track#coloring-by-sv-type) list the
terms in each tier and the color per class.

For anything else, set the display's `color` slot to a
[jexl](/docs/config_guides/jexl) expression. The variants plugin registers
helpers for minor allele frequency, missingness and consequence impact; see
[helper functions for jexl color expressions](/docs/config_guides/variant_track#helper-functions-for-jexl-color-expressions).

## See also

- [](/docs/user_guides/multivariant_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [](/docs/config_guides/customizing_feature_colors)
- [Gallery: variants and populations](/gallery/#variants)
