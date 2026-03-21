# Graph Genome Plugin — Next Steps

## GfaAdapter Integration
- [ ] Wire graph view's ImportForm to load from GfaAdapter tracks (open from track list)
- [ ] Add GfaAdapter to `GuessAdapter` for `.gfa` file extension detection

## Rendering
- [ ] Investigate incremental geometry updates (only rebuild changed nodes/edges on hover) to avoid full `buildGeometry` on every frame

## Interaction
- [ ] Right-click context menu on nodes/edges (show name, length, depth, path membership)
- [ ] Node search — text input to find and zoom to a node by name
- [ ] Path highlighting — click a path to highlight all its edges
- [ ] Selection info panel — show details of selected node in a sidebar/widget

## GFA Support
- [ ] Support GFA2 fragment (F) and gap (G) lines
- [ ] Handle large GFA files — streaming parse, or load via tabix-indexed GFA adapter
- [ ] Connect graph view to GfaTabixAdapter for server-side indexed GFA

## View Features
- [ ] Dark mode toggle in toolbar (volatile exists, no UI)
- [ ] Contig/connector thickness sliders (volatiles exist, no UI)
- [ ] Export graph view as SVG or PNG
- [ ] Keyboard shortcuts (arrow keys for pan, +/- for zoom, Escape to deselect)
- [ ] Touch/trackpad gesture support for mobile

## Testing
- [ ] Unit tests for `GfaAdapter` with sample GFA files
