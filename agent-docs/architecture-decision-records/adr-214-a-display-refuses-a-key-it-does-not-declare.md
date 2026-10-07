---
status: Accepted
summary: "Every display's config schema is `closed`, and `DisplayType` refuses to register one that is not: a key a display does not declare fails the track's load naming the key and the slots it takes, where MST dropped it in silence and only `jbrowse validate` saw it. The check runs after the schema's own `preProcessSnapshot` and only on the schema's own snapshot, so a track's `displayDefaults` and a union's other members pass. Tracks and adapters stay open, since their `uri` and `displayDefaults` shorthands expand outside the schema; the validator's wording says which refuses and which drops"
---

# ADR-214: A display refuses a key it does not declare

## Status

Accepted (2026-10-07). Extends the `closed` rule
[ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md) gave the
channel objects to every display, and gives
[ADR-204](adr-204-every-display-edits-its-grammar-settings-as-one-plot.md)'s
"the schema is the parser" its last door. Found by the 2026-10-07 grammar
audit.

## Context

A mark's `encoding`, a colour object, `scales.y`, `facet` and `rows` each
refused a key they did not declare (`closed: true`), while no display schema
did: `{ type: 'LinearMarkDisplay', totallyBogus: 1 }` loaded and kept nothing
but its type and id. Two readers hit the consequence in one audit. A misspelt
`filterBy` member on the alignments display did nothing, and a tutorial
writing `rows` on a session display snapshot narrowed no rows. The CLI's
schema already treated every display as a closed object
(`unevaluatedProperties: false`, ADR-120), so the app and the validator
disagreed about the same config.

## Decision

- **Every display's config schema declares `closed: true`.** The displays
  composing `BaseLinearDisplay` inherit it, since `closed` is an option the
  base hands down; the standalone schemas (wiggle, Hi-C, LD, the mark display
  and Manhattan through it, the chords, the dotplot, the reference sequence,
  the synteny display) declare it themselves.
- **`DisplayType` refuses an open schema at registration**, naming the display
  and the option, so a plugin display learns the rule at boot rather than
  when a user's typo vanishes.
- **The check runs after the schema's own `preProcessSnapshot`**, where it
  ran before it, so a key a schema consumes on the way in, a track's
  `displayDefaults`, is gone before the check reads the snapshot; and only on
  the schema's own snapshot (`isOwnSnapshot`), since a track's `displays`
  union runs every member's preprocessor over every entry while it works out
  which display an entry is.
- **Tracks and adapters stay open.** Closing every `explicitlyTyped` schema by
  rule was built and backed out the same day: an adapter's `uri` and a track's
  loose `{ trackId, uri }` form expand in the union's snapshot processor,
  outside the schema, so the schema met the shorthand and refused it. The
  validator's message says which: a display "refuses to load it rather than
  drop a key it does not declare", and a track or adapter slot "silently does
  nothing".

## Consequences

- A config, a session spec, a share link or an agent's bag naming a key no
  display declares fails that track's load with `LinearAlignmentsDisplay
  takes …, not filterBye`, and the session's "Removed N tracks that could not
  be loaded" notice names it. Before, the track drew with the setting ignored.
- A 5.0 app refuses a key a later minor adds to a display. That is the
  trade: a loud refusal over a silently wrong picture, and the CLI validates a
  config against the version's own schema either way.
- A plugin's display registered without `closed: true` fails
  `createPluggableElements` with the option named. The in-tree test fixtures
  that built an ad-hoc display each gained the option.
- `ConfigurationSchemaUnion`'s requirement that a member be closed is now the
  same rule a display follows, stated once each.

## Rejected alternatives

- **Every `explicitlyTyped` schema closed by rule.** One rule for displays,
  tracks and adapters alike, and the one the CLI already applies; backed out
  because the adapter `uri` and loose-track shorthands are lifted by the
  pluggable union's snapshot processor, not the schema, so the schema refused
  its own shorthand. It returns when those lifts move into the schemas.
- **Drop an unknown key with a notice in production builds.** A notice nobody
  reads is the silence this ADR removes with one more code path.
- **`DisplayType` closing the schema it is handed.** A derived schema built
  before registration (the multi-quantitative track's wiggle variant) copies
  its base's options at construction, so a flag set later would miss it.
