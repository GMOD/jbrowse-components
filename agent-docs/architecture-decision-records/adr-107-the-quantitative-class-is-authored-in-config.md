---
status: Accepted
summary: "The quantitative class of track — a feature file's field plotted on a score axis, coloured by another field — is authored in config: a display type may attach to several track types, every score-axis display takes one `scoreField`, Manhattan colours by a field with a worker-shipped category table, and `LinearMarkDisplay` draws `marks: [{ shape, encoding }]` over any feature adapter through one core RPC that evaluates a declared encoding once in the worker. Reopens ADR-095's authoring rung for this class only; field access stays native, jexl is the per-channel escape, measured"
---

# ADR-107: The quantitative class is authored in config

## Status

Accepted (2026-09-09). Amends
[ADR-095](adr-095-a-shape-composes-a-scale-at-compile-time.md) §"The grammar
position", whose first rung — authoring: refused, "a track is a file format, and
the reader never picks a mark" — is reopened for the quantitative class and
stands for every other. ADR-091's rejection of a spec that composes a display
stack is untouched: nothing here composes a stack for anyone.
[reference/MARK_ENCODING.md](../reference/MARK_ENCODING.md) is the operational
doc for the encoding; the display's config page is generated.

## Context

The refusal's premise was already false at the adapter tier. The three BED
adapters carry a `scoreColumn` slot, so a config author was already picking the
y field; the `displays[]` slot on every track is a union of every registered
display; Manhattan read `score` off any feature adapter; and wiggle fell back to
`featuresToRaw` for an adapter without an array fast path. On 2026-09-09 a
plain `FeatureTrack` over `BedTabixAdapter` with `displays: [{ type:
'LinearManhattanDisplay' }]` or `[{ type: 'LinearWiggleDisplay' }]` loaded and
painted from config in a jbrowse-web test. What was missing was the vocabulary
to say it on purpose: which field, which colour, which mark.

The cost that decides the mechanism is per-feature evaluation.
`plugins/gwas/src/GWASAdapter/scoreTransforms.ts` had measured jexl at ~0.34M
values/s against ~390M native; `packages/core/benches/encodeFeatures.bench.ts`
measured the encoder at 237 ns/feature native, 355 ns with a `jexl:` y (1.50x)
and 405 ns with a `jexl:` colour (1.71x, from 2.35x once the CSS parse was
cached per distinct string) over a million synthetic features. Field names are
therefore the unit, and jexl the escape a channel opts into.

## Decision

Four moves, one class:

- **A display type attaches to several track types.** `DisplayType.trackType`
  is `string | string[]`, with one reader (`PluginManager.addTrackType`), and
  Manhattan registers for `GWASTrack` and `FeatureTrack`. Not gccontent's
  two-registration idiom, which needs two display names.
- **One `scoreField` slot** (`plugins/wiggle/src/shared/scoreFieldConfigSchemaFields.ts`),
  default `score`, on both wiggle displays and Manhattan, read natively in the
  worker and carried in `rpcProps`. The default reads what the adapter served,
  a `scoreColumn` rewrite included; an explicit name reaches the raw column.
- **Manhattan colours by a field.** `colorBy` gains `'field'` beside `'normal'`
  and `'ld'`, with a `colorField` slot; the worker packs the colour per instance
  and ships a `categories` table with the payload, and `categoricalValueColor`
  derives the colour from the value (integers walk the palette from 1, anything
  else hashes) so regions agree without a round trip. Its legend toggle is
  `showLegend` through `LegendMixin` like every other display's.
- **A declared encoding, evaluated once in the worker, and a display that draws
  it.** `MarkEncoding` (`@jbrowse/core/util/markEncoding`) maps a mark's
  channels — `x`, `x2`, `y`, `color`, `glyph` — to a field name or a `jexl:`
  expression, `color` alternatively to a constant or a `{ field, scale }` where
  the scale is `categorical` (palette, optional `domain` order) or
  `linear`/`log` (a ramp, optional `domain`). `CoreEncodeFeatures` takes
  `{ adapterConfig, region, encodings[], filters?, byteLimit? }`, runs
  `encodeFeatures` per encoding and returns one `EncodedChannels` per mark —
  columnar typed arrays, the y extremes, a Flatbush over (bp, y) for hit
  candidates, and the **scale table** the legend reads — with `RegionTooLarge`
  on refusal. `LinearMarkDisplay` (`@jbrowse/plugin-marks`, on `FeatureTrack`)
  takes `marks: [{ shape: 'bar' | 'point' | 'span', encoding }]` as typed
  sub-schemas (never `frozen`, so the manifest and `jbrowse validate` see two
  levels down), composes the same foundation as Manhattan (`MultiRegionDisplayMixin`,
  `TrackHeightMixin`, `WiggleScoreConfigMixin`, `LegendMixin`, `StoredHoverMixin`,
  `ContextMenuMixin`), declares one `defineMark` per entry with the layer as its
  lens, hovers through `hitNearest` over the layer's Flatbush, reads a clicked
  feature back with `CoreGetFeatures`, and exports through `paintMarkBlocks`.
  `bar` is render-core's third shape; it shares `point`'s value scale
  (`valueScale.slang`) and anchors at the baseline.

The ladder is then: **config first** (a `marks` entry over any feature
adapter), **then a shape** (a plugin-local `MarkShape` over one `.slang`, the
example plugin's form), **then a display** (the hand-composed stack, for layout
and per-display meaning). Each rung is a real consumer of the one below.

## Consequences

- The gauge for "plot this column of this BED": zero files. The test config
  is `products/jbrowse-web/src/tests/MarkDisplay.test.tsx`.
- Two worker packers are now spellings of `encodeFeatures` and owed a
  migration: `buildManhattanResult` is `encodeFeatures(features, { y: 'score',
  color, glyph })` plus its LD `r2` sibling array and `indexFound`;
  `buildScoreResult` is `encodeFeatures(features, { y: scoreColumn })` less
  its own `[0, 1]` normalisation, which the display's domain now does.
- `QuantitativeTrack` does not get the mark display: BigWig summary features
  are wiggle's job, and a `bar` over them would draw the bins twice.
- Categorical and ramp tables are per region without a `domain`; a config that
  wants one legend across regions pins the domain. Documented at the slot.
- `applyDisplaySettings` / `setSlot` cannot write an array-of-sub-schema slot,
  so the promotable-pin census records `marks` as unpinned; the point form is
  covered from config.

## Rejected alternatives

- **A generic display instead of the slots on Manhattan and wiggle.** Both
  landed, on purpose: the slots keep two displays users already reach for
  honest about what they plot, and the mark display is where the encoding lives.
- **jexl as the channel evaluator.** Measured above; a native field is 1.5–1.7x
  faster and is what every existing packer already does.
- **`frozen` for `marks`.** Validates nothing and hides the shape from the
  manifest, the JSON schema and the config docs.
- **A `bar` that is the example plugin's shape.** ADR-106: the example shows
  the plugin-local form on purpose.
