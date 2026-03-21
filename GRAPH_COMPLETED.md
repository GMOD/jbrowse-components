# Graph Genome Plugin — Completed Work

## Rendering Backends
- [x] WebGPU backend — full shader-based rendering (`plugins/graph/src/renderer/WebGPURenderer.ts`)
- [x] WebGL2 backend — GLSL shaders, VAO, indexed drawing (`plugins/graph/src/renderer/WebGL2Renderer.ts`)
- [x] Canvas2D fallback — triangle rasterization via 2D context (`plugins/graph/src/renderer/Canvas2DRenderer.ts`)
- [x] Renderer strategy pattern — tries WebGPU → WebGL2 → Canvas2D (`plugins/graph/src/renderer/GraphRenderer.ts`)
- [x] GeometryBuilder — polyline tessellation, round caps, Bezier arrowheads, multi-path edge offsets (`plugins/graph/src/renderer/GeometryBuilder.ts`)

## GFA Parsing & Adapter
- [x] GFA1 parser (S/L/P lines) in graph plugin (`plugins/graph/src/gfa/gfaParser.ts`)
- [x] GFA1.1 W-line support in GfaAdapter (`plugins/comparative-adapters/src/GfaAdapter/GfaAdapter.ts`)
- [x] GFA→Graph data structure conversion (`plugins/graph/src/gfa/gfaConverter.ts`)
- [x] Handle pathless GFA files in GfaAdapter (segments + links without reference coordinates)
- [x] Segment merging in GfaAdapter for contiguous segments with same strand
- [x] `prefix` preprocessor shorthand in GfaAdapter config (matching GfaTabixAdapter pattern)
- [x] GFA2 E-line parsing (extracted as regular links in gfaParser.ts)

## Interaction
- [x] Pan (drag), zoom (wheel), click-to-select node
- [x] Hit detection for nodes and edges (Bezier sampling) (`plugins/graph/src/util/hitDetection.ts`)
- [x] Hover highlighting with tooltips (node: name/length/depth, edge: endpoints)

## View Features
- [x] 5 color schemes (uniform, random, depth, gc-content, grey) with UI selector
- [x] Zoom controls — buttons (in/out/fit) + wheel zoom
- [x] Dark mode state + rendering support (no UI toggle yet)
- [x] Contig/connector thickness volatiles (no UI sliders yet)
- [x] Draw paths toggle

## Layout Engine
- [x] Runtime-loaded layout engine — WASM fetched from `https://jbrowse.org/demos/bandage` (GPL code never bundled)
- [x] Layout via JBrowse RPC system (`layout/GraphComputeLayout.ts`) — uses existing worker pool
- [x] Lazy WASM init — module loaded on first layout call, shared across subsequent calls
- [x] Configurable layout URL — `layoutUrl` arg allows self-hosted WASM
- [x] Layout wired into model — `loadGFA()` calls `rpcManager.call('GraphComputeLayout', ...)`
- [x] Layout progress via RPC `statusCallback` — progress bar with stage text in loading overlay
- [x] Layout quality selector (0-4) in toolbar with live recompute
- [x] Linear layout toggle button in toolbar with live recompute
- [x] Auto zoom-to-fit after layout completes
- [x] `recomputeLayout()` action for changing quality/linear settings without re-parsing GFA
- [x] Error handling — try/catch/finally in MST flows, `isLoading` always cleared
- [x] WASM uploaded to `https://jbrowse.org/demos/bandage/` (bandage-layout.js + bandage-layout.wasm)

## Scalability
- [x] Spatial index for hit detection — grid-based index turns O(N) per-mousemove into O(1) average
- [x] Separate transform from geometry rebuild — panning only updates transform uniform + re-renders, no geometry rebuild

## Bug Fixes
- [x] gfaConverter now includes nodes referenced in paths but not links (was silently dropping them)
- [x] Segment-only GFA files (no links/paths) now create forward-strand nodes (was producing empty graph)
- [x] MST flow error handling — try/catch/finally ensures `isLoading` is always cleared on error
- [x] Proper error messages — `e instanceof Error ? e.message : e` instead of `"${e}"` which produces `[object Object]`
- [x] Fixed stale renderer reference — removed WeakMap cache, each GraphCanvas mount creates fresh renderer
- [x] Fixed renderer init race — added `rendererReady` state to gate MobX autoruns until async WebGL init completes
- [x] Fixed MST action error — `statusCallback` from RPC was writing volatile outside action, changed to call `setStatusMessage` action
- [x] Fixed black canvas in browser tests — switched to `canvasSnapshot` targeting canvas element (full-page screenshots too small to see thin lines)

## Refactoring
- [x] Extracted `computeEdgeCurves()` to `util/geometry.ts` — shared Bezier control point computation between GeometryBuilder and hitDetection (eliminated ~120 lines of duplication)
- [x] Simplified hitDetection.ts to use shared `computeEdgeCurves` + `distanceToEdgeCurves`
- [x] Simplified GeometryBuilder edge rendering with `tessellateBezierCurves` helper
- [x] Removed redundant `setLoading(true)` calls in ImportForm (loadGFA handles it)
- [x] Removed dead model actions (`setGraph`, `setLayoutResult`, `setLoading`) — flows handle state internally
- [x] Extracted `renderFrame` helper in GraphCanvas — deduplicates transform+render between geometry and pan autoruns
- [x] Removed debug logging after browser verification complete
- [x] Increased default contigThickness (5→10) and connectorThickness (1.5→4) for visibility

## Testing
- [x] Unit tests for `parseGFA` — GFA1 segments/links/paths, GFA2 E-lines, tags, headers, edge cases (8 tests)
- [x] Unit tests for `convertGFAToGraph` — strand nodes, CIGAR overlap, depth tags, path mapping, orphan nodes (11 tests)
- [x] Unit tests for `GeometryBuilder` — batch output, color schemes, hover thickness, empty graph, paths (5 tests)
- [x] Unit tests for hit detection — `distanceToSegment`, `distanceToCubicBezier`, `findHoveredNode` (9 tests)
- [x] Unit tests for geometry utils — `projectLine`, `computeEdgeCurves` normal/self-loop/offset (8 tests)
- [x] Unit tests for `SpatialIndex` — nearby/far queries, intersections, deduplication (5 tests)
- [x] Browser e2e test — puppeteer suite with canvas snapshot showing rendered graph (4 nodes, diamond topology)

## Model & Architecture
- [x] MST model with volatiles, views, and actions for full graph state
- [x] ImportForm for file/URL/example GFA loading
- [x] GraphCanvas component with toolbar integration
- [x] Plugin registration and view type setup
