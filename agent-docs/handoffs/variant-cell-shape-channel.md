---
name: variant-cell-shape-channel
description: "Whether the multi-sample variant display's inversion glyph (a full-width left-pointing triangle, hard-coded off the record's type) becomes an `encoding.shape` channel like LinearMarkDisplay's. Open: whether one non-trivial shape earns a channel, the shape name, and the legend entry. The glyph itself is settled: Colin keeps the full-width triangle; the capped point was tried twice and reverted, and plain cells were shown and declined."
---

# Variant cell shape as an encoding channel

The multi-sample variant display picks a cell's glyph with one hard-coded rule:
`shapeTypeOf` (`plugins/variants/src/LinearMultiSampleVariantDisplay/components/variantShape.ts`)
draws an `inversion` record as `SHAPE_TRI_LEFT` and everything else as
`SHAPE_RECT`. The question is whether that rule becomes the default of a real
channel, so the shape is set in the grammar rather than in code.

## Settled

- **The glyph is the full-width triangle.** Colin compared the capped point,
  plain cells and the full-width triangle on chr19's 1.1 Mb inversion
  (HGSV_73318, 12 carriers and 12 non-carriers at 12 px rows, and the `multisv`
  figure) and kept the triangle. The cap's history is at `inversionCoverage` in
  `shaders/variant.slang`.
- **Plain cells were the alternative.** With them a 1.1 Mb het inversion looks
  like a deletion or duplication of the same span under genotype colors; the
  `svType` color preset is the only other place type shows.

## The shape the channel would take

- **Precedent:** `LinearMarkDisplay`'s `encoding.shape`
  (`plugins/marks/src/LinearMarkDisplay/configSchema.ts`, `markShapeSchema`): a
  `value`, or a `field` drawn through an `ordinal` scale.
- **Where it lands:** `cellEncodingConfigSchema.ts` holds only `color` today.
  The glyph is chosen on the main thread (`cellGlyphs`, called from `model.ts`
  over the payload's `featureInfo[].type`), so a config-driven shape needs no
  worker or RPC change.
- **The default** would be `{ field: 'svType', scale: { domain: ['inversion'], range: ['triangle-left'] } }`,
  with every unmapped value a plain cell, and `{ value: 'square' }` turning the
  glyph off.

## Open

- **Does one shape earn a channel?** The shader draws two shapes (`SHAPE_RECT`,
  `SHAPE_TRI_LEFT`), so the channel would carry one non-trivial value. The
  recommendation put to Colin: wait until a second cell shape is wanted, a
  duplication glyph say, then promote. He asked for this handoff instead of a
  verdict.
- **The name.** `SHAPE_NAMES` (`packages/core/src/util/shapeNameList.ts`) has
  `circle`, `triangle-down`, `diamond` and `square`, all point glyphs.
  Vega-Lite spells this one `triangle-left`, and a cell's `square` is a
  stretched rect, so the cell vocabulary may want its own list rather than the
  point one.
- **The legend.** A shape channel needs a key entry the display's legend does
  not draw today.
