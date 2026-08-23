# @jbrowse/plugin-arc

Main-thread SVG — no RPC worker, no GPU backend, no `RenderLifecycleMixin`.
`LinearArcDisplay` connects one feature's own start↔end;
`LinearPairedArcDisplay` connects two independent endpoints each with their own
refName.

## Chrome: `DisplayStatusChrome`, the backend-free half of DisplayChrome

With no GPU backend arc can't wrap `DisplayChrome`, so it renders the component
`DisplayChrome` delegates to. Assembled arc-locally by hand, container,
`data-*`, banners and progress chip drifted into arc being the only display with
no background-progress chip.

`displayPhase` stays on the **model** and is `DisplayStatusPhase` (the union
minus `renderError`, since arc has no backend to fail). Its loading term reads
`isLoadingOrCanceled`, never `isLoading` — `shared/displayPhase.test.ts`.

It is computed by `foundationDisplayStatusPhase`, the same mapping the two GPU
foundations use, so arc supplies only its staleness argument (`() => true`).
While arc hand-wrote that literal, a term added for the other two reached every
display except this one.

## Fetch and readiness

- **`reload()` must invalidate `dataCurrent`, not just bump the counter** —
  `runGlobalFetch` gates on it, so a bump alone refires into a no-op.
  `GlobalFetchMixin.reload()` drops `loadedFetchSignature` for the whole family.
  `features` deliberately survives, so stale arcs stay under the loading overlay
  instead of blanking.
- **Two readiness flags, don't conflate**: `svgReady` is the SVG-export terminal
  gate and goes false on a pan past a block boundary; `data-display-drawn` uses
  the looser `drawn`, which stays true across a refetch so the testid doesn't
  churn on pan.
- Byte-gated only, and the gate is inside the fetch: `ArcGetFeatures` measures
  the index before it downloads and answers a `RegionTooLargeResult` instead of
  features. Arc's opt-in is the `gateEnabled` override plus the `byteLimit` its
  `run` passes. It reads its own RPC rather than `CoreGetFeatures` for exactly
  that reason — that method has eight callers and none of the others gates.
