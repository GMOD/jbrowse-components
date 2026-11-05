---
status: Accepted
summary: "A track-config delta stores a channel its schema marks `writes: 'whole'` (color, `rows`, `facet`) as a unit, so a user's pick replaces the base's object and a later admin member inside it no longer reaches that user. `diffTrackConfig` and `mergeTrackConfig` take a `wholeAt` test"
---

# ADR-236: A track edit stores a channel whole

## Status

Accepted (2026-10-20). Narrows the member-by-member merge that
[ADR-158](adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)
and the `trackConfigDelta.ts` header describe, for the objects
[ADR-215](adr-215-rows-and-color-write-whole-on-every-display.md) and
[ADR-232](adr-232-a-predicate-lives-where-what-it-selects-lives.md) rule 5
make channels. Asked whether a user's pick or a later admin edit should win
inside a channel, Colin called it a tension, noted that few users pick, and
leaned toward the user's choice.

## Context

Every live write path replaces a channel whole: `applyPlot`, `applyConfSettings`,
`mergeConfSettings` and the display's own setters. The session delta did not.
`diffTrackConfig` recursed into every plain object, so a pick of `strand` over a
base `color: { field: 'type', domain: [...] }` stored
`{ field: 'strand', domain: null }`. When the admin later added `color.range`
to the base, the merge laid the type palette's range under the user's strand
colors, the mixed object ADR-215 removed from the other paths. `rows`, `facet`,
`size` and `rowColor` had the same gap.

## Decision

- **`wholeAt(displayType, path)`** says whether a display writes the object at
  `path` whole. `writesWholeAt(schema, path)` in core answers it off the
  schema; product-core's `displayWholeAt(pluginManager)` looks the schema up by
  display type. `core/util` stays schema-free, taking the test as a parameter.
- **The diff stores a whole object entire** when it differs from the base's,
  and a single `null` when the edit drops it. **The merge replaces** the base's
  object with the delta's.
- **The changes list compares a whole object member by member**, so a member
  the pick dropped shows as reset rather than vanishing from the list.
- The session's `SessionTracks` mixin and the desktop web export
  (`HydratedForms.wholeAt`) pass the test. `localFileTracks` reads file
  locations only and passes none.

## Consequences

- After a pick, an admin fix inside that channel (a corrected palette) does not
  reach the user until they reset the track. A corrected adapter URL or any
  other slot still flows through.
- A beta session's member delta inside a channel now replaces the base's
  object; its `null` members drop on merge. No lift, per the beta-only-state
  precedent (ADR-204).
- Undo and Reset are unchanged, since a reset drops the delta.

## Rejected alternatives

- **Keep member merging and let admin additions flow into a pick.** The mixed
  object paints a palette for one field under another, which no write path
  produces today.
- **Pass the plugin manager into `core/util`.** The delta module would import
  the schema registry for one predicate.
