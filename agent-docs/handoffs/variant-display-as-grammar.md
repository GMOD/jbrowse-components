---
name: variant-display-as-grammar
description: "Aim the one variant display at a clean grammar encoding: records over genotypes as two marks over one tidy VCF table, the way ggplot2 or Vega-Lite would say it, so the display shrinks toward a spec plus the browser-only parts. Colin (2026-10-31): \"i do want to aim at this clean grammar encoding\". Open: whether LinearMarkDisplay's marks can carry the variant display's picture at its speed, and what stays hand-written."
---

# The variant display as a grammar spec

After the merge (handoffs/variant-display-merge.md, ADR-255) the variant display
is about 9,100 lines of source in `plugins/variants/src/LinearVariantDisplay/`,
2,137 of them `model.ts`, plus the worker RPC and shaders. In ggplot2 the same
picture is two layers over one table with a shared x. Much of the code pays for
what a static plot never needs (streaming per region and zoom, worker/main split,
zoom-dependent label and pile rules, hit-testing, three renderers, persisted and
migrated settings, density gates); the records-only vs over-rows modes are not
that kind of cost.

## The encoding

- **Records**: a rect per record, x = span, y from a packing step, color = SV
  class, a text mark for `ID <TYPE> size carrier%`.
- **Genotypes**: a tile per record × sample, x = span, y = sample row,
  color = genotype (dosage as lightness).
- One data source, one `filter`, one shared x, stacked (Vega-Lite `vconcat`);
  the records band's height a scale of its content, the rows the remainder.

## What LinearMarkDisplay already has

`plugins/marks/src/LinearMarkDisplay/`: `pileup` (packing), `flatten` (fans a
VCF `samples` record out, its `key` the sample: markTransformConfigSchema.ts
~245), `encoding.row`, `rows` and `rowColor` (sample rows, display-kit),
`facet`, `aggregate`/`bin`, `mate` + `link` (arcs; todo/variant-display-links-band.md),
legends and scales per ADR-238. reference/MARK_ENCODING.md and
reference/GRAMMAR_OF_GRAPHICS.md describe them.

## First move

Write the RHD 1000 Genomes SV picture (website/scripts/specs/ui.ts `rhdPanel`)
as a `LinearMarkDisplay` spec over the same VCF: a `pileup` rect + text mark for
records over a `flatten`ed tile mark for genotypes. Capture it beside the
variant display, and measure load and pan at 3,202 samples. The gaps it hits
(stacking two marks' y ranges in one display, the carrier-share field, the
anchored haplotype sort, clustering, sample metadata) are this thread's list.

## Constraints

- A declared spec must match the hand-written pipeline's speed before it
  replaces it; measure both on the same data.
- ADR-227 declined porting wiggle onto render-core's marks for color that
  depends on row and value at once; genotype dosage shading is the same shape.
- Two pictures of one data set stay one display with bands, not two displays
  (ADR-255; feature-band-consumers.md).
