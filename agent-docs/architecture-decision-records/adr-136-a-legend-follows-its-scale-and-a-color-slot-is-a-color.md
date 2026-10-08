---
status: Accepted
summary: "Three legend and color-slot rules brought level with ggplot2. A derived key row is a color naming every value painted in it (`CategoricalEntry.values`), so two values on one palette slot read as one swatch with both labels. Two marks coloring or glyphing by one field through one domain and palette share one key section (`buildMarkLegend` keys on the declaration, not the mark); a ramp with an open end stays per mark. A `color` / `maybeColor` slot refuses a value the painters cannot parse — `color: 'biotype'` fails at load naming the slot and the value — and the JSON schema carries the same check as `CssColor`. Amended 2026-09-23: a ramp pinned at both ends is its declaration, so marks declaring one alike share its key. Amended 2026-09-24: the synteny views' text-column keys merge a color's labels the same way, and the mark, multi-row and multi-sample variant keys run `derivedColorScale` rather than spelling the rule by hand. Amended 2026-10-03 (ADR-205): an unlisted value is dealt a color of its own, so a shared swatch comes from a range or domain the config wrote, and Pin distinct colors is gone"
---

# ADR-136: A legend follows its scale, and a color slot is a color

## Status

Accepted (2026-09-18). Extends
[ADR-108](adr-108-a-display-declares-its-color-scales.md) (the legend derives
from the display's color scales) and
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) (a
categorical channel is one config object).
[reference/GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) carries
the operational description.

## Context

A grammar-of-graphics cross-check of the legends and color slots against
ggplot2 accepted three findings.

- **A merged key row named only its first value.** `unionLegendCandidates`
  skipped a candidate whose color it had already seen, so where two values
  painted one color — a `domain` leaving them unlisted and the hash landing
  both on one palette slot, or a palette shorter than the vocabulary — the key
  named the first and silently covered the second. ggplot2 derives a guide's
  rows from the scale's breaks: `scale_color_manual(values = c(a = "red", b =
  "red"))` gives breaks `a, b`, two rows with the same swatch.
- **Two marks over one field drew two identical keys.** `buildMarkLegend`
  keyed a section on the mark and the channel, so two marks whose color read
  the same field through the same domain and palette listed the same rows
  twice. ggplot2 keeps one scale per aesthetic across layers
  (`ScalesList$add_defaults` adds a scale only for an aesthetic not yet
  present) and merges guides whose hash matches (`Guides$merge`); Vega-Lite's
  `resolve.scale.color` defaults to `shared`.
- **A color slot accepted any string.** The `color` slot type was
  `types.string`, so `color: "biotype"` — a field name where a color goes —
  passed the loader, the config editor and `jbrowse validate` (the JSON schema
  said `{ type: 'string' }`) and painted the invalid-color sentinel. ggplot2
  fails at draw time with `Unknown color name: biotype`.

## Decision

- **A derived key row is a color and every value painted in it.**
  `unionLegendCandidates` (`packages/core/src/util/legendCandidates.ts`)
  returns `{ values, color }` per color, values in first-seen order; a value
  met in two colors stays with the first. `derivedColorScale` sorts a row's
  values by the field's comparator, labels the row with their `field.label`s
  joined by `, `, and carries them as `CategoricalEntry.values` beside `value`,
  the first, which stays the row's id. Rows stay keyed by color because the
  hide toggle hides by color. (Amended 2026-10-03: `pinnedColorDomain`, which
  appended every value of every row for Pin distinct colors, went with the pin
  in [ADR-205](adr-205-a-categorical-color-is-dealt-once-on-first-sight.md).)
  The multi-row
  feature display's key, which has no field, joins its values the same way.
  Amended 2026-09-24: so do the synteny views' text-column keys
  (`getColorBySwatch`), where SyRI's palette paints INVDP in DUP's color as
  plotsr does; the unlabelled grey is keyed only once a row painted it.
  Amended again 2026-09-24: the mark display's categorical key, the multi-row
  display's and the multi-sample variant cells' field rows each spelt this
  rule by hand, with one row per value, first-seen order or no readability
  gate between them; all three now run `derivedColorScale`, which takes a
  `title` and a `swatches` hook for the mark's shapes and the variant's
  dosage pair. alu_age's FLAM and FRAM, one grey, are one row, and the
  multi-row key keeps the name field's order across a pan.
- **Marks sharing a categorical declaration share a key.** `buildMarkLegend`
  (`plugins/marks/src/LinearMarkDisplay/legend.ts`) keys a section on the
  channel's declaration — kind, field, domain, and palette or glyph range,
  which the encoder now writes onto the scale table — and unions the entries
  of every mark declaring it alike; `MarkLegendSection.markIndexes` lists them
  and the section's id joins them (`mark-0-1-color`). Any difference keeps the
  sections apart, so per-mark palettes stay a feature. A glyph key folds into
  a color key over the same field when the color keys every mark the glyph
  does. Visibility is handed to the build, so a hidden mark's values leave a
  shared key. **A ramp with an open end stays per mark**: its domain is the
  uniform that mark's shapes read off its own loaded values. Amended
  2026-09-23: pinned at both ends there is nothing left to follow, so the
  table carries the declared `range`, `scheme` and `reverse` and marks
  declaring one such ramp alike share its key, as they share a categorical one.
- **A color slot refuses what is not a color.** `color` and `maybeColor`
  (`packages/core/src/configuration/configurationSlot.ts`) refine
  `types.string` with `isCssColor`, the parse the painters run
  (`parseCssColorOr`): CSS names in any case, `#rgb` / `#rgba` / `#rrggbb` /
  `#rrggbbaa`, the `rgb()` / `rgba()` / `hsl()` / `hsla()` / `hwb()` / `lab()`
  / `lch()` / `oklab()` / `oklch()` / `color()` functions with or without
  spaces, `transparent`, and a bare BED triple — plus the empty string, which
  `outlineColor` spells "no outline" with. A `jexl:` callback is the union's
  other member and is not checked. The refusal names the value and says what
  a color is; MST's path names the slot. `types.stripDefault` checks the
  default too, so a slot definition with a non-color default fails the
  schema's construction. The JSON schema gets a `CssColor` def whose pattern
  is generated from the named-color table (`CSS_COLOR_NAMES`, spelled letter
  by letter for case since JSON Schema patterns carry no flag), and
  `jbrowse validate` reports `expected a CSS color (a name like "red",
  "#rrggbb", "rgb()" or "hsl()") or a "jexl:" expression, got "biotype"`.

## Consequences

- Regenerating the schema instantiated every registered config schema, and
  no in-tree default or `test_data` config color was refused. The generator's
  legacy-key probe fed `'probe'` through the migrations into color slots and
  read the keys as dropped once the slot refused it; it feeds `#123456` now.
- The config editor's color field wrote each keystroke to the slot, and a
  half-typed `#ff` would now throw. `ColorEditor` keeps text that does not
  parse as a draft, in error state with `"#ff" is not a color` under it,
  writes once it parses, and drops the draft on blur.
- A `jexl:` callback returning a non-color string still paints the sentinel
  at draw time; the slot check is for fixed values.
- A saved session carrying a non-color in a color slot fails to load, as
  one carrying `height: "tall"` always has.
- `demos/apollo3/config.json` fails the pre-commit schema check for reasons
  this branch did not create (an undeclared `configuration.ApolloPlugin` key
  and a `trackId` no track defines); the check runs only when the manifest
  is regenerated, which is what surfaced it.

## Rejected alternatives

- **Key rows by value.** ggplot2's rows are breaks, one per level. Here the
  hide toggle hides features by color, so a row keyed by value would hide
  its neighbour's features on the shared color; the row stays a color and
  names every value instead.
- **A shared ramp across marks with an open end.** Two marks with unpinned
  ramps over one field could union their extents into one domain and one key,
  but the domain is a uniform each mark's shaders read, so sharing it is one
  uniform for two shaders — a rendering change to measure first, not a legend
  change.
- **A hand-listed set of CSS color names for the check or the schema.** The
  painters' table (`cssColorsLevel4.ts`) is the one list; the slot predicate
  calls the parser and the schema pattern is generated from the same table.
