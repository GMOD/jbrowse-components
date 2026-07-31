---
status: Accepted
summary: "Promotable-slot resolution is named at the call site (`resolveConf`); `getConf` never cascades"
---

# ADR-046: `resolveConf` names the cascade; `getConf` stays `readConfObject`

## Status

Accepted (2026-07). Re-made after implementing the opposite and reverting it.
Mechanism: [DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md).

## Context

A `promotable` config slot resolves through a three-tier read-time cascade
(track's own value → session-wide default for the display type → the slot's
`promotedBase`). Something has to walk it.

The tempting answer is `getConf`: it is what every display already calls, so
cascading inside it means no call site changes, no new import, and no way to
forget. The alternative is a separately named reader used only where a
promotable slot is read.

Measured today: **16 `resolveConf` call sites across 7 files**, against **374
`getConf` call sites** in non-test source. 46 slot declarations say
`promotable: true`.

## Decision

**`getConf(model, path)` is exactly `readConfObject(model.configuration, path)`
and nothing else.** `resolveConf(self, slot)` is the cascading reader, called at
the ~16 display getters that own a promotable slot.

### Why not fold it into `getConf`

It was built that way first (`51eaa3f81d`), then reverted (`f3ccacb4fa`). Four
costs, the last decisive:

- **Cost paid by every reader to serve 4% of them.** Auto-detection needs a
  `getType` on every `getConf` call to ask whether the slot is promotable —
  ≈60% overhead over a bare `readConfObject`, measured, on a function the
  invariants list as a hot-path traversal.
- **Resolution became invisible.** Nothing at the call site distinguished a read
  that consults the session from one that doesn't.
- **Inconsistent failure.** `getConf` began throwing on a detached node for some
  slots and not others, depending on whether the slot happened to be promotable.
- **It broke the one thing every reader already knew about `getConf`.** Flipping
  `promotable: true` on a slot silently changed the meaning of every existing
  read of it, repo-wide, with no diff at any call site.

### The forgotten-resolution failure mode is caught by types, not by magic

The reason to want auto-detection is fear of someone reading a promotable slot
rawly and getting the sentinel. That is a **compile error** instead: a promotable
slot is always a `maybe*` type, so raw `getConf` yields `T | undefined` while
`resolveConf` yields `T`. Hand the raw one to a consumer expecting a real value
and tsc points at the call.

Do **not** paper over that error with `?? someDefault` — it silences the check
and bypasses the cascade, which is the actual bug the type was catching.

## Consequences

- Adding a promotable slot means updating its getter to `resolveConf`. That is
  the intended cost; it is one line, and the type system demands it.
- `getConf` keeps its single constrained signature and stays the stricter reader
  (see `packages/core/src/configuration/CLAUDE.md`, "`getConf` vs
  `readConfObject`").
- Reading a promotable slot through `readConfObject` — which has a loose `any`
  overload and so raises no type error — bypasses the cascade silently. That is
  the one hole this design leaves open; the serialization-boundary helpers
  (ADR in [DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md)
  §"Serialization boundaries") exist because of it.
- Don't retry the fold. It is cheap to implement and the costs above only show
  up under measurement and at unrelated call sites.
