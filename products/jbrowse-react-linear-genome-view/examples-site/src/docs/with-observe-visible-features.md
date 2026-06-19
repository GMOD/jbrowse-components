Reading the regions in view is synchronous, but reading the actual **feature
data** requires a round-trip through the RPC manager (the same path the renderer
uses). This example queries features for the visible region whenever that region
changes, and renders them in a companion list.

Because the fetch is async and the visible region changes on every animation
frame during a drag, key your query off the **debounced**
`view.coarseDynamicBlocks` (not `dynamicBlocks`) so you don't fire a fetch per
frame. Track the region with an `autorun` inside an effect and short-circuit
when it's unchanged.

For the simpler case of just reading the visible coordinates, see
[observe visible regions](../with-observe-visible-regions/).
