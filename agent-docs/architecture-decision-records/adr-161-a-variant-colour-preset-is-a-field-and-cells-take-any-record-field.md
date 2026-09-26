---
status: Accepted
summary: "The multi-sample variant displays' `featureColor` string becomes `color`, a `VariantCellColor` object built like FeatureColor (`none | categorical | threshold`). Consequence impact, SV type and phase set are the fields `impact`, `svType` and `phaseSet`, not jexl strings and marker words; any other field is read off the record through `fieldReader` and painted through `colorFieldOf`, a record with no value keeping the alt hue. `LinearVariantDisplay` writes the same `impact` and `svType` fields on its FeatureColor and resolves them to the jexl colours that compute them in `colorEncoding` and in what `rpcProps` sends. Color by... on the multi-sample displays gains Field..., a dialog over the VCF header's fields with optional cut points. A config naming `featureColor` fails the load naming `color`"
---

# ADR-161: A variant colour preset is a field, and cells take any record field

## Status

Accepted (2026-09-24). Extends
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)'s
"a preset is a field" to the two variant displays, and
[ADR-156](adr-156-the-feature-colour-takes-a-threshold.md)'s threshold to the
genotype cells.

## Context

The variant displays spelt their colour presets as strings. `LinearVariantDisplay`
wrote `jexl:impactColor(feature)` or `jexl:svTypeColor(feature)` into
`color.value` and recognised them by comparing `colorEncoding` against the
string. The multi-sample displays kept a `featureColor` string slot holding
`''`, that impact jexl, the word `svType`, the word `phaseSet`, or any jexl or
CSS colour. One concept, colour by SV class, had two spellings on two
displays, neither of them a field, and the cells could not take a field at
all: colouring by `INFO/CLNSIG` or binning `INFO/AF` needed a hand-written jexl
ternary and no key listed it.

## Decision

**The cells' hue is `color`, a `VariantCellColor` object.** It is FeatureColor's
shape, `value` a CSS colour or jexl callback over `feature` and a `field`
through `none | categorical | threshold`, so a track's `displayDefaults.color`
reaches both variant displays alike
([ADR-134](adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)).
Beside `rowColor` it is the pileup's `color`/`baseColor` precedent: two
channels, the cell and the row tint
([ADR-160](adr-160-a-rows-colour-is-one-categorical-channel-on-the-row-axis.md)).

**`impact`, `svType` and `phaseSet` are fields.** `cellHueOf`
(`plugins/variants/src/shared/cellHue.ts`) dispatches on the field in the
worker and reuses what the strings selected: the native impact functions, the
SV palette dealt over the types present, and the phase-set flag the phased
loop reads.

**Any other field is read off the record.** `fieldReader` resolves the path
(`INFO.CLNSIG`, `QUAL`, a `jexl:` expression) and `colorFieldOf` the
categorical or threshold field the canvas worker paints, so a value's colour
depends only on the value and the declaration. A record with no value keeps
`ALT_HUE` rather than the no-value grey, which dosage shading lifts toward the
reference grey — the rule `svType` already followed for a record with no
class. The key section is titled with the field and lists the values painted,
or every bin of a threshold.

**`LinearVariantDisplay` resolves its preset fields to the jexl colours.** A
VCF record carries no `impact` or `svType` for the canvas worker to read, so
`colorEncoding` answers `CONSEQUENCE_IMPACT_JEXL` or `SV_TYPE_COLOR_JEXL` for
the field, and `rpcProps` sends the same value with the field cleared. Every
reader — the menu ticks, `colorByMode`, the pin, Group by and the worker —
goes through the one resolver
([ADR-153](adr-153-every-display-resolves-its-colour-through-one-function.md)).

**Field... opens a dialog** over `variantFilterFields` — the columns, the
header's INFO fields with their descriptions, and the computed values — with
free text for anything else and an optional list of cut points that writes a
threshold.

## Consequences

- ~~A config or session naming `featureColor` on a multi-sample display fails
  the load naming `color`~~. Amended 2026-09-26: no refusal either, since only
  v5 betas wrote `featureColor`, so MST drops it like any undeclared key.
- The single-variant display still paints SV type through the fixed class
  colours and the multi-sample cells through the palette dealt over the types
  present; a plain SNV is grey on the first and the alt hue on the second, as
  before.
- A track-wide `displayDefaults.color` now paints the multi-sample cells too,
  as the volvox `volvox_filtered_vcf_shorthand` track does.
- The dialog writes no `range`; per-value colours are Edit as JSON's or the
  config's.

## Rejected alternatives

- **Unifying only the two SV-type spellings.** They sit in differently shaped
  slots with deliberately different palettes, so the one shared string would
  have bought nothing.
- **Translating the preset only in `rpcProps`.** The model's own readers saw
  `{ field: 'impact' }` as an attribute: Attribute... ticked, a pin that did
  nothing, and Group by handed `impact`.
- **The core `categoricalField` vocabulary answering `impact` and `svType`.**
  It is closed and holds fixed colour lists, and SV type deals a palette over
  the types present.
