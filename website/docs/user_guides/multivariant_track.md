---
id: multivariant_track
title: Multi-sample variant displays
---

import Figure from '../figure'

VCF files frequently contain information on multiple samples. JBrowse 2 added
the ability to show the data from multiple samples using a custom Variant track
"display type"

There are two different display types:

1. "Multi-sample variant display (matrix)"
2. "Multi-sample variant display (normal)"

## Normal mode - optimized for showing all types of variants, including structural variants

In the normal mode, each variant is drawn at it's proper genomic location, and
produces multiple rows for each sample.

Notably, the normal mode is actually capable of showing structural variants, and
if there are overlaps, it will draw each one over the other. There is a slight
transparency, so you can distinguish small overlaps. If there are cases where
there are too many overlaps, you can add filters to try to hide larger variants,
or filter specific variants by name, using jexl via the "Edit filters" track
menu item

## Matrix mode - optimized for showing patterns of diversity, focused on small variants and SNPs

In the matrix mode, each variant in the visible region is drawn into a 'matrix'
where each row is a sample and each column is a variant.

In this case, the variants are not actually rendered at their exact genomic
position, however a black line is drawn to connect the columns of the matrix to
their variant position

The matrix mode is ideal to 'densify' the sparse patterns of variation. For
example, if there was one SNP per 1,000bp on a given genome, and you were zoomed
out to a large genomic region of 100,000bp, then you may only see 100 variants,
and each one would be very thin e.g. 1px in the "Multi-sample variant display
(normal)"

However, with the matrix mode, each variant would occupy e.g.
your_screen_width/100 which for a 2000px wide screen is a nice 20px
