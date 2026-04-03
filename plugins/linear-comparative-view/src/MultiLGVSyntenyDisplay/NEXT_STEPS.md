# Next Steps: Multi-Synteny Coverage & Graph Integration

## Coverage: completed

- **Insertion indicator triangles from CS tags**: insertion indicators are now
  rendered as downward-pointing triangles at the top of the coverage area when
  the insertion count at a position exceeds 15% of local depth. Shared
  `drawIndicatorTriangle` primitive and `computeInsertionIndicators` function
  via `@jbrowse/alignments-core`. Rendered in all 3 backends (WebGL, WebGPU,
  Canvas2D). LinearAlignmentsDisplay renderSvg.tsx also uses the shared
  `drawIndicatorTriangle`.
- **Canvas2D SNP coverage downsampling**: SNP segments are now skipped when
  `snpCount > width * 4` to avoid overwhelming Canvas2D at wide zoom levels.
- **Coverage click to open widget**: clicking the coverage area now opens a
  BaseFeatureWidget showing depth, SNP counts/percentages, and interbase
  entries, matching LinearAlignmentsDisplay behavior.

## Code sharing: further opportunities

- **GPU coverage shaders**: the GLSL/WGSL coverage bar and SNP segment shaders
  in both displays are structurally identical (same coordinate math, same
  snpColor lookup). Could extract shared shader fragments to alignments-core.
  Blocked by different coordinate spaces (clip-space vs pixel-space) and
  uniform buffer layouts.
- **Canvas2D coverage rendering**: LinearAlignmentsDisplay renderSvg.tsx has
  its own coverage bar rendering loop that duplicates the same effectiveHeight /
  coverageBottom / depthScale math. Could extract a shared
  renderCoverageBarsToCtx utility.

## Subgraph extraction: remaining work

- **GfaTabixAdapter buildGfaFromPathInference** has the terminal segment fix
  but uses refOrdSet (viewport ref ordinals) as heuristic for "is this a ref
  segment." If non-viewport ref ordinals happen to be fetched, they could stop
  the span extension prematurely. Low risk in practice but worth noting.
- **Add topology tests for GfaTabixAdapter** similar to the GfaAdapter tests.
  Blocked on synthetic test data that exercises the path inference code path
  with terminal variants.

## vg server integration (all MIT licensed)

### Option A: VgServerAdapter

Create an adapter that calls a vg server (like sequenceTubeMap's Express
server) over REST. The server runs `vg chunk` to extract subgraphs.

Steps:
- Define adapter config schema (serverUrl, graphFile, optional gamFiles)
- Implement getSubgraph: POST to /api/v0/getChunkedData, receive vg JSON,
  convert to GFA text
- Implement getMultiPairFeatures: parse vg JSON paths into synteny features
- Add to comparative-adapters plugin or a new plugin
- Test with sequenceTubeMap's server

Benefits: topology-aware extraction via `vg chunk -c N` (context steps),
native .xg/.gbz support, read alignment integration.

### Option B: GbzWasmAdapter

Use gbz-base WASM library to query GBZ files client-side in a Web Worker.

Steps:
- Add gbz-base as dependency
- Create adapter that loads GBZ file and queries via WASM
- Run in JBrowse's RPC worker for off-main-thread execution
- Implement getSubgraph and getMultiPairFeatures

Benefits: no server needed, works with static file hosting, same tech as
sequenceTubeMap's local mode.

### Priority

Option A is simpler and immediately useful for users who already run vg.
Option B is more interesting long-term for zero-server deployments. Both
can coexist as separate adapter types.

## Launch workflow improvements (lower priority)

- Hide graph view menu items when adapter doesn't support getSubgraph
- Consider passing GFA during view creation instead of after (avoids
  flash of empty view)
