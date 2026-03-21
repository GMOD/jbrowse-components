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
- [x] Vendored `bandage-layout-js` WASM + Emscripten glue into `plugins/graph/src/layout/`
- [x] Web Worker-based layout computation (`layout/layoutWorker.ts` + `layout/computeLayout.ts`)
- [x] Layout wired into model — `loadGFA()` auto-computes layout via worker, sets `layoutResult`
- [x] Layout progress reporting — progress bar with stage text in loading overlay
- [x] Layout quality selector (0-4) in toolbar with live recompute
- [x] Linear layout toggle button in toolbar with live recompute
- [x] Auto zoom-to-fit after layout completes
- [x] `recomputeLayout()` action for changing quality/linear settings without re-parsing GFA
- [x] Error handling — layout failures surface as model errors, don't leave stuck loading state
- [x] 60s timeout on layout computation

## Refactoring
- [x] Extracted `computeEdgeCurves()` to `util/geometry.ts` — shared Bezier control point computation between GeometryBuilder and hitDetection (eliminated ~120 lines of duplication)
- [x] Simplified hitDetection.ts to use shared `computeEdgeCurves` + `distanceToEdgeCurves`
- [x] Simplified GeometryBuilder edge rendering with `tessellateBezierCurves` helper
- [x] Removed redundant `setLoading(true)` calls in ImportForm (loadGFA handles it)

## Testing
- [x] Unit tests for `parseGFA` — GFA1 segments/links/paths, GFA2 E-lines, tags, headers, edge cases (8 tests)
- [x] Unit tests for `convertGFAToGraph` — strand nodes, CIGAR overlap, depth tags, path mapping (8 tests)
- [x] Unit tests for `GeometryBuilder` — batch output, color schemes, hover thickness, empty graph, paths (5 tests)
- [x] Unit tests for hit detection — `distanceToSegment`, `distanceToCubicBezier`, `findHoveredNode` (9 tests)
- [x] Unit tests for geometry utils — `projectLine`, `computeEdgeCurves` normal/self-loop/offset (8 tests)
- [x] Browser e2e test — puppeteer suite for import form rendering and example GFA load+render

## Model & Architecture
- [x] MST model with volatiles, views, and actions for full graph state
- [x] ImportForm for file/URL/example GFA loading
- [x] GraphCanvas component with toolbar integration
- [x] Plugin registration and view type setup
