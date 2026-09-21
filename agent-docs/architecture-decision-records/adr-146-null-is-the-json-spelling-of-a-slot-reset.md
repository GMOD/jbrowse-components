---
status: Accepted
summary: "`setSlot` reads `null` as a reset to the slot's default, because JSON cannot spell `undefined` — so no slot stores `null` as a value, and a slot meaning \"unset\" is `maybeFrozen`"
---

# ADR-146: `null` is the JSON spelling of a slot reset

## Status

Accepted (2026-09).

## Context

Resetting a config slot means writing `undefined`: every slot model is
`types.optional(…)`, so `is(undefined)` is true on all of them and MST
reconciles the write back to the schema's default.

**JSON has no `undefined`.** The routes that carry a config as JSON — a session
spec, a share link, `jb.setSession`, an embedder's `configuration` option,
anything reaching `applyDisplaySettings` from parsed JSON — could set a slot and
then had no way to put it back. Writing the default value literally is not the
same thing: it pins the number, so a link keeps yesterday's default after the
schema moves.

`null` was the obvious spelling and did not work, in two different ways:

- on a typed slot, `is(null)` is false, so `setSlot` threw
  `"… is a number slot and cannot take null"`;
- on a `frozen` slot, `is(null)` is true, so it stored a literal `null`.

Ten slots in the tree leaned on the second — `frozen` with
`defaultValue: null` — and every one of them meant "unset": `densityAdapter`,
`summaryAdapter`, `annotationAdapter`, `sequenceAdapter` (twice), `ldAdapter`,
`sortedBy`, `showOutline`, and the GC-content and motif sidecars.

Meanwhile **a sub-schema beside them already took `null` as a clear**:
`mergedSubschemaValue` ends `return value ?? {}`, which is what `jb.help` means
by "null clears one". So a session spec could reset a channel and not a slot, in
the same document, with no rule a reader could state.

## Decision

**`setSlot` reads `null` as `undefined`, and no slot *declares* `null` as its
default.**

```ts
setSlot(slotName: string, rawValue: unknown) {
  const value = rawValue ?? undefined
```

The second half is what keeps the token from meaning two things at once: the ten
`frozen`/`defaultValue: null` slots are `maybeFrozen` now, whose default is
unset, so no slot's *declared* value is the token that means reset. Their
readers all tested truthiness or `??` already, so nothing downstream changed;
three assertions moved from `null` to `undefined`, and `showOutline`'s tri-state
(unset = auto, `true`/`false` = force) survives because it reads through `??`.

**A snapshot can still carry a literal `null` into a frozen-family slot**, and
this does not change that: `types.maybe(types.frozen())` accepts one, so
`create({ densityAdapter: null })` still stores `null` where
`create({})` leaves it unset. Both read as absent to every consumer of these ten
— that is what made the retype safe — and the merge path is the only one whose
spelling changed.

**Omitting the key is a different thing, and still means what it meant.**
`setSlot` is the *merge* path — a session spec naming three slots leaves the
rest alone — so absence cannot also mean reset. On the *snapshot* path
(`create`, `applySnapshot`) an omitted optional slot already goes to its
default, so that route never needed a token.

This follows JSON Merge Patch (RFC 7396), where `null` means "remove this
member", rather than inventing a house convention.

## Rejected

- **Adding `null` alongside the existing meaning**, so it resets a typed slot
  and stores on a `frozen` one. That is the version two reviews objected to, and
  the objection is right: `null`'s meaning would depend on the slot's type, so
  `"densityAdapter": null` could not be read without knowing the schema. Banning
  it as a stored value is what removes the ambiguity rather than adding one.
- **A `"$reset"` sentinel string.** Unambiguous, and it collides with every
  `string` slot that could legitimately hold it, which is all of them.
- **Reading an omitted key as a reset.** It would make the merge path unable to
  express "leave this alone", which is what almost every spec wants.
- **`scales.y.title: null` meaning no caption**, as in Vega-Lite and GenomeSpy.
  In a track-config delta `null` already resets a slot, so the same key would
  mean "derive" on one route and "none" on another: a per-slot exception to a
  rule that has none. `""` says no caption. Declined 2026-09-21.

## Consequences

- **A slot that means "unset" is `maybeFrozen`**, never `frozen` with
  `defaultValue: null`. `ConfigSlot` already refuses a `maybe*` slot with a
  concrete merged default, so the two rules do not fight.
- **Writing `null` is still allowed and still means what it meant** for the ten
  slots above: their default was `null` and is now unset, and both are falsy, so
  a config, spec or link that says `"densityAdapter": null` reads the same as
  before. What changed is which of the two a *merge* lands on.
- **`getSnapshot` of a reset slot no longer emits `null`**, so a slot reset
  through the merge path round-trips as absent rather than as a stored value.
- **A namespace's member resets the same way, at any depth.**
  `{ scales: { y: { domainMin: null } } }` reaches `mergedSubschemaValue` rather
  than `setSlot`, and that merge is RFC 7396's: a `null` member leaves the key
  out of the namespace's snapshot, which `stripDefault` reads as the default. It
  used to copy the `null` in, so `create` refused it and a session spec could
  pin an axis and not unpin it.
- **A track-config delta is the third route that reads `null` as a reset.** A
  non-admin's edits to an admin's track are stored as a merge patch over that
  config (`trackConfigDelta.ts`), so a slot the user puts back to its default,
  or a list the user empties, is a `null` there, and the merge removes the
  member so the schema's default applies — after a reload and in a share link,
  where an omitted member could only mean "leave it alone". The diff infers the
  `null` from a member one snapshot has and the other lacks, which is a reset
  only when both are post-`stripDefault`, so every caller diffs two snapshots in
  that form. Having no schema, the delta reads `null` this way at every depth,
  a frozen slot's object members included.
- **The create path reads a `null` member as unset too**, so a config file
  says what a session spec says. Every schema's snapshot preprocessing
  (`preProcessSnapshotWith`) turns a `null` member into `undefined`, which
  `create` reads as the default, in a typed slot and a sub-schema alike and at
  every depth, since each schema runs it over its own members. Before, a
  `null` in a `maybe*` slot — `{ scales: { y: { domainMin: null } } }` — failed
  MST validation and the session dropped the whole track. A frozen-family
  slot keeps what the Decision says of it: its type takes `null`, so the
  snapshot stores one. For `scales.y.title` this makes `null` mean
  "derive the caption", the opposite of Vega-Lite's and GenomeSpy's `title:
  null`; `""` is the spelling for no caption, and the slot doc says so.
- A frozen slot's *nested* nulls are untouched — the merge path reinterprets a
  slot's own value and a namespace's members, and recurses into nothing else. A
  caller that needs to store a bare `null` wraps it, or writes it as a snapshot.
- No config in the tree wrote a bare `null` slot value, and v5 carries no
  migrations, so nothing needed rewriting.
