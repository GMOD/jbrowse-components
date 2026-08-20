---
status: Accepted
summary: "A display installs one of three rendering lifecycles; nothing outside render-core calls attachRenderingBackend, and the setup thunk is what makes the once-only semantics structural"
---

# ADR-079: A display installs a lifecycle, it does not wire one

## Status

Accepted. Enforced by `no-restricted-syntax` (`noHandRolledAttach` in
`eslint.config.mjs`), which carves out only the three installers.

## Context

`RenderLifecycleMixin.attachRenderingBackend(backend, callbacks)` installs the
upload and render autoruns, and **keeps the callbacks from its first call** —
`startRenderingBackend` fires again on every context-loss recovery, and
reinstalling the pair would double every upload. That is correct and it is not
guessable, so anything the callbacks close over has to outlive the call that
made it. The upload diffs all do: each holds what it last sent, and one rebuilt
per recovery would re-upload the whole display's buffers.

Eight displays called the primitive directly and each restated that rule from
memory. Three helper docstrings said "create it in `startRenderingBackend`
*outside* the `attachRenderingBackend` call" in three different wordings; the
callers that got it right allocated a diff on every recovery and dropped it,
which is invisible because the first call's copy is still doing the work.
[ADR-078](adr-078-one-upload-autorun-and-a-diff.md) then reduced the per-region
and whole-map-computed cases to the same diff, which left the eight hand-rolls
spelling out three distinguishable shapes.

## Decision

**Three installers, and no display calls `attachRenderingBackend`.**

| shape | installer | what it diffs |
| --- | --- | --- |
| per-region streamed, and any whole-map computed of per-region payloads | `installPerRegionLifecycle` | each region's encoded payload, plus a declared `inputs` |
| one canvas shared by sibling displays | `installKeyedLifecycle` | each display's keyed geometry, retiring a departed key individually |
| one whole-view payload, with or without independent slots | `installGlobalLifecycle` | each named slot's input |

**`attachRenderingBackend` takes a setup thunk**, run once on the first attach.
The state an installer needs is allocated inside it, so its lifetime *is* the
callbacks' lifetime rather than a rule to remember. A second call swaps the
backend and does not run the thunk.

`createRegionUploadSync`, `createKeyedUploadSync` and `createGlobalUploadSync`
leave render-core's `exports` map. They are what the installers are made of, not
what a display reaches for; `sharedBackendKey` moves beside
`installKeyedLifecycle`, which is the only place it is used from.

## Consequences

- **A display's rendering wiring is one call**, and the four upload patterns in
  `reference/GPU_RENDERING.md` say which installer they take. Adding a display
  no longer requires deciding between four helpers and a primitive.
- **The "build the closure outside the call" rule is gone**, not restated. There
  is nowhere left to build it wrongly, and the three docstrings that carried the
  warning drop it.
- **A display that fits none of the three wants a fourth installer**, in
  render-core, where the once-only semantics are already handled. The lint rule
  says so at the point someone would otherwise hand-roll.
- **The public surface shrank by one concept**: three installers instead of
  three syncs plus a primitive plus a per-region installer.
- The mixin's own test now pins that the thunk runs once across a backend swap,
  which is the property every installer depends on and nothing checked before.
- `attachRenderingBackend` stays a `#action` on the mixin rather than becoming
  module-private: a display's own model has to be able to reach it for the
  installer to call it through `self`, and MST has no visibility modifier that
  would express "render-core only". The lint rule is that expression.

## Rejected alternatives

**Leave the primitive public and only add the thunk.** That fixes the wasted
allocation and leaves eight displays each restating a rule the type system does
not carry — which is where this started.

**One installer taking a discriminated union (`{kind: 'keyed', …}`).** One entry
point, at the cost of a tag every caller writes and a backend type the mixin can
only see as `any`. Three named functions keep each display's backend type exact
through the call, which is what catches an `uploadGeometry`/`uploadRegion` mixup
at compile time.

**Merge the keyed and per-region diffs behind one helper with a prune
strategy.** They differ by three lines and one real semantic: an active-set
prune computed from one display's view of a *shared* canvas would wipe its
siblings' buffers. The installers make that difference a choice of function
name, which is where it should be visible.
