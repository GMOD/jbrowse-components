---
name: extracting-the-gpu-context-loss-recovery-machine-out-of-userenderingbackend
description: Extracting the GPU context-loss recovery machine out of `useRenderingBackend` into a pure reducer
area: tooling-tests-and-docs
---

# Extracting the GPU context-loss recovery machine out of `useRenderingBackend` into a pure reducer

proposed 2026-08-18 off this repo's own
decision/wiring doctrine, then declined the same day when each of its three
supports failed to measure. The shape invites it: `useRenderingBackend` spreads
one policy — a 400ms grace window racing `webglcontextrestored`, a
`1000 × 2^(attempt-1)` backoff, one windowed budget shared across both loss
families, a latched give-up — over six refs and six effects, with
`planRegionFetch` and `computeDisplayPhase` sitting next door as precedent.

The cost argument was a stale comment. Its test file said jest fake timers
"block React's passive-effect flush, so the recovery effect never fires under
them", and 12.4s of the file's 13.64s was `await wait(...)`. Advancing inside
`act` flushes it fine: 1.43s, same assertions. Modern fake timers also fake
`performance.now()`, so `RecoveryBudget`'s 60s window — offered as the property
only an extraction could reach — is now an ordinary test in that file.

**The design argument was backwards, and this is the half to check first on a
re-proposal**, because it does not surface until the reducer is half written.
The no-dep effect polling `model.renderError` is not the hook failing to know
where an error came from: `RenderLifecycleMixin`'s upload and render autoruns
and `installPerRegionLifecycle` all call `setRenderError` from outside React,
so the hook has no event for those and can only observe the field. A reducer
still needs that poll feeding it, and `contextLostRef` is the deliberate
scoping flag for the errors the hook did not cause.

What is left is a readability claim, and ARCHITECTURE.md states the split's
purpose as testability — "the split is what either half can be tested
against". Both halves are testable in place.

Sabotage did find two real holes once the file ran in seconds rather than
fourteen, which is the transferable part: a slow file is where sabotage checks
stop happening. The cap test's waits (1400/2400/2400) exactly covered backoffs
of 1000/2000, so deleting `RecoveryBudget`'s give-up branch left it green, and
the grace window read 0 with all 18 tests passing. Both are pinned now.
