---
status: Accepted
summary: "A track's `displayDefaults` sends each key to the displays whose slot of that name takes the value — the display's own lift, then the slot's type or the sub-schema's checks (`slotValueRefusal`) — rather than to every display declaring the name. A value no declaring display takes fails the track's load with each display's reason. The generated JSON schema gives each key an `anyOf` of the declaring displays' slots instead of intersecting their slot tables"
---

# ADR-134: displayDefaults routes a value to the displays that take it

## Status

Accepted (2026-09-18). Makes the core fix
[ADR-120](adr-120-one-json-schema-for-config-and-session-spec.md) named and
left ("routing by slot acceptance rather than by name"). Amended 2026-09-27:
a key merges only into the display entries the track has, so a setting never
adds a display, and a retired lift that throws refuses the value.

## Context

`collectDisplayOverrides` sent a `displayDefaults` key to every display of the
track declaring a slot by that name. Three of a FeatureTrack's five displays
declare `color` in different shapes: `LinearBasicDisplay`'s FeatureColor
object, `LinearManhattanDisplay`'s ManhattanColor object with a scale, and the
arc and multi-row displays' plain colour. `color: { scale: 'ld' }` reached the
feature display, whose object has no `scale`, and `color: { field }` reached
the arc display's plain slot; either failed the track's load. ADR-120 had
found the same collision on `displayMode`, where the arc display's vocabulary
is `arcs | semicircles`. ADR-131 removed the `facet` collision by converging
the shapes, which the colour objects cannot do: `ld` means nothing on a gene
track.

## Decision

**A key goes to the displays whose slot takes its value.**
`slotValueRefusal(schema, key, value)` (`@jbrowse/core/configuration`) runs
the display schema's own lift over `{ [key]: value }`, then checks a slot's
type or creates the sub-schema, and answers the reason or nothing.
`collectDisplayOverrides` routes a value to every display answering nothing.

**A value no declaring display takes fails the load**, naming the key and
each display's reason, where it used to fail on the first display's create.
A key no display declares still only warns.

**The validator agrees.** `displayDefaults` in the generated JSON schema is a
closed object whose each key is an `anyOf` of `$defs/<Display>Slots/properties/<key>`
over the displays declaring it, where it was the `allOf` of their slot tables.

## Consequences

- `color: 'red'` still reaches every display with a colour; `color: { field }`
  reaches the feature and Manhattan displays; `color: { scale: 'ld' }` the
  Manhattan display alone. `TrackConfigShorthand.test.ts` pins the two
  objects and the refusal on a FeatureTrack.
- `displayMode: 'compact'` on a FeatureTrack reaches the feature display and
  skips the arc display, whose `displayMode` is `arcs | semicircles`.
- A value is checked once per declaring display at load. Only tracks writing
  `displayDefaults` pay it.

- A key whose every taker is a display the track's adapter cannot feed warns
  and writes nothing. Before the amendment it created that display's entry,
  and the display switcher offered a graph track on an rGFA adapter the lanes
  display its adapter cannot feed.

## Rejected alternatives

- **One colour vocabulary across the four colour objects**, so every display
  takes every value. `ld` is a GWAS scale and the ribbon schemes are synteny
  schemes; a shared vocabulary gives FeatureColor scales it cannot paint, and
  the arc display's plain `color` would still refuse an object. MarkColor and
  MarkGlyph do share the rules
  ([ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md)).
  Superseded by
  [ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md):
  `ld` and the ribbon schemes are fields, the four objects share one shape
  and one `scale` vocabulary, and each display declares the members it paints.
- **Routing only to slots built from shared definitions** (display-kit's
  colour object, the base `height`), so a plugin display's own `color` never
  receives a shorthand value. Every key only one display declares (`mark`,
  `scales`, `labels`, `origin`) would need marking, against a plugin risk no
  live case shows: a value a display's schema refuses is already skipped.
