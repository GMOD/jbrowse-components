---
status: Accepted
summary: "Three legend and colour-slot rules brought level with ggplot2. A derived key row is a colour naming every value painted in it (`CategoricalEntry.values`), so two values on one palette slot read as one swatch with both labels and Pin distinct colors pins them both. Two marks colouring or glyphing by one field through one domain and palette share one key section (`buildMarkLegend` keys on the declaration, not the mark); a ramp with an open end stays per mark. A `color` / `maybeColor` slot refuses a value the painters cannot parse — `color: 'biotype'` fails at load naming the slot and the value — and the JSON schema carries the same check as `CssColor`. Amended 2026-09-23: a ramp pinned at both ends is its declaration, so marks declaring one alike share its key"
---

# ADR-136: A legend follows its scale, and a colour slot is a colour

## Status

Accepted (2026-09-18). Extends
[ADR-108](adr-108-a-display-declares-its-colour-scales.md) (the legend derives
from the display's colour scales) and
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) (a
categorical channel is one config object).
[reference/GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) carries
the operational description.

## Context

A grammar-of-graphics cross-check of the legends and colour slots against
ggplot2 accepted three findings.

- **A merged key row named only its first value.** `unionLegendCandidates`
  skipped a candidate whose colour it had already seen, so where two values
  painted one colour — a `domain` leaving them unlisted and the hash landing
  both on one palette slot, or a palette shorter than the vocabulary — the key
  named the first and silently covered the second. ggplot2 derives a guide's
  rows from the scale's breaks: `scale_colour_manual(values = c(a = "red", b =
  "red"))` gives breaks `a, b`, two rows with the same swatch.
- **Two marks over one field drew two identical keys.** `buildMarkLegend`
  keyed a section on the mark and the channel, so two marks whose colour read
  the same field through the same domain and palette listed the same rows
  twice. ggplot2 keeps one scale per aesthetic across layers
  (`ScalesList$add_defaults` adds a scale only for an aesthetic not yet
  present) and merges guides whose hash matches (`Guides$merge`); Vega-Lite's
  `resolve.scale.color` defaults to `shared`.
- **A colour slot accepted any string.** The `color` slot type was
  `types.string`, so `color: "biotype"` — a field name where a colour goes —
  passed the loader, the config editor and `jbrowse validate` (the JSON schema
  said `{ type: 'string' }`) and painted the invalid-colour sentinel. ggplot2
  fails at draw time with `Unknown colour name: biotype`.

## Decision

- **A derived key row is a colour and every value painted in it.**
  `unionLegendCandidates` (`packages/core/src/util/legendCandidates.ts`)
  returns `{ values, color }` per colour, values in first-seen order; a value
  met in two colours stays with the first. `derivedColorScale` sorts a row's
  values by the field's comparator, labels the row with their `field.label`s
  joined by `, `, and carries them as `CategoricalEntry.values` beside `value`,
  the first, which stays the row's id. Rows stay keyed by colour because the
  hide toggle hides by colour. `pinnedColorDomain` on the canvas feature
  display appends every value of every row, so Pin distinct colors makes the
  values distinct rather than pinning the one the row named. The multi-row
  feature display's key, which has no field, joins its values the same way.
- **Marks sharing a categorical declaration share a key.** `buildMarkLegend`
  (`plugins/marks/src/LinearMarkDisplay/legend.ts`) keys a section on the
  channel's declaration — kind, field, domain, and palette or glyph range,
  which the encoder now writes onto the scale table — and unions the entries
  of every mark declaring it alike; `MarkLegendSection.markIndexes` lists them
  and the section's id joins them (`mark-0-1-color`). Any difference keeps the
  sections apart, so per-mark palettes stay a feature. A glyph key folds into
  a colour key over the same field when the colour keys every mark the glyph
  does. Visibility is handed to the build, so a hidden mark's values leave a
  shared key. **A ramp with an open end stays per mark**: its domain is the
  uniform that mark's shapes read off its own loaded values. Amended
  2026-09-23: pinned at both ends there is nothing left to follow, so the
  table carries the declared `range`, `scheme` and `reverse` and marks
  declaring one such ramp alike share its key, as they share a categorical one.
- **A colour slot refuses what is not a colour.** `color` and `maybeColor`
  (`packages/core/src/configuration/configurationSlot.ts`) refine
  `types.string` with `isCssColor`, the parse the painters run
  (`parseCssColorOr`): CSS names in any case, `#rgb` / `#rgba` / `#rrggbb` /
  `#rrggbbaa`, the `rgb()` / `rgba()` / `hsl()` / `hsla()` / `hwb()` / `lab()`
  / `lch()` / `oklab()` / `oklch()` / `color()` functions with or without
  spaces, `transparent`, and a bare BED triple — plus the empty string, which
  `outlineColor` spells "no outline" with. A `jexl:` callback is the union's
  other member and is not checked. The refusal names the value and says what
  a colour is; MST's path names the slot. `types.stripDefault` checks the
  default too, so a slot definition with a non-colour default fails the
  schema's construction. The JSON schema gets a `CssColor` def whose pattern
  is generated from the named-colour table (`CSS_COLOR_NAMES`, spelled letter
  by letter for case since JSON Schema patterns carry no flag), and
  `jbrowse validate` reports `expected a CSS color (a name like "red",
  "#rrggbb", "rgb()" or "hsl()") or a "jexl:" expression, got "biotype"`.

## Consequences

- Regenerating the schema instantiated every registered config schema, and
  no in-tree default or `test_data` config colour was refused. The generator's
  legacy-key probe fed `'probe'` through the migrations into colour slots and
  read the keys as dropped once the slot refused it; it feeds `#123456` now.
- The config editor's colour field wrote each keystroke to the slot, and a
  half-typed `#ff` would now throw. `ColorEditor` keeps text that does not
  parse as a draft, in error state with `"#ff" is not a color` under it,
  writes once it parses, and drops the draft on blur.
- A `jexl:` callback returning a non-colour string still paints the sentinel
  at draw time; the slot check is for fixed values.
- A saved session carrying a non-colour in a colour slot fails to load, as
  one carrying `height: "tall"` always has.
- `demos/apollo3/config.json` fails the pre-commit schema check for reasons
  this branch did not create (an undeclared `configuration.ApolloPlugin` key
  and a `trackId` no track defines); the check runs only when the manifest
  is regenerated, which is what surfaced it.

## Rejected alternatives

- **Key rows by value.** ggplot2's rows are breaks, one per level. Here the
  hide toggle hides features by colour, so a row keyed by value would hide
  its neighbour's features on the shared colour; the row stays a colour and
  names every value instead.
- **A shared ramp across marks with an open end.** Two marks with unpinned
  ramps over one field could union their extents into one domain and one key,
  but the domain is a uniform each mark's shaders read, so sharing it is one
  uniform for two shaders — a rendering change to measure first, not a legend
  change.
- **A hand-listed set of CSS colour names for the check or the schema.** The
  painters' table (`cssColorsLevel4.ts`) is the one list; the slot predicate
  calls the parser and the schema pattern is generated from the same table.
