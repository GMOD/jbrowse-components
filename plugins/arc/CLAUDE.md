# @jbrowse/plugin-arc

Main-thread SVG — no RPC worker, no GPU backend, no `RenderLifecycleMixin`.
`LinearArcDisplay` connects one feature's own start↔end;
`LinearPairedArcDisplay` connects two independent endpoints each with their own
refName.

## Chrome: renders `DisplayStatusChrome`, the backend-free half of DisplayChrome

With no GPU backend arc can't wrap `DisplayChrome` (that owns
`useRenderingBackend`), so it renders the component `DisplayChrome` itself
delegates to, passing `phase` and `drawn`. Container, the `data-*` attributes,
`data-display-phase`, banners and progress chip all come from that one file.
Don't reintroduce arc-local loading/error components or an arc-local container —
arc used to assemble them by hand and drifted into being the only display with
no background-progress chip.

`displayPhase` stays on the **model** (a component-side derivation is free to
disagree with what the model believes) and is `DisplayStatusPhase`, the union
minus `renderError`: arc has no backend to fail, and the type says so rather
than a comment. Its loading term must read `isLoadingOrCanceled`, never
`isLoading` — see `shared/displayPhase.test.ts` for the hole that leaves.

It is computed by `foundationDisplayStatusPhase`, the same mapping the two GPU
foundations use, so arc supplies only its staleness argument (`() => true` —
stale arcs stay under the overlay through a refetch). Arc hand-wrote that object
literal until it was the last foundation doing so, which meant a term added to
`computeLoadingTerm` for the other two reached every display except this one.
Don't inline it back.

## `reload()` must invalidate `dataCurrent`, not just bump the counter

`GlobalFetchMixin.reload()` bumping `reloadCounter` is enough for LD/HiC, but
arc's `shouldFetch` reads `dataCurrent`, so a bump alone refires into a no-op.
`ArcFetchModel` also drops `loadedRegionSignature`. `features` deliberately
survives so stale arcs stay under the loading overlay instead of blanking.

## Two readiness flags, don't conflate

`svgReady` is the SVG-export terminal gate and goes false on a pan past a block
boundary, so an export fired mid-refetch waits for fresh arcs. The
`arc-display`'s `data-display-drawn` uses the looser `drawn`, which stays true
across a refetch so the testid doesn't churn on pan.

Byte-gated only, called directly (`byteGateBlocksFetch`) because arc fetches
through `GlobalFetchMixin` rather than `fetchRegions`.
