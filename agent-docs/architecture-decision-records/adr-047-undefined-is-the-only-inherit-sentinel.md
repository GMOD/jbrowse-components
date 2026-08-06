---
status: Accepted
summary: "A promotable slot's inherit sentinel is always `undefined` (a `maybe*` type + `promotedBase`) — never an in-band `'inherit'` enum member or a doubled-up `defaultValue`"
---

# ADR-047: `undefined` is the only inherit sentinel

## Status

Accepted (2026-07). Supersedes two earlier forms, both removed. Mechanism:
[DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md) §"The inherit
sentinel".

## Context

The cascade needs to distinguish "this track set a value" from "this track
follows the display type's default". Three ways to spell the second state were
tried.

## Decision

**Being unset is the sentinel, always.** A promotable slot declares
`promotedBase` for what unset resolves to, and `ConfigSlot` throws unless it is a
`maybe*` type (`maybeNumber` / `maybeBoolean` / `maybeColor` / `maybeStringEnum` /
`maybeFrozen`) leaving `defaultValue` undefined. `undefined` is CSS `inherit`;
`promotedBase` is CSS `initial`.

Declaring `promotedBase` is *also* what makes the slot promotable. That was a
separate `promotable: true` flag when this ADR was first written; see
[the mirror mistake](#the-mirror-mistake-is-also-rejected) below for why the flag
went and what its two throws were actually holding up.

There is one form and nothing to choose, which is why `isUsableValue`'s first
check is a bare `value !== undefined` and no `defaultValue` comparison survives
in the resolver.

### Rejected: a spare `'inherit'` member in the enumeration

Spelling the sentinel in-band put the mechanism into the slot's own vocabulary,
and it leaked everywhere the vocabulary went:

- `HEIGHT_MODE_VALUES` listed `'inherit'`, which is not a height mode.
- Every consumer needed a second `Exclude<…, 'inherit'>` type to subtract it
  back out.
- The config editor's dropdown offered "inherit" to the user as a literal
  choice.
- A raw `readConfObject` handed the string to a caller with no idea what it
  meant.

`maybeStringEnum` puts the nullability in the slot type instead: the author
writes the plain enumeration (`['fixed','grow','fit']`) and `ConfigSlot` wraps
it. No enumeration, menu, or dropdown ever shows the cascade's plumbing.

### Rejected: `defaultValue` doubles as the follows-the-default signal

A "plain" promotable form once allowed this. It makes the setting
**one-directional**: writing the default value *is* the follow signal, so a track
cannot hold `displayMode: 'normal'` under a promoted `compact`, or
`linkedReads: 'off'` under a promoted `normal`. A promoted non-default becomes
un-turn-off-able on an individual track — the user can only agree with it.

Spending *only* the unset state on the sentinel is what leaves every real value,
`promotedBase` included, customizable per-track. No slot ever used the plain
form, so it was removed rather than kept as an option.

### The mirror mistake is also rejected — and then made unstatable

`ConfigSlot` used to throw on `promotedBase` without `promotable`, and on
`promotable` without `promotedBase`. Both combinations were real: one built a slot
the resolver refuses on every read ("not promotable") while the resolved read type
still dropped the sentinel, so it type-checked and threw at runtime; the other
built a promotable slot with no bottom to its cascade.

**Superseded (2026-08): the `promotable` flag is gone, and both throws with it.**
Declaring `promotedBase` is the one marker, so neither state can be written.
What settles it is the last bullet under Consequences, which was already true
when this ADR was written: the *type* layer keys on `promotedBase` and cannot see
a boolean that arrives through the runtime definition merge. So the two fields
were never equally authoritative — the flag was the redundant one, and its only
job was to be reconciled with the field that actually decided.

A subclass now turns an inherited promotable slot off with
`promotedBase: undefined`. That works because `mergeSchemaDefinition` is a
spread: a stated `undefined` overwrites the base's value where an omitted key
inherits it. It needs one thing at the type level — `SlotValueResolvedFromDef`
must match `{ promotedBase: undefined }` *before* `{ promotedBase: unknown }`,
which the latter also satisfies. Canary: `configTypeNarrowing.test.ts`, checked
by `pnpm typecheck` rather than jest.

## Consequences

- The resolver has exactly one path, and object-valued slots (`maybeFrozen`, e.g.
  alignments `colorBy`) work with nothing extra — comparisons against a promoted
  value use `deepEqual`, since a fresh MST-reconstructed value is never `===` its
  stored twin.
- `SlotValueResolvedFromDef` keys on `promotedBase` — the field that survives a
  real override at the *type* level, since the type reads the subclass's literal
  definition and the definition merge is runtime-only. This is what eventually
  removed the `promotable` flag outright, above.
- Adding a promotable slot to an enum-valued setting costs no enum member. If a
  future slot type seems to need an in-band sentinel, it needs a `maybe*` wrapper
  instead.
