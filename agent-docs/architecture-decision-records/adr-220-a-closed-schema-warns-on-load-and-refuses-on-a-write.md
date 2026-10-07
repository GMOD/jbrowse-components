---
status: Accepted
summary: "`closed` is a boolean and the door decides what an undeclared key meets: a config loading names the key on the console once, with the entry's own identifier, and loads without it; a write (`setConf`, a settings bag, a plot draft, the `displayDefaults` router) runs inside `refusingUndeclaredKeys` and refuses it at any depth. Displays, tracks and the in-tree adapters are closed, as the channel objects are. Supersedes ADR-217's `'warn'` value and its registering a display that declares nothing as open, and the load-time half of the refusal ADR-131 and ADR-133 gave the channel objects"
---

# ADR-220: A closed schema warns on load and refuses on a write

## Status

Accepted (2026-10-07). Supersedes the `'warn'` value and the third decision
bullet of
[ADR-217](adr-217-a-display-names-a-key-it-does-not-declare-and-draws.md), and
the load-time refusal
[ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md) kept on the
channel objects. ADR-133's rule that a channel object refuses no combination of
its slots stands.

## Context

ADR-217 left three answers to one question. A channel object refused an
undeclared key on every door, a display named it and drew, and a track or an
adapter dropped it in silence. Three reviews of that state found:

- **The version argument ADR-217 made for displays holds for the objects under
  them.** A member a 5.x minor adds to `color`, `rows`, `facet` or `scales.y`
  threw on a 5.0 app and cost the whole track. ADR-151 had already added
  `scheme` and `range` to the colour objects.
- **The refusal does its work on a write.** The Edit plot dialog parses a draft
  by creating the display's schema, the `displayDefaults` router picks a
  display by whether its sub-schema takes the value, and a settings bag checks
  a namespace whole before any member lands. Each leans on the throw, so
  `'warn'` on the channel objects would have turned a typo in an edit into a
  console line and a write of nothing.
- **Adapters stayed open for a reason that was not the stated one.** ADR-214
  blamed the pluggable union's snapshot processor. The adapter `uri` shorthand
  already ran in each adapter's own `preProcessSnapshot`; `fillLocations` put
  the shorthand's keys back on the snapshot, so a closed adapter met `uri`.
  With every track schema closed and adapters open, the loose track form,
  shorthand adapters and `displayDefaults` all loaded.

## Decision

- **`closed` is a boolean, and the door decides.** `create` on a load names the
  undeclared key on the console, once per schema and key set, and loads without
  it. A write runs inside `refusingUndeclaredKeys`, where every closed schema
  created under it throws: `setSubschema`, `liftPlot`, `slotValueRefusal`,
  a settings bag's namespace check and `preProcessConfigSnapshot`.
- **A bare value no shorthand lifts is refused on every door.** MST's own type
  check is off in a production build, where `scales: "linear"` loaded the
  defaults in silence.
- **The warning prints the snapshot's own identifier**, so a display's names
  its track through the default `displayId`. A channel object and an adapter
  have none.
- **A display is closed by construction**: an `explicitlyTyped` schema
  identified by `displayId`, unless it says `closed: false`. A standalone
  plugin display gets the console line without opting in.
- **Tracks and in-tree adapters declare `closed: true`**, tracks through the
  base track schema. `fillLocations` strips `uri`, `baseUri` and whichever keys
  its caller consumed. The config manifest generator fails on an in-tree
  adapter that is open or whose normalizer leaves a shorthand key behind.
- **A `MultiWiggleAdapter` subadapter hands its adapter the keys that adapter
  declares** (`declaredSnapshot`), so a row's `name`, `group` and `color` stay
  metadata on the entry.
- **The v4 keys no slot takes are `retired`**: `rpcDriverName` on a track and
  `resolutionMultiplier` on `HicAdapter`, which is every one a diff of v4.3.0's
  documented slots against the manifest found. A hand-written `sequenceAdapter`
  on an adapter that declares none is not among them: `jbrowse validate`
  already reports it as an error, and the app now names it once.

## Consequences

- A config written for a later minor draws on an earlier app at every level:
  track, adapter, display and channel object.
- A misspelt key in the config editor, a session spec, a share link or a plot
  draft is still an error naming the key and the slots the schema takes.
- A `ConfigurationSchemaUnion` entry carrying another member's key warns on a
  load, where it threw.
- `jbrowse validate` words every closed schema one way, and its schema marks
  `x-closed: true`.
- A plugin adapter stays open until it opts in, since a hand-rolled `uri`
  spread would warn on its own documented shorthand. Connections, internet
  accounts and text-search adapters stay open too: v4's `jbrowse text-index`
  wrote `textSearchAdapterId` and `metaFilePath` into every indexed config.
- A `displayDefaults` value no display takes still fails the track's load
  (ADR-134).

## Rejected alternatives

- **`'warn'` on the channel objects.** It loses the parse error on every write
  door.
- **Every `explicitlyTyped` schema closed by rule.** Three hosted plugin
  adapters would warn on their own shorthand, and the rule takes in 98 schemas
  including the ones above that v4 wrote keys into.
- **Passing the door to `create`.** A nested schema's preprocessor receives the
  snapshot alone, so the write is a dynamic scope around a synchronous create.
- **A current-track context for the warning.** The track's preprocessor runs
  before its children's on a load and not at all on a write, where the context
  would be stale.
