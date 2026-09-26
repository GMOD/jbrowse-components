---
status: Accepted
summary: "Amended 2026-09-25: the property is named `color`, as every colour object is, the circular view holds it too, and an older snapshot's `colorBy` lifts into it. The linear synteny and dotplot views' `colorBy` is a `SyntenyColor` object — `\"grey\" | { value, field, scale: 'none', domain }` from the display-kit colour factory, held as the MST property itself so one lift and one set of refusals run on every path — replacing the mode string and the `colorDomain` property. The structural modes are fields the views read (`strand`, `query`, `target`, `reference`, `track`) beside the measurement presets; any other field is a declared column. The field is the runtime form: the colour functions, legends, menus and the worker dispatch on it, and the mode vocabulary — `default`, `mappingQuality`, `attribute:<name>` — is gone with the string. Supersedes ADR-131's \"the synteny view's `colorBy` stays a mode string\""
---

# ADR-139: The synteny views' `colorBy` is the colour object every band inherits

## Status

**Amended 2026-09-25**: the property is named `color`, as every other colour
object in the tree is (FeatureColor, ManhattanColor, AlignmentsColor, MarkColor
and the rest sit under `color`), and the circular view composes it too, through
`SyntenyColorsMixin`. The model's members follow the house spelling —
`colorSetting`, `colorField`, `colorValue`, `setColorField` — and the "Color
by..." menu keeps its label. Older spellings lift into place
(`liftSyntenyViewSettings`, in both views' `preProcessSnapshot`): v4.3.0 held
`colorBy`, `alpha` and `minAlignmentLength` on each synteny display, so the
first display carrying each lands on the view, `colorBy` as `color`, a mode
string mapped the way `coerceColorBy` mapped it. Launch links the genomes
portal handed out carry the mode string on the view, which lifts the same way.
That reverses the rejected alternative below that let the string fail at load:
state other people hold in URLs keeps working. The two views name `colorBy` as
launch-key `passThrough`, and the validator manifest takes the display keys
from the lift, so `jbrowse validate` accepts an older session. jbrowse-img
keeps its `--colorBy` flag and writes `color`. Amended 2026-09-26: the betas'
`colorDomain`, the object under `colorBy`, the `attribute:` prefix, the modes
v4.3.0 lacked and the `init` lift went, since only the betas wrote them.

Accepted (2026-09-18). Supersedes one consequence of
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) ("The
synteny view's `colorBy` stays a mode string"). Extends
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md),
whose factory and field-not-scale rule this object follows.

## Context

The grammar-of-graphics review that produced ADR-131 through ADR-136 left one
channel spelt two ways. The multi-way synteny display's `ribbonColor` was a
colour object — `"grey" | { value, field, scale: 'none', domain }`, where the
field is `strand`, a measurement preset (`identity`, `mapq`, `dnds`)
or a declared column — and `ribbonColorBy.ts` beside it mapped the object onto
the synteny runtime modes. The linear synteny view's `colorBy`, shared with
the dotplot view through `TrackColorsMixin`, was still one of those mode
strings held as a plain `types.string`, with `coerceColorBy` admitting the
value and mapping two retired spellings, a separate `colorDomain` property
carrying the order the string could not, and the open arm spelt
`attribute:<name>`: a field inside a prefix, the flat shape ADR-131 removed
everywhere else.

In ggplot2 the view's colour is the plot-level `aes()` every layer inherits
(`inherit.aes = TRUE`), and the multi-way display's is one layer's own. They
are one structure. v5 ships no migrations, so nothing held the string in
place but the work of changing it.

## Decision

**`TrackColorsMixin.colorBy` is the `SyntenyColor` config object**
(`packages/synteny-core/src/syntenyColorConfigSchema.ts`): `value`
(`maybeColor`), `field`, `scale` (`none` alone) and `domain` from
`colorChannelSlots`, with `colorChannelOptions('colorBy')` for the `value`
shorthand, `closed` and `normalizeChannel`. The schema is the MST property,
not a frozen snapshot: a config sub-model in a view runs its own
`preProcessSnapshot` on `create`, `applySnapshot`, a launch spec and the
mixin's actions (`self.colorBy = cast(snapshot)`), so the string lift, the
refusal of an undeclared key and the list checks are one code path with the
display objects'. `colorDomain` is `colorBy.domain`; `hideUnlabelled` and
`trackColors` stay properties, a filter and a pin table rather than the
channel.

**The structural modes are fields.** `strand`, `query`, `target`,
`reference` and `track` are variables an alignment carries — its
orientation, the sequence at either end, the anchor assembly's chromosome,
the source track — the way the alignments displays take `pairOrientation` and
`mapq` as facet fields. `SYNTENY_VIEW_FIELDS` lists them and the slot
documents them; a field outside that list and outside the measurement
presets is a declared column, on the view as on the ribbon.

**The field is what everything dispatches on.** There is no mode string
between the object and the paint: `paintedField(color)` reads the field out
(`''` under `scale: 'none'`, which is the default colour), and the colour
functions, the legends, the menu radios and the worker all switch on that
string. The structural fields come first in each switch and the ramps after,
so a preset and a declared column are the same arm — `continuousRampConfig`
is keyed by field, and each preset names the attribute it reads: `identity`
and `dnds` read their own name, `mapq` reads `mappingQual`.
`syntenyColorFor(field, current)` writes the object a menu pick means: `''` keeps the field and its order under
`scale: 'none'`, and a field keeps its `domain` only when it is the one
already named, as ADR-133 and the multi-way menu already did. One field is one
radio: a column an aligner named `identity` or `strand` writes what the preset
or structural radio writes, so the menu offers the declared columns a radio
does not already cover. The preset table is read by own property, since the
field is a plain config string and `toString` names no ramp. The multi-way
display's `ribbonColorBy.ts`, the per-surface `reads` lists, the
`attribute:` prefix, the `SyntenyColorBy` union, `coerceColorBy` and the
retired spellings it mapped are all deleted. Which structural fields a
surface offers is its menu's list and nothing else (`['', 'strand']` for the
ribbons, `SYNTENY_VIEW_FIELDS` for the views); a field a surface has no
reader for paints its default colour.

**`value` paints.** A colour string lifts into `value`, and under `none` the
synteny display paints its match blocks and the dotplot its points in that
colour in place of the default scheme; insertions and deletions keep their
colours. The two colour passes take it as `valueColor`, which stands in for
`defaultColor`. A mode name where a colour goes — `colorBy: 'strand'`, the
old spelling — fails at load naming the value, by ADR-136's colour-slot
check.

**`RibbonColor` stays its own declaration.** ADR-135 gives each object its
own `value` slot with the display's type and default: the ribbon's is a
`color` defaulting to grey, the view's a `maybeColor` whose unset state is
the red CIGAR scheme or the black point. The two share the factory, the field
list and the map.

**The dotplot view converges with the synteny view**, since the property is
the mixin's. jbrowse-img's `--colorBy` takes the field name and writes
`{ field }`; its enum is the named fields, checked against
`SYNTENY_VIEW_FIELDS` and `continuousRampConfig` at build time, and a
declared column goes through `--spec`.

## Consequences

- A session, config or spec writes `colorBy: { field: 'strand' }` where it
  wrote `colorBy: 'strand'`; `{ field: 'gene_group' }` where it wrote
  `'attribute:gene_group'`; `{ field: 'mapq' }`, the pileup's name for it,
  where it wrote `'mappingQuality'`; and the order in `colorBy.domain` where
  it had `colorDomain`. The default has no spelling: omit the key or write
  `null`. Eleven demo configs and the seven shell scripts that generate them,
  `test_data/hs1_vs_mm39`, three jbrowse-img spec files, six jbrowse-web
  browser-test session specs, the tutorials, the URL-parameters example, the
  website's spec scripts and the web sample data changed spelling. `jbrowse
  validate` reports a misspelt key inside the object but not the old string,
  which is legal as the colour shorthand and fails at load instead, naming the
  value.
- `TrackColorsMixin.test.ts` and the two `launchInput` suites pin the four
  structural fields, a preset, a column, the string shorthand, `null`, a
  misspelt key, a mode string in the colour slot, and a session-spec round
  trip.
- The `SyntenyColor` config page, the v5 JSON schema (`anyOf [string,
  object]` under the view's `colorBy`), the validator manifest and the model
  pages regenerate; the URL-parameters rows for `colorBy` come off the
  property docstring and the `#valueList` tag is gone with the string list.
- The website's spec recipe reads the view's `colorBy` and the multi-way
  display's `ribbonColor` through `paintedField`, where it had a hand copy
  of the ribbon map that still named the retired `categorical` scale.
- `colorBy.value` is a state the views did not have: one flat colour for
  every alignment, which the legend keys nothing for (`hasLegendKey` reads
  the field).

## Rejected alternatives

- **A frozen snapshot property with the schema's preprocess run by hand.**
  Two lifts: the model's `preProcessSnapshot` for a spec and the action's own
  for a menu pick, drifting apart the way ADR-131's writers had.
- **One schema for the ribbon and the views.** The `value` defaults differ
  (grey against the surface's own scheme), and the ribbon's page would
  document four fields it cannot paint. ADR-135's one-factory rule is the
  sharing the product needs.
- **`trackColors` as `colorBy.palette` under `field: 'track'`.** A pin is
  keyed by track id and the automatic slots avoid every pinned sibling
  (`assignTrackColors`), which a positional palette cannot say; and
  `RibbonColor` declares no palette.
- **Keeping the string with a coercion for the old spellings.** v5 ships no
  migrations, and a string that fails at load naming itself is better than
  one coerced to the default in silence, which is what `coerceColorBy` did to
  a typo.
- **A per-surface `reads` list resolving a field the surface cannot paint
  into a declared column.** It bought nothing the menu does not already say:
  either way `{ field: 'query' }` on a ribbon finds no `query` column in the
  data and paints the ribbon's own colour. Two lists and a generic parameter
  threaded through the menu, the target and the config schema to reach the
  same pixel.
