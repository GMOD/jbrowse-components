# @jbrowse/plugin-arc

Main-thread SVG — no RPC worker, no GPU backend, no `RenderLifecycleMixin`.
`LinearArcDisplay` connects one feature's own start↔end;
`LinearPairedArcDisplay` connects two independent endpoints each with their own
refName.

## Chrome: shares the DisplayChrome _concept_, not the component

With no GPU backend arc can't wrap `DisplayChrome`, but it must not re-encode
the terminal-state precedence by hand. `displayPhase` comes from the shared
`computeDisplayPhase` and lives on the **model**, like every GPU display's — a
component-side derivation is free to drift from what the model believes. Don't
reintroduce arc-local loading/error components.

## `reload()` must invalidate `dataCurrent`, not just bump the counter

`GlobalFetchMixin.reload()` bumping `reloadCounter` is enough for LD/HiC, but
arc's `shouldFetch` reads `dataCurrent`, so a bump alone refires into a no-op.
`ArcFetchModel` also drops `loadedRegionSignature`. `features` deliberately
survives so stale arcs stay under the loading overlay instead of blanking.

## Two readiness flags, don't conflate

`svgReady` is the SVG-export terminal gate and goes false on a pan past a block
boundary, so an export fired mid-refetch waits for fresh arcs. The
`arc-display-done` testid uses the looser `drawn`, which stays true across a
refetch so the testid doesn't churn on pan.

Byte-gated only, called directly (`byteGateBlocksFetch`) because arc fetches
through `GlobalFetchMixin` rather than `fetchRegions`.
