# Graph Genome Plugin — Next Steps

## Scalability (remaining)

- [ ] LOD — reduce Bezier tessellation detail at low zoom levels (`flatness =
      Math.max(0.5, 2.0 / scale)`), skip nodes whose screen-space length < 2px
- [ ] Adaptive multi-path edge offset — currently fixed at 3 graph units,
      should scale with zoom for consistent screen-space separation

## GfaAdapter Integration

- [ ] Wire graph view's ImportForm to load from GfaAdapter/GfaTabixAdapter
      tracks (open from track list)
- [ ] Add GfaAdapter to `GuessAdapter` for `.gfa` file extension detection
- [ ] GfaTabixAdapter subgraph loading — fetch segments for a configurable
      region, convert to Graph format, compute layout on subgraph only
      (enables BandageNG-style scope-based viewing for huge files)

## Rendering

- [ ] Depth-based node width — per-vertex thickness attribute computed from
      coverage depth using power function (matches BandageNG's
      `getNodeWidth()`)
- [ ] Anti-aliased edges — MSAA or alpha blending for smoother line rendering

## Interaction

- [ ] Right-click context menu on nodes/edges (show name, length, depth, path
      membership)
- [ ] Node search — text input to find and zoom to a node by name
- [ ] Path highlighting — click a path to highlight all its edges
- [ ] Selection info panel — show details of selected node in a sidebar/widget

## GFA Support

- [ ] Support GFA2 fragment (F) and gap (G) lines
- [ ] Handle large GFA files — streaming parse, or load via tabix-indexed GFA
      adapter
- [ ] Connect graph view to GfaTabixAdapter for server-side indexed GFA

## View Features

- [ ] Contig/connector thickness sliders (volatiles exist, no UI)
- [ ] Dark mode UI toggle (state exists, no toggle button)
- [ ] Export graph view as SVG or PNG

## Testing

- [ ] Unit tests for `GfaAdapter` with sample GFA files
- [ ] Performance benchmarks — 10K+ node GFA with console.time guards around
      buildGeometry to verify hover/zoom don't trigger rebuilds
- [ ] Browser e2e test for hover highlighting (verify color changes without
      geometry rebuild)
