# Architecture Review — Post-Mixin-Wrapper Pass

After moving canvasDrawn + lifecycle wiring into `GpuBackendLifecycleSlotMixin`
and composing it inside `MultiRegionDisplayMixin`, the model side is clean. This
review surveys what's still load-bearing, what's still ceremonial, and where we
can keep tightening.

Ordered by impact × ease.

---

## 1. Collapse the React-component lifecycle ceremony into one hook

Every GPU display's component repeats this five-line block:

```ts
const canvasRef = useRef<HTMLCanvasElement>(null)
const { error, retry } = useGpuRenderer(canvasRef, RendererFactory, {
  onReady: backend => model.startGpuBackendLifecycle(backend),
  onDispose: () => model.stopGpuBackendLifecycle(),
})
useTabVisibilityRerender(() => model.renderNow())
```

Replace with one hook:

```ts
const { canvasRef, error, retry } = useGpuModelLifecycle(RendererFactory, model)
```

Internal: composes `useRef`, `useGpuRenderer`, `useTabVisibilityRerender`, and
the three model actions. The `model` argument is duck-typed to
`{ startGpuBackendLifecycle, stopGpuBackendLifecycle, renderNow }` — exactly the
slot mixin's contract.

Eliminates ~5 lines × 10 components = ~50 lines and removes the second place
plugins repeat the same wiring. Only argument that varies between components is
the renderer factory.

**Cost:** one new hook file. **Risk:** very low. **Win:** removes the last
per-plugin lifecycle ceremony.

## 2. Move tab visibility into the HAL

`useTabVisibilityRerender` exists because WebGPU can drop the swap-chain when
the tab is hidden, requiring a re-paint on restore. Today every GPU component
pays for one React hook + one model action just to wire this.

Better: the HAL itself listens to `document.visibilitychange` and calls the
active backend's `renderNow` (or its lower-level equivalent) on restore. The
model never sees this concern; the React component never sees it. Removes the
`renderNow` mixin action from the public surface once nothing else calls it (DOM
scroll handlers don't either, today).

**Tracked:** NEXT_STEPS.md Tier 4.10 already calls this out. **Cost:** one HAL
change + delete the React hook + delete `renderNow` from the mixin once unused.
**Risk:** low — the swap-chain restore behavior is HAL-internal anyway. **Win:**
subtract React from a non-React concern.

## 3. Unify `GpuBackendAutorunLifecycleHandle` and

`GpuSingleDataBackendAutorunLifecycleHandle`

Both are `{ dispose(): void; renderNow(): void }`. Two interface names for one
shape. Currently the slot mixin types its handle as a union of both; collapse to
a single `GpuBackendLifecycleHandle` and re-export from each util.

**Cost:** trivial (one type alias). **Risk:** none.

## 4. Make upload-only / render-only modes first-class

Dotplot and synteny refactors will introduce empty-stream + empty-render
patterns:

- Display side: `getRenderState: () => undefined`, `getRenderBlocks: () => []`,
  `renderAllBlocks: () => {}`
- View side: `uploadSlots: []`

Both feel like noise. Two cleaner options:

- **Option A:** `startMultiRegionGpuUploadLifecycle({ backend, uploadStreams })`
  and `startMultiRegionGpuRenderLifecycle({ backend, getRenderState, ... })` —
  split the multi-region util into upload-only and render-only variants. The
  current full util becomes a composite for the common case.
- **Option B:** Make `getRenderState` / `renderAllBlocks` / `uploadSlots` truly
  optional in their respective utils — when omitted, that half is a no-op.
  Simpler API, slightly more dynamic internals.

Option B is less surface area. Recommended.

**Cost:** one util change. **Risk:** low (additive). **Win:** the
view-owned-canvas pattern is expressible without dummy callbacks.

## 5. Remove the single-stream sugar from

`startGpuBackendAutorunLifecycle`

The util accepts both `uploadStreams: [{...}]` and top-level
`getDataByRegionNumber` / `uploadOneRegion` / `pruneRegionsNotIn` / `identityOf`
/ `getUploadInvalidationToken` as a single-stream sugar.

The two paths are visible in the util's normalization block. Removing the sugar
means every plugin wraps its single stream in `uploadStreams: [{ ... }]` — adds
two tokens of plugin code for the common case but eliminates ~30 lines of util
branching.

Unclear if worth it. Leave as-is unless we touch the util for another reason.

## 6. Lock down the upload-identity contract

`MultiRegionDisplayMixin.setLoadedRegionForRegion` documents:

> per-region value objects must be freshly constructed when updated — never
> mutated in place — since the autorun's identity diff depends on reference
> inequality.

Today this is convention. A subtle bug — mutating `data.foo = bar` in a
per-region value — would manifest as "uploads stop firing for that region" and
be hard to track down.

Two options to harden:

- **Dev-mode runtime check:** the util keeps a `WeakSet` of seen data
  references; in dev mode, after each upload, freeze the data with
  `Object.freeze` (shallow). Mutating a frozen object throws loudly.
- **Brand types:** `RegionData & { __frozen: true }` as the upload payload type,
  with a single `freezeRegionData()` helper as the only way to produce one.
  Compile-time enforcement.

The branding option is friction-heavy for a contract that seasoned contributors
absorb after one bug. The dev-mode freeze is cheap and localized — recommended
if anyone ever stumbles on this contract.

## 7. Picking as a separate mixin

Synteny has `pick(x, y)`. Alignments has hit-testing via Flatbush on the main
thread. Canvas-based displays will likely add picking. Today each plugin
reimplements the wiring.

Define `PickableBackendMixin` (or `Pickable<HitT>` interface) with one method
`pick(x, y): Hit | undefined`. Backends that support picking implement it; the
slot mixin's volatile gains a typed `pickableBackend` ref. React components
install one mouse handler; the mixin maps coords to canvas-relative and calls
the backend's pick.

**Cost:** one mixin + small per-plugin migration. **Risk:** medium — synteny
picks via async callback for WebGPU, sync return for Canvas2D; need a single
shape that absorbs both. Async-only via Promise is the clean choice.

**Tracked:** NEXT_STEPS.md Tier 2.4. Worth doing alongside the synteny refactor.

## 8. Backend conformance test suite

NEXT_STEPS.md Tier 2.3 already lists this. Single `describe.each(ALL_BACKENDS)`
running:

- `dispose()` releases buffers (count via MockHal)
- Same-reference upload is a no-op
- `pruneRegions` / `deleteGeometry` removes absent keys
- Render before upload is a safe no-op
- Context-loss reinit produces equivalent output

Critical for preventing per-backend drift as backends multiply. Recommended to
land before dotplot/synteny ship to catch regressions introduced by the
geometry-keyed extension.

## 9. `renderProps()` is dead weight

Most GPU displays still expose `renderProps()` returning
`{ ...getParentRenderProps(self), config, rpcDriverName }`. This dates to the
server-side rendering era; the new GPU lifecycle doesn't read it. Some view code
(track menu, RPC-still-alive paths) may still consult it; verify and delete.

**Cost:** small grep-and-delete pass. **Risk:** low if grep is thorough.

## 10. `regionNumber` rename

NEXT_STEPS.md Tier 3.6. ~550 sites across 73 files. Mechanical, but high churn.
Should land **last** so other migrations don't churn it mid-flight. The
dotplot/synteny migrations should NOT do the rename incidentally.

Decision: rename to `displayedRegionIndex` once nothing else is moving.

## 11. `dataVersion` debug counter cleanup

`MultiRegionDisplayMixin` still bumps `dataVersion` in
`setLoadedRegionForRegion`. The util doesn't observe it; nothing reads it in
production. It exists for debug logs. Either:

- Keep, document as debug-only.
- Delete and rely on autorun fire counts in browser devtools.

Inclination: delete, with a `// removed dataVersion` paragraph in the migration
doc so future debuggers know the lookup point.

## 12. Document the model⇄React contract

NEW_ARCHITECTURE.md describes the current contract in prose. A one-screen "what
the model owns vs what React owns" table — preferably with the GPU display as
one column and a hypothetical Canvas2D-only display as the other — would shorten
ramp time for new contributors. Low value if contributor inflow is low; high
value once the codebase ships.

---

## Anti-list (proposals I considered and rejected)

- **Compose `GpuBackendLifecycleSlotMixin` into `BaseDisplay`.** Tempting
  symmetry — every display gets the slot. But many displays don't GPU-render at
  all (the existing non-block / Canvas2D paths). Coupling the base type to a GPU
  concern is wrong.
- **Move `MultiRegionDisplayMixin.fullyDrawn` into the slot mixin.** It combines
  `canvasDrawn` (slot mixin) and `isLoading` (region fetch). Belongs to the
  consumer, not to either component. Leave in `MultiRegionDisplayMixin`.
- **Replace `markCanvasDrawn` with a MobX `computed` derived from data/state.**
  Tempting purity. But the canvas-drawn signal is fundamentally about a
  side-effect (a render call has actually run); it can't be derived from
  observed state alone.
- **Make `startMultiRegionGpuLifecycle` return the handle.** Currently the
  wrapper assigns the handle to the slot internally and returns void. Returning
  the handle would invite plugins to manage it, which is precisely what we just
  stopped them from doing. Keep it void.

---

## Suggested ordering

1. **#3** (handle type unification) — 5 minutes, no risk, do now.
2. **#1** (`useGpuModelLifecycle`) — 1 hour, removes ceremony, do before
   dotplot/synteny work so those refactors don't re-introduce the old shape.
3. **#4** (optional `getRenderState` / `uploadSlots`) — 30 minutes, unblocks
   dotplot/synteny without dummy callbacks.
4. Dotplot refactor + synteny refactor land. Use `#1`, `#3`, `#4` from the
   start.
5. **#7** (PickableBackendMixin) alongside synteny.
6. **#8** (backend conformance suite) before dotplot/synteny ship.
7. **#2** (HAL-owned tab visibility) post-synteny.
8. **#10** (regionNumber rename) last.
9. **#9, #11, #12, #6** as opportunistic cleanups.

`#5` (sugar removal) and `#6` (frozen contract) are low-value alone; defer until
touching adjacent code.
