# Graph Genome Plugin — Next Steps

## Layout Integration
- [ ] Copy `bandage-layout-js` WASM, worker, and wrapper code into `plugins/graph/src/layout/` (vendor inline, no npm publish)
- [ ] Wire the layout worker into the model — call `computeLayout()` after `loadGFA` and feed result into `setLayoutResult`
- [ ] Add layout progress reporting (the worker emits progress events)
- [ ] Add layout quality and linear layout toggles to the toolbar (volatiles exist but no UI)

## Config-Driven Dataset Loading
- [ ] Read `graphGenome.datasets` from root config in the ImportForm
- [ ] Show configured datasets as quick-load buttons alongside file/URL import
- [ ] Wire `gfaLocation` through JBrowse's `openLocation` / `getFileBytes` for auth/range support

## Rendering
- [ ] Test WebGPU backend end-to-end on Chrome/Firefox with `?gpu=webgpu`
- [ ] Test Canvas2D fallback in environments without WebGL2
- [ ] Add browser tests (puppeteer) for graph loading + render snapshot comparison across backends
- [ ] Investigate incremental geometry updates (only rebuild changed nodes/edges on hover) to avoid full `buildGeometry` on every frame

## Interaction
- [ ] Right-click context menu on nodes/edges (show name, length, depth, path membership)
- [ ] Node search — text input to find and zoom to a node by name
- [ ] Path highlighting — click a path to highlight all its edges
- [ ] Selection info panel — show details of selected node in a sidebar/widget

## GFA Support
- [ ] Support W-lines (GFA 1.1 walk lines) in addition to P-lines
- [ ] Support GFA2 fragment (F) and gap (G) lines
- [ ] Handle large GFA files — streaming parse, or load via tabix-indexed GFA adapter
- [ ] Connect to existing `GfaTabixAdapter` from comparative-adapters plugin for server-side GFA

## View Features
- [ ] Dark mode toggle in toolbar (volatile exists, no UI)
- [ ] Contig/connector thickness sliders
- [ ] Export graph view as SVG or PNG
- [ ] Keyboard shortcuts (arrow keys for pan, +/- for zoom, Escape to deselect)
- [ ] Touch/trackpad gesture support for mobile

## Testing
- [ ] Unit tests for `parseGFA` with GFA1, GFA2, edge cases
- [ ] Unit tests for `convertGFAToGraph` including path extraction
- [ ] Unit tests for `MeshBuilder` geometry correctness
- [ ] Unit tests for hit detection accuracy
