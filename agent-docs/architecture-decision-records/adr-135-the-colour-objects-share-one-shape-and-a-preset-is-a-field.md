---
status: Accepted
summary: "Every colour object is `{ value, field, scale, domain, palette, ramp }` built from one display-kit factory, `scale` drawn from `none | categorical | linear | log` with each display declaring the members it paints. A preset with a ramp or vocabulary of its own is a `field` — Manhattan's `ld`, the ribbon's `strand`, `identity`, `mappingQual` and `dnds` — not a scale. FeatureColor gains `scale`, so Solid color and Default keep the field under `none` for the way back. MarkColor, MarkGlyph and MarkValue are `closed`. Supersedes ADR-133's \"FeatureColor has no scale\" and ADR-134's rejection of one colour vocabulary"
---

# ADR-135: The colour objects share one shape, and a preset is a field

## Status

Accepted (2026-09-18). Supersedes one consequence of
[ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md)
("FeatureColor has no `scale`") and one rejected row of
[ADR-134](adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)
("one colour vocabulary across the four colour objects"). Everything else in
ADR-131, ADR-133 and ADR-134 stands.

## Context

A grammar-of-graphics review read the four colour objects
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) landed
against ggplot2 4.0.3, function by function, and found the word `scale`
naming four things. On MarkColor it was a scale type. Everywhere it held
`none`, the switch between setting a constant and mapping a field — in ggplot2
the difference between `colour = "red"` beside `aes()` and `aes(colour = x)`,
which `Layer$compute_aesthetics` keeps apart and for which no scale is ever
created. On RibbonColor, `strand`, `identity`, `mappingQuality` and `dnds`
each named a variable with a preset ramp or vocabulary: `aes(colour =
identity)` under a gradient, and synteny-core already modelled the three
ramps as columns (`continuousRampConfig` keys each preset on an `attribute`).
On ManhattanColor, `ld` named a variable computed by joining a second adapter
(`makeLdEvaluator.ts`): data preparation before the plot, feeding colour,
glyph and the tooltip alike.

The user met the asymmetry on a FeatureTrack. Color by → Attribute → Solid
color → Attribute on the feature display lost the attribute, because
FeatureColor had no `scale` and Solid color had to drop the field for the
object to say "constant", while the same round trip on the Manhattan display
kept it. Three of the mark display's channel objects declared a `shorthand`
but not `closed`, so `encoding: { color: { colour: 'strand' } }` loaded with no
error and the key vanished, against ADR-133's rule that all seven refuse an
undeclared key.

ggplot2 also settled what an unset scale means: `find_scale`/`scale_type`
pick discrete or continuous from the data. The ribbon's explicit `categorical`
did that inference per fetch (`AttributeRange` is a span or a label list), so
its name said the opposite of its behaviour and its behaviour was what an
unset scale means under ADR-133.

## Decision

**One shape.** Every colour object is `{ value, field, scale, domain,
palette, ramp }`, and `scale` is drawn from `none | categorical | linear |
log` (`COLOR_SCALES`). A display declares the members it can paint and the
optional slots something reads: FeatureColor and ManhattanColor `none |
categorical` with `palette`; MarkColor all four with `palette` and `ramp`;
RibbonColor `none` alone, and no `palette`, since a label's colour there is
its position in synteny-core's palette and nothing configures it.

**One factory.** `colorChannelSlots({ scales, scaleName, field, scale,
domain })` in `@jbrowse/display-kit/colorConfigSchema` declares the mapping
half — `field`, `scale`, `domain` — beside `colorPaletteSlot`,
`colorRampSlot` and `colorChannelOptions(name)` (`shorthand: 'value'`,
`closed`, `normalizeChannel`). Each object keeps its own `value` slot, whose
type and default are the display's (`maybeColor` on FeatureColor so a BED
`itemRgb` still paints; a colour with a default elsewhere). The factory is a
slot table rather than a schema so the config docs generator, which reads a
`#config` block off the `ConfigurationSchema(...)` call that declares it and
recovers spread-in slots from a single-parameter factory, keeps one page per
object. MarkColor moved to `markColorConfigSchema.ts` for the same reason: a
spread inside a schema declared apart from the display's `#config` block is
invisible to that block, so the mark display's page lost the colour rows until
MarkColor had a `#config` page of its own, which `marks.encoding.color` now
links.

**`none` is the set/map switch on every object, and `paintedScale` is the one
reader**: `none` while no `field` is named, else the written `scale`, or the
display's default beside a field. The hand-kept list of field-reading scales
is gone: every scale but `none` reads a field.

**A preset is a field.** `ribbonColor: { field: 'strand' }` paints the strand
vocabulary; `{ field: 'identity' }`, `{ field: 'mappingQual' }` and
`{ field: 'dnds' }` the preset ramps, named by the attribute each reads; any
other name is a declared column. `ribbonColorBy.ts` maps the field onto the
synteny runtime modes (`strand`, `identity`, `mappingQuality`, `dnds`,
`attribute:<name>`, `default`). `color: { field: 'ld' }` on the Manhattan
display resolves to the worker's `ld` mode through `paintedScale`'s
`fieldScale` argument; `ManhattanColorScale` in `rpcTypes.ts` keeps `ld` as
the worker's mode.

**FeatureColor gains `scale`.** Solid color and Default write `scale: 'none'`
over the current object, so the field, its order and palette survive, and
re-picking Attribute restores them. `colorByMode`, `colorEncoding`, the
worker's `featureColorScale`, `channelSpec` and the Group by dialog's
"was this the grouping's colour" all read through `paintedScale`, so a
dormant field paints nothing and offers no pin row.

**MarkColor, MarkGlyph and MarkValue are `closed`.**

## Consequences

- A scheme switch on the Manhattan and multi-way displays now replaces the
  field: LD to index SNP writes `field: 'ld'` over `field: 'population'`, and
  Strand writes `field: 'strand'` over a column. The field slot is one. What
  ADR-133 kept for the way back under `ld` and the ribbon schemes is kept
  under `none` alone, which is where the menus' Single color and Default
  write. Re-picking a field starts from no order or palette unless it is the
  one already named, as before.
- `displayDefaults: { color: { field: 'ld' } }` on a FeatureTrack routes to
  the feature display as well as the Manhattan display, where ADR-134's
  `{ scale: 'ld' }` reached Manhattan alone. Accepted: `ld` is a field to the
  routing like any other, the feature display paints a field its features
  lack the way it paints any misnamed field, and the GWAS add-track workflow
  already writes the Manhattan display explicitly (`displays: [{ type:
  'LinearManhattanDisplay', color: { field: 'ld' } }]`), as does every doc
  example on a `GWASTrack`, whose only display is the Manhattan one.
  `TrackConfigShorthand.test.ts` pins the routing.
- The refusal messages name the shared order: `FeatureColor takes value,
  field, scale, domain and palette`, `MarkColor takes value, field, scale,
  domain, palette and ramp`. `ChannelObjectSlotWrites.test.ts` already
  walked the mark objects through their shorthand and now walks FeatureColor's
  `scale` too.
- The Edit as JSON dialog's language stays `"css" | { field, domain,
  palette }`: `parseChannelSpec` reads `scale: 'none'` beside a field as the
  constant, and the dialog does not write a dormant field.
- `RibbonColor`'s `categorical` is gone. A `field` with no `scale` paints as
  its values say, which is what it did.

## Rejected alternatives

- **A field-level order declaration shared by facet and colour**, as
  ggplot2's factor levels serve `facet_wrap` and the legend at once. Order
  stays per channel (`facet.domain`, `color.domain`), as in Vega-Lite's
  per-encoding `sort`: the fields come from an adapter, so there is no
  variable to hang the levels on, and a facet and a colour over one field
  agreeing is already the sections' order winning in the key
  (`derivedColorScales`).
- **A facet `drop: false` slot** (`facet_wrap(drop = FALSE)`), so a listed
  value the data lacks takes an empty section. A domain orders and never
  decides which sections exist (ADR-130), and an empty section in a genome
  browser is a blank band with a chip.
- **A schema option declaring which slots each scale reads**, so the editor
  could grey an unread `field` and `jbrowse validate` warn about it. With
  presets as fields there is one unread state, a field under `none`, and it
  is the menus' switch-back memory. ggplot2 raises nothing for a set
  parameter beside a mapping.
- **A schema-producing factory** (`colorChannelSchema('ManhattanColor',
  ...)`). The docs generator throws on a `#config` block whose declaration
  does not call `ConfigurationSchema(`, and finds a schema's slots in its
  source, so each object's page would have gone blank.
- **Keeping `ld` a scale and the ribbon schemes scales**, spelt as they were.
  Each is a variable in the grammar, and the ribbon already has the column
  form for the same ramps.
