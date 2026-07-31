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

**Being unset is the sentinel, always.** `ConfigSlot` throws unless a
`promotable` slot is a `maybe*` type (`maybeNumber` / `maybeBoolean` /
`maybeColor` / `maybeStringEnum` / `maybeFrozen`), leaves `defaultValue`
undefined, and declares `promotedBase` for what unset resolves to. `undefined`
is CSS `inherit`; `promotedBase` is CSS `initial`.

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

### The mirror mistake is also rejected

`ConfigSlot` throws on `promotedBase` without `promotable`. That combination
builds a slot the resolver refuses on every read ("not promotable") while the
resolved read type still drops the sentinel — it type-checks and throws at
runtime.

Only an *unstated* `promotable` is the mistake. An explicit `promotable: false`
is how a subclass turns an inherited promotable slot off, and the definition
merge hands `ConfigSlot` the base's `promotedBase` alongside it.

## Consequences

- The resolver has exactly one path, and object-valued slots (`maybeFrozen`, e.g.
  alignments `colorBy`) work with nothing extra — comparisons against a promoted
  value use `deepEqual`, since a fresh MST-reconstructed value is never `===` its
  stored twin.
- `SlotValueResolvedFromDef` keys on `promotedBase`, not `promotable` — it is the
  one of the two that survives a real override at the *type* level, since the type
  reads the subclass's literal definition and the definition merge is runtime-only.
- Adding a promotable slot to an enum-valued setting costs no enum member. If a
  future slot type seems to need an in-band sentinel, it needs a `maybe*` wrapper
  instead.
