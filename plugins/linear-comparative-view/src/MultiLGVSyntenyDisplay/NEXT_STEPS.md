# Next Steps: Multi-Synteny Coverage & Graph Integration

## Completed

- Coverage track added to MultiLGVSyntenyDisplay (GPU-rendered on same canvas)
- Shared code with LinearAlignmentsDisplay: computeCoverage, CoverageYScaleBar
- GfaAdapter.getSubgraph terminal alt segment bug fixed
- Same fix applied to GfaTabixAdapter buildGfaFromPathInference
- Topology validation tests added (7 new tests)
- Subgraph output uses `*` with LN:i: tags instead of full sequences

## Coverage track: remaining work

- ~~**Downsampling**: implemented via min/max band rendering~~
- ~~**Coverage color from theme**: uses `palette.coverage` from MUI theme~~
- ~~**Coverage tooltip**: uses shared `CoverageTooltipContents` component and
  `buildCoverageTooltipBin` from alignments-core~~
- ~~**SVG export**: CoverageYScaleBar included in SVG export~~
- ~~**Canvas2D refName bug**: fixed, refName extracted from region key~~
- ~~**SNP colors theme-driven**: GPU shaders read base colors from uniforms~~

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

- Remove `as any` cast on graphView.loadGFA by importing the type
- Hide graph view menu items when adapter doesn't support getSubgraph
- Consider passing GFA during view creation instead of after (avoids
  flash of empty view)
