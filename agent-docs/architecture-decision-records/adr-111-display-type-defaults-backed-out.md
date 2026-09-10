---
status: Accepted
summary: "Display-type defaults are backed out whole — the read-time cascade, the session store, the serialization bakes and the pin; config is per track again"
---

# ADR-111: display-type defaults are backed out

## Status

Accepted (2026-09). Supersedes ADR-046, ADR-047, ADR-048 and ADR-063, which
record decisions inside a subsystem that no longer exists.

## What the feature was

A `promotable` config slot declared a `promotedBase` and took a `maybe*` type,
so being unset was an inherit sentinel. Reading one ran a three-tier cascade at
read time — the track's own value, else a session-wide default for that display
type, else `promotedBase` — spelled `resolveConf(self, slot)` rather than
`getConf`. The session-wide tier lived in `preferencesOverrides` under a flat
composite key and persisted to localStorage. A user set one from a pin on a
track-menu row: one click applied the row's value to every open track of the
display type, and the snackbar it raised offered to keep that value as the
default for tracks opened later.

Because the middle tier stayed in the sender's browser, every serialization
boundary had to flatten the cascade first: the worker payload, the About
dialog's "Copy config", and the share/export snapshot each had a bake. A
Preferences tab listed the promoted defaults, and the track-selector badge grew
a second reason and a second reset.

## Why it went

**The one control had two jobs and could only draw one of them.** A pin is a
state indicator — filled means "this is the default" — and the same click is a
bulk config edit across every open track. Nothing in a pushpin says which of the
two a click performs, and the two answers move independently: a track can show a
value it does not hold, and hold a value the pin draws as not-default.

Four reversals in ten weeks tried to make that learnable — apply-then-offer,
per-value pins over shared slots, toggle pins on checkbox rows, a Preferences
inventory to find defaults again — and none of them landed. Each fixed the
report it was written for and left the control saying the same ambiguous thing.

Everything else was carried for that control. The cascade's read-time
indirection, its bakes at three serialization boundaries, and a
localStorage-backed preference keyed by display type are all machinery whose
only user-visible purpose was the pin. Backing the control out with the
machinery in place would have left a subsystem nothing reaches.

## What replaces it

Nothing. A config slot has a `defaultValue` and a track has its own value.
`getConf` is the only reader, `setConf` the only writer, and `undefined` written
to a slot resets it to the schema default.

The bulk-edit half was the useful half, and if it returns it should return as
what it actually is: a multi-select in the track selector with an "apply to
selected tracks" action. That writes each track's own config, needs no cascade,
no session store and no bake, and draws no state it cannot explain.

The `maybe*` slot types stay — five non-promotable slots use `undefined` for a
genuine "decide from the data" state — as does `trackConfigDelta` and the
track-selector "Edited" badge for per-track edits.
