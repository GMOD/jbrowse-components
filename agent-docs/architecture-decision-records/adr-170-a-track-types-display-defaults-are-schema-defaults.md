---
status: Accepted
summary: "A `MultiQuantitativeTrack` states its three display defaults (`rows: 'source'`, `summaryScoreMode: 'avg'`, `height: 200`) as the slot defaults of a track-scoped `LinearWiggleDisplay` schema, which its `displays` union holds in place of the global one; the `Core-preProcessTrackConfig` seed into `displayDefaults` is deleted. A snapshot strips against the schema that refills it, so the single-source values (`rows: ''`, `whiskers`, 100px) survive a reload on a multi track, a session track shows them on first load, and a reset lands on the track's default. The retired multi-wiggle fold fills `rows.field` only where the entry leaves it unset, so it is a fixed point. Reverses ADR-143's \"one display type has one set of slot defaults\""
---

# ADR-170: A track type's display defaults are its displays' schema defaults

## Status

Accepted (2026-09-25). Amends
[ADR-143](adr-143-one-quantitative-display-and-facet-is-the-layout.md), whose
"the track types differ in defaults and nothing else" stands; how the defaults
are stated changes.

## Context

ADR-143 seeded the multi track's defaults into `displayDefaults` from a
`Core-preProcessTrackConfig` handler, on the reasoning that one display type has
one set of slot defaults. A snapshot, though, strips against the display
schema's defaults (`stripDefault`), and the seed refilled against the track
type's. A value equal to the first and different from the second could not
survive one `getSnapshot` → `create`:

```
BEFORE {"rows":"","height":100,"summaryScoreMode":"whiskers"}
STORED [{"type":"LinearWiggleDisplay","displayId":"w"}]
AFTER  {"rows":"source","height":200,"summaryScoreMode":"avg"}
```

A session track was worse: `sessionTracks` is a stripped snapshot re-hydrated
through the seed, so an overlaid multi-wiggle the user added never showed
overlaid, even on first load.

## Decision

`MultiQuantitativeTrack` redeclares `displays` over the registered display
schemas with `LinearWiggleDisplay`'s swapped for a schema of the same name whose
`baseConfiguration` is the global one and whose `rows`, `height` and
`summaryScoreMode` defaults are the track's
(`MultiQuantitativeTrack/displaySchema.ts`). The display model's
`ConfigurationReference` resolves by `displayId` with a display-type fallback,
so the live model reads through either schema; the slot set is unchanged, so
the shorthand router and `applyDisplaySettings` read nothing new. The seed is
deleted. The legacy-rendering fold of `displayDefaults` stays, as
`foldRetiredRenderingDefaults`.

With the seed gone, a v4 session track's rows were lost to a second fold. The
session migration folds lifted state onto an entry that still spells
`MultiLinearWiggleDisplay`, and hydration folds that entry again, so
`multirowxy` became `{ xyplot, rows: 'source' }` and then `rows: ''` off the
plain-name row. The fold now fills `rows.field` only where the entry spells
none.

## Consequences

- Share links shrink, since a default multi-wiggle stores only
  `{ type, displayId }`.
- A second track type that wants its own defaults for a shared display can
  redeclare `displays` the same way.

## Rejected

- **A third `rows` token for "unstated".** Closes the `rows` hole and leaves
  `height` and `summaryScoreMode` with the same one.
- **`rowsConfigSchema` as a factory taking the default.** A shared slot builder
  drops the generated page's slots; the variant is a sub-schema deriving from
  the const instead.
- **Listing the members by hand.** `LinearMarkDisplay` registers against the
  track too, and the base config injects a stub for every registered display,
  so a wiggle-only union throws in the app.
