---
status: Accepted
summary: "A display's retired setting names are one `retired` map on its config schema — the old name to the members its value becomes, or to a string naming what replaced a setting that is gone, which throws. `preProcessSnapshotWith` lifts it before the `closed` check, so every door through a schema takes it; `expandTrackConfigShorthand` routes `displayDefaults` by it; `migrateRetiredDisplays` and the session migration read it off the schema. This deletes `DisplayType.retiredConfig`, whose six registrations become declarations, and `refuseRetiredConfig` with the `Core-preProcessTrackConfig` registration each refusing display needed to be reachable from the shorthand at all. `scatterPointSize` is a v5-beta spelling, not a v4 one"
---

# ADR-171: A display's retired spellings are one declaration

## Status

Accepted (2026-09-25). Supersedes the `retiredConfig` row of
[ADR-168](adr-168-a-retired-display-is-declared-on-its-successor.md), whose
`retiredTypes` and `retiredState` rows stand.

## Context

Four doors reach a display setting, and each knew a different subset of the
vocabulary:

| door | ran |
| --- | --- |
| a `displays` entry in a track config | `DisplayType.retiredConfig`, then the schema's `preProcessSnapshot` |
| the `displayDefaults` shorthand | `Core-preProcessTrackConfig` handlers, then routing by the schema's `definition` — neither of the above |
| a session spec, share link or agent settings bag | the schema's `preProcessSnapshot` alone |
| a saved session's display instance | `retiredState.lift`, `retiredTypes[].migrate`, `retiredConfig` |

So a name landed in one door and vanished in another. Driven against the real
config machinery: `scatterPointSize: 9` on a `QuantitativeTrack` read `size` 9
written as a `displays` entry and the slot default 2 written under
`displayDefaults`, where the router reported a key no display declares and
dropped it with a `console.warn`. A v4 `colorBy` and `trackMaxHeight` applied
written as a `displays` entry and came back `undeclared` from
`applyConfSettings`, which is what a spec URL, a share link and
`track.applyDisplaySettings` all write through.

The refusals the row-model port raises had the same shape from the other side.
`refuseRetiredConfig` was a schema `preProcessSnapshot`, which the shorthand
router never consulted, so each refusing display also registered a
`Core-preProcessTrackConfig` handler whose only job was to move a retired key
out of `displayDefaults` onto an explicit entry where the refusal could see it.

## Decision

`ConfigurationSchemaOptions` gains `retired`: a map from the name an older
release used to a function answering the members its value becomes, or to a
string naming what replaced a setting that is gone, which the schema throws on.
It merges per key down the `baseConfiguration` chain, so a subclass adds a
spelling without dropping the ones its base retired.

`liftRetiredSpellings` applies it, and four readers share that one function:

- `preProcessSnapshotWith`, before the `closed` check and the schema's own
  `preProcessSnapshot` — so `create`, `applySnapshot`, `setSubschema` and
  `applyConfSettings` all take it, which covers the config entry, the share
  link and the agent bag.
- `expandTrackConfigShorthand`, which asks each display whether it declares a
  key **or retires one**, and routes the members a lift answers. A retired key
  with no replacement is a `refused` entry, so the shorthand fails the load
  naming the replacement rather than warning about a key nobody declares.
- `migrateRetiredDisplays`, which keeps running it before the
  `Core-preProcessTrackConfig` handlers so a handler still reads current names.
- product-core's session migration, over a v4 display instance.

The lift is idempotent by construction — it deletes the old key — so running in
both the track preprocessor and the schema costs nothing. A spelling the
snapshot already carries wins over one a lift produces, and where two retired
names lift onto one member (a slot spelt directly and the same slot inside a
retired `renderer`) the one declared first wins.

`DisplayType.retiredConfig` is deleted. Its six registrations become
declarations: `scatterPointSize` on the wiggle score slots, shared by the
wiggle, Manhattan and both GC-content displays; `colorBy` on the alignments
display; the chord display's `strokeColor*` and `renderer`, which move off that
schema's `preProcessSnapshot`; and `LinearBasicDisplay`'s, which was a duplicate
of its own schema hook.

A retired **value** in a slot the display still declares stays the schema's
`preProcessSnapshot`. ADR-168 and ARCHITECTURE.md both said such a value had to
go in `retiredConfig`, because "the display `types.union` validates the raw
snapshot before any schema `preProcessSnapshot` runs". That is not what it does:
`pluggableConfigSchemaType` builds a bare `types.union` with no dispatcher, and
a member's preprocessor runs while the union works out which member a snapshot
is. `LinearBasicDisplay/retiredSpellings.test.ts` drives
`displayMode: 'reducedRepresentation'` — a value no member of that slot's
`types.enumeration` admits — through the union with no registration anywhere
but the schema, and it loads as `normal`; neutering the preprocessor fails it
with the enum's refusal.

## Consequences

One place declares a display's vocabulary, and adding a retired spelling stops
being a choice among hooks that each cover a different subset.

`scatterPointSize` now reads 9 through all three config doors. It is also not a
v4 spelling: it appears in no file at `v3.6.4` or at any `v4` tag and in 78 at
`v5.0.0-beta.9`, v4 having had no configurable scatter point diameter at all.
Three places in the tree called it v4. Whether a beta-only name deserves a lift
at all or a refusal naming `size` is a one-word change in the declaration now,
which is the point of having one.

`displayDefaults` is itself a v5 addition — absent at `v4.3.0` — so a config
mixing it with a retired name is one written against this release, not an old
one JBrowse has to keep loading. `jbrowse validate` already refused that
combination: the JSON schema closes `displayDefaults` to the union of every
declared display slot. The loose `{ trackId, uri }` track form leaves it open
(`LooseTrack`'s `displayDefaults: { type: 'object' }`) and still admits a
misspelling the loader drops.
