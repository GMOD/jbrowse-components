---
status: Accepted
summary: "A display's facet and its categorical colour are one config object each — `facet: \"HP\" | { field, domain }` and `color: \"red\" | \"jexl:…\" | { field, domain, palette }` — replacing the flat `facetField`/`facetDomain`/`colorField`/`colorDomain`/`colorPalette` slots on the feature, mark and multi-sample variant displays, where the row tint is `rowColor`, and the alignments displays' `groupBy`, now the same `facet` with read dimensions and `tags.HP` as fields. The GWAS and multi-way colours are one object too, with a `scale` naming each display's own schemes. A string is the channel's one-value form and lifts into the object; an object replaces the channel whole and `null` clears it; a key the object does not declare is refused when the snapshot is read (ADR-133 dropped this record's refusals of slot combinations). `applyDisplaySettings` writes a sub-schema, `describeSlots` lists one, and Edit as JSON is an editor over the two settings rather than a translation onto flat slots"
---

# ADR-131: A categorical channel is one config object

## Status

Accepted (2026-09-18). Supersedes the "two flat slots" sentence of
[ADR-130](adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md),
whose level and semantics for the facet stand.

## Context

The feature display's Group by and Color by attribute, the mark display's
facet and the multi-sample variant displays' row banding each stored one
declaration — a field, and the order or the palette its values take — as two
to four top-level slots: `facetField`/`facetDomain`,
`colorField`/`colorDomain`/`colorPalette` beside `color`, and the variants'
`colorBy`. Everything else in the product already spoke the nested form: the
mark display's `encoding.color` is `{ value, field, scale, domain, palette }`
lifted from a string, Edit as JSON showed
`{ facet: { field, domain }, color: { field, domain, palette } }`, the worker
request carried `facet: { field }`, every channel read its field through
`categoricalField(field, { domain, palette })`, and the agent guide described
the nested spec. The flat file format was the one place a user learned a
second shape.

Two reviews ran the same day. The first kept the slots flat: `color` could not
be a colour and a sub-schema at once, `applyDisplaySettings` wrote only
top-level slots, the mark display already exposed flat getters, and the
conversion was half a day for no new capability. The second, told that
breaking changes are free in this cycle and that effort does not choose a
design, answered each point and reversed it.

## Decision

**Each categorical channel is one config sub-schema**, shared from
`@jbrowse/display-kit`:

- `facet` (`facetConfigSchema`): `{ field, domain }`. `"strand"` lifts to
  `{ field: "strand" }`. On the feature, mark, multi-sample variant and
  alignments displays; the alignments displays also take a read dimension
  (`pairOrientation`, `splitRead`, `mapq`, ...) as the field, and a tag as
  `tags.HP`.
- `color` (`colorConfigSchema`, `FeatureColor`): `{ value, field, domain,
  palette }`. `"red"` and `"jexl:…"` lift to `{ value }`; `value` is a
  `maybeColor`, so an unset colour still lets a BED `itemRgb` paint. On the
  canvas base display, so the feature and variant displays.
- The multi-sample variant displays' row tint is `rowColor`, a plain field
  name. It is not `color`: the cells there are coloured by genotype, and
  `color` would read as the cells' colour.

The rules a writer can rely on:

- **A string is the channel's one-value form.** For a channel with a constant
  the string is the constant; for one that is only ever a field, the field.
  `{ value }` exists only as what a colour string lifts into, and no example
  shows it.
- **An object replaces the channel; `null` clears it.** There is no merge. A
  writer that changes only the order (the Sections menu, Pin distinct colors)
  knows the field and writes the whole object back.
- **The shorthand is declared, not conventional.** `ConfigurationSchema`
  takes `shorthand: 'field'` (or `'value'`), lifts a bare string into that
  slot on every path a snapshot arrives by, and the JSON schema generator,
  `describeSlots` and the config editor read the declaration rather than
  probing the preprocessor. The mark display's `MarkColor`, `MarkGlyph` and
  `MarkValue` declare theirs the same way.
- **The object refuses what a config cannot hold**, on load and through
  every writer: a key it does not declare, which MST would drop in silence,
  through `ConfigurationSchema`'s declared `closed` option; and a `domain` or
  `palette` that is not a list. This record also refused a `domain` or
  `palette` naming no `field`, which
  [ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md) dropped:
  the config editor writes one slot at a time and saved objects it then could
  not reload.
- **The keys keep their names.** `color: "red"` needs no change.

**The writers are the generic ones.** `applyDisplaySettings` gained a
sub-schema branch (`setSubschema`, which runs the object's own lift), so a
session spec, `jb.applyDisplaySettings({ facet: 'strand', color: { field } })`
and Edit as JSON all write the same door; Edit as JSON parses its text through
`preProcessConfigSnapshot`, the lift and checks `create` applies, and hands
`facet` and `color` to `applyDisplaySettings` and `filter` to
`setJexlFilters`, and `applyChannelSpec`, `facetOf`-as-writer and the
hand-written channel checks are gone. `describeSlots` lists a sub-schema with
its own slots and the declared shorthand.
`jbrowse validate` reports a misspelt key inside the object and a wrong type at
`facet.field`, because the generated JSON schema of a lifted sub-schema is
`anyOf [string, object]` with `additionalProperties: false`.

## Consequences

- One declaration is one key, so a domain cannot drift from its field, and
  `setFacet`, `setColorScale` and `setFeatureColor` each write one object
  where they wrote two to four slots in step.
- A display-type switch ports the object through `setSubschema` beside the
  slots it ports through `setSlot` (`getPortableSettings`).
- No migration from the flat slots. A config written with `facetField`,
  `colorField` or `colorBy` on these displays is reported by the validator and
  ignored by the reader.
- The website's spec-recipe reads the object: a `color` object is the Color
  by... attribute path, a `facet` with a `domain` adds the Sections step, and
  `rowColor` is Color by... → Samples.
- **The alignments displays' `groupBy` is `facet` too** (landed the same
  day). The partitioner resolves a read dimension through its own key
  generator, a `tags.` field through `getTag` rather than a path read that
  decodes every tag on the read, and any other field through `fieldReader`.
  `LGVSyntenyDisplay` inherits it. The model's getter and action are `facet`
  and `setFacet`; the worker request still says `groupBy`, the partition
  mechanism's name.
- **The GWAS Manhattan and multi-way colours are one object too** (landed
  the same day), each with a `scale` naming the display's own schemes, as
  `MarkColor` has: `color: "goldenrod" | { field, domain, palette } |
  { scale: "ld" }` (`ManhattanColor`), and `ribbonColor: "grey" |
  { scale: "strand" } | { field, domain }` (`RibbonColor`), whose scales are
  the synteny view's scheme names and whose `field` is a declared attribute
  column. A `field` with no `scale` reads through `categorical`; a `field`
  under another scale waits unread since
  [ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md), which
  also made `scale` unset by default. `RibbonColor` declares no `palette`: a
  label's colour there is its position in synteny-core's palette, which
  nothing configures. The multi-way model keeps a synteny mode as the runtime
  mode (`ribbonColorBy.ts`), so its geometry and menu are unchanged.
- ~~**The synteny view's `colorBy` stays a mode string**: a view property with
  launch keys and v4 `init` compatibility, not a track config slot.~~
  Superseded by
  [ADR-137](adr-137-the-synteny-views-colorby-is-the-colour-object-every-band-inherits.md):
  the synteny and dotplot views' `colorBy` is the `SyntenyColor` object, held
  as the MST property. `ChordSyntenyDisplay`'s `colorBy`
  (`default | chromosome | strand`) has no field mode, so like alignments'
  `colorBy` it selects a scheme and is outside this decision.
- A review of the landing found the config editor's per-slot writes and the
  menus' scale switches at odds with the object's refusals
  ([ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md)), and
  `displayDefaults` sending a colour object to displays whose `color` has
  another shape
  ([ADR-134](adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)).

## Rejected alternatives

- **Keep the slots flat.** Every reason given was about the code: `color`
  already holds a string and an object through its declared shorthand on the mark
  display; the `applyDisplaySettings` branch is a few lines; the flat getters
  were ADR-130's own commit; and a validator that flags the dialog's spelling
  as an error is an argument against flat, not for it.
- **Merge an object into the stored one.** A partial write that leaves a stale
  `domain` under a new `field` is the drift the object exists to prevent.
- **Call the variants' tint `color`.** The genotype cells own that word there.
- **A `{ type, tag, domain }` facet for the alignments displays**, on the
  grounds that a read dimension is not a field. On an AlignmentsTrack,
  `displayDefaults` routes `facet` to the mark display as well, whose `facet`
  refused that shape, so the cookbook's phased-reads config failed to load.
  One shape removed the collision; ADR-134's routing by value would now also
  have avoided it, but two facet shapes would still be one channel spelt
  twice.
