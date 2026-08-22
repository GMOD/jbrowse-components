---
name: desktop-autosave-cadence
description: Desktop's 1s autosave is an `autorun` throttle, so it fires for as long as anything keeps changing — panning included — and the data-loss window it was sized against is much smaller now that four paths flush explicitly. Scaling the interval with the serialized size is the version worth proposing, and it is a call about someone's unsaved work.
---

# Desktop's autosave cadence

Moved out of [TODO.md](../TODO.md) on 2026-08-22. It was never an action item:
its own last sentence said it is a judgment call about someone's unsaved work
rather than an optimization, which is the definition of a parked proposal here.

## The mechanism

`autorun`'s `delay` is a **throttle rather than a debounce**, so the 1s autosave
fires for as long as anything keeps changing. A pan is a stream of changes, so a
pan is a stream of session writes — each one serializing the whole session.

## Why the number is looser than it was

The data-loss window that 1s was chosen against is much smaller now.
`closeGuard` flushes on window close, and Exit, return-to-start-screen and
session-swap all flush too. So the cadence is no longer the only thing standing
between a user and losing work; it is the backstop for a crash or a kill.

## The proposal

An interval that **scales with the serialized size**, so a large session stops
paying a small one's cadence. A session with hundreds of tracks and a dozen views
is the one where a per-second full serialize actually costs something, and it is
also the one where losing the last few seconds matters most — which is the
tension, and why the answer is not obviously "slower when big".

Anyone taking this owes a position on what the acceptable loss window is, not
just a curve. That is the part that is a product call.
