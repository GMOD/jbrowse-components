---
status: Superseded
summary: "GPU canvas stays mounted across error/retry — superseded by the DisplayChrome unification"
---

# ADR-025: GPU canvas stays mounted across error/retry — the invariant is mount-lifetime, not canvas-XOR-error

## Status

Superseded by the DisplayChrome unification (see "Update" below).

## Context

`useRenderingBackend` (`packages/render-core/src/useRenderingBackend.ts`; the old
`packages/core/src/util/useRenderingBackend.ts` is now a re-export shim) is the
shared hook every GPU display component uses. It returns a plain tuple
`{ canvas, canvasRef, error, retry }` and wires the canvas element into the
display model's `RenderLifecycleMixin` (`startRenderingBackend` /
`stopRenderingBackend` / `renderNow`).

A proposed "correctness by construction" refactor would change the return to a
discriminated union where `canvasRef` only exists in a non-error variant, so
that "obtain the canvas, ignore the error" becomes a compile error.

A survey of all 13 call sites does not support that shape:

- **Every site already handles `error`.** There is no current "ignored error"
  bug. Sites that replace the canvas with a message on error:
  `LinearManhattanDisplayComponent.tsx`, `LinearMafDisplayComponent.tsx`,
  hic `ReactComponent.tsx`, wiggle `WiggleComponent.tsx` /
  `MultiWiggleComponent.tsx`, canvas `FeatureComponent.tsx`, variants
  `LDDisplayComponent.tsx` / `VariantComponent.tsx` / `VariantMatrixComponent.tsx`.
  Sites that render error as an **overlay while keeping the canvas mounted**:
  synteny `LevelSyntenyCanvas.tsx`, dotplot `DotplotView.tsx`. Alignments
  handles `gpuError` in `PileupComponent.tsx` *after* its hooks (required by
  rules-of-hooks).

- **`error` and a mounted canvas are not mutually exclusive.** synteny and
  dotplot deliberately keep `<canvas>` mounted and show the error as a sibling
  overlay. A `canvasRef`-XOR-`error` union cannot express that state.

- **The real footgun is unmounting the canvas while its GPU context is live.**
  The WebGPU/WebGL context binds to a specific `<canvas>` DOM node at `init()`.
  Conditionally unmounting that node (e.g. swapping in a "too large" message)
  leaves the renderer drawing into a detached canvas. This is currently
  documented only as prose in `VariantMatrixComponent.tsx`, which uses
  `visibility:'hidden'` instead of unmounting for the `regionTooLarge` state.

So the union would encode a false invariant (canvas XOR error) that three sites
violate, forcing them to either drop the canvas on error (risking the
detached-context bug) or opt out of the safe hook (safety theater).

## Decision

Keep `useRenderingBackend` returning the plain tuple. Do **not** adopt a
`canvasRef`-XOR-`error` discriminated union.

The invariant worth enforcing is **mount-lifetime**, not error-handling:

- A GPU display's `<canvas>` must stay mounted for as long as its backend
  context is live. Terminal-but-recoverable states (`error`, `regionTooLarge`)
  are surfaced as **overlays or `visibility:hidden`**, not by unmounting the
  canvas — unless the transition goes through a full
  `stopRenderingBackend` → `startRenderingBackend` dispose/re-init cycle (which
  the message-replacement sites do, because `retry()` re-runs the factory from
  scratch).

If we later want to enforce this structurally, the correct shape is a hook that
**owns a stable canvas container** so consumer JSX cannot conditionally unmount
the `<canvas>`, with error/too-large/loading layered as overlays. That removes a
real dimension (consumers controlling the canvas mount lifecycle) rather than
adding a union that fights three call sites.

## Consequences

- The prose invariant in `VariantMatrixComponent.tsx` now has a referenced home.
- The two patterns coexist intentionally: **replace-on-error** (full re-init via
  `retry()`) and **overlay-on-error** (canvas stays mounted). Neither is wrong;
  the choice is per-display and should match neighbours.
- A future stable-container hook is the sanctioned path if structural
  enforcement is wanted; the discriminated-union approach is explicitly rejected.

## Update — DisplayChrome owns the canvas lifecycle (supersedes the above)

The "future stable-container hook" this ADR gestured at now exists: **every GPU
display renders its canvas inside `DisplayChrome`** (`plugins/linear-genome-view`),
which owns `useRenderingBackend` and the three terminal states (render error,
region-too-large, fetch-error + loading), handing `canvasRef`/`canvas` to its
body via a render prop. There is no `renderError` prop to forget and no way to
call the backend hook somewhere the chrome can't see — adoption is structural.

In the process we re-examined the "canvas must stay mounted" constraint that
motivated `visibility:'hidden'` in the variant displays. It turned out to be an
artifact of an earlier era when canvas remount-on-context-loss was flaky. The
ADR itself never required mount-lifetime — it explicitly blessed unmounting **so
long as the transition runs a full `stopRenderingBackend` → `startRenderingBackend`
dispose/re-init cycle**. DisplayChrome's terminal-state early-return does exactly
that: unmounting the body fires `canvasRef(null)` → effect cleanup →
`backend.dispose()` + `stopRenderingBackend()`; recovery remounts and re-inits via
the callback ref. The detached-context bug only occurs when you unmount **without**
disposing, which DisplayChrome never does.

So the variant displays dropped the `visibility:'hidden'` special-casing and now
use the same replace-on-error path as every other GPU display. `CanvasDisplayWrapper`
(the parallel legacy chrome) and the variant-specific `VariantStatusOverlays` were
deleted. The one remaining lower-level `useRenderingBackend` consumers are the
**non-LGV view types** (dotplot, synteny) that legitimately have no LGV chrome
model — they keep the primitive.
