# Graph Genome Plugin — Next Steps

## Scalability (remaining)

- [ ] Move screen-space line width to vertex shader — eliminates geometry
      rebuild on zoom
- [ ] Viewport culling — skip geometry for nodes/edges outside visible area
- [ ] Edge spatial index — extend SpatialIndex to edges for O(1) edge hit
      detection
- [ ] LOD — reduce tessellation detail at low zoom levels, skip small nodes

## GfaAdapter Integration

- [ ] Wire graph view's ImportForm to load from GfaAdapter tracks (open from
      track list)
- [ ] Add GfaAdapter to `GuessAdapter` for `.gfa` file extension detection

## Rendering

- [ ] Investigate incremental geometry updates (only rebuild changed nodes/edges
      on hover) to avoid full `buildGeometry` on every frame

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
- [ ] Export graph view as SVG or PNG

## Testing

- [ ] Unit tests for `GfaAdapter` with sample GFA files
