# @jbrowse/plugin-arc

Main-thread Canvas2D — no RPC worker, no GPU backend, no `RenderLifecycleMixin`.
`LinearArcDisplay` connects one feature's own start↔end;
`LinearPairedArcDisplay` connects two independent endpoints each with their own
refName.

## One list, three consumers

**`model.laidOutArcs` is the only place either display reads `bpToPx`**, and
everything downstream of it takes a plain array: `drawArcs` strokes it,
`hitTestArcs` measures it, and `ArcsSvg` writes one `<path>` per entry for the
export.

That is a performance shape, not tidiness. Each arc used to be its own
`observer` projecting itself, so a zoom ran a MobX reaction and patched ~3 SVG
attributes **per arc per frame**, per track — 4 arcs cost 8 reactions and 12 DOM
mutations a frame, and an SV callset carries thousands in view. As a model
computed MobX caches it against the viewport, so a hover redraws without
re-placing anything. The `census: arcs` arm of
`products/jbrowse-web/src/tests/ZoomRenderCensus.test.tsx` holds the numbers and
asserts the per-arc terms stay gone.

**A shape, not a path string.** `shared/arcShape.ts` owns the two curves — a
semicircle is a true half circle (radius IS half the span) and a bezier is a
symmetric cubic apexing at `0.75 * height` — and hands out the canvas stroke,
the `d`, the apex and the distance from ONE derivation. Don't write a second;
`arcShape.test.ts` pins every point of the exported path as measuring zero
distance, which is the check that keeps the hover on the ink.

**The export stays vector, and is the one thing SVG still does here.** It emits
`<path>` per arc off the same list because a figure wants vector and that path
runs once, not sixty times a second. See `agent-docs/reference/SVG_EXPORT.md`.

**The hover is a hit test.** `ARC_HIT_SLOP_PX` and the `bestArcMark` ranking are
`@jbrowse/sv-core`'s, shared with the alignments arc band — nearest ink wins,
later-painted breaks the tie. The alignments GEOMETRY does not travel and
cannot: `hitTestArcBand` reads `ArcsUploadData` and resolves conic domes through
the generated `arcRadiiPx` against a genomic Y domain, none of which arc has.

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

- **`reload()`'s bump is enough to refetch, and the invalidation is for the
  overlay** — the shared skeleton's reload epoch overrides its own freshness
  gate, so a bump refires into a fetch with nothing to remember to clear (this
  was the rule the other way around until 2026-08-31, when arc's `reload()`
  needed the invalidation or the gate declined). `GlobalFetchMixin.reload()`
  drops `loadedFetchKey` so `dataCurrent` goes false and the refetch shows as
  loading; `features` deliberately survives, so stale arcs stay under that
  overlay instead of blanking.
- **Two readiness flags, don't conflate**: `svgReady` is the SVG-export terminal
  gate and goes false on a pan past a block boundary; `data-display-drawn` gets
  the looser `painted`, which stays true across a refetch so the testid doesn't
  churn on pan, and counts `paintInert` so an empty viewport settles.
- Byte-gated only, and the gate is inside the fetch: `ArcGetFeatures` measures
  the index before it downloads and answers a `RegionTooLargeResult` instead of
  features. Arc's opt-in is the `gateEnabled` override plus the `byteLimit` its
  `run` passes. It reads its own RPC rather than `CoreGetFeatures` for exactly
  that reason — that method has eight callers and none of the others gates.
