The view model is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
anything outside the LGV can subscribe to its state with `mobx-react`'s
`observer` HOC and re-render when relevant fields change. This is how you build
companion panels — coordinate readouts, feature inspectors, summary tables —
that stay in sync with the view without manual event wiring. This example shows
both a region readout and a feature table under one view.

**Reading the visible regions is synchronous.** An `observer` reading
`view.dynamicBlocks` (updated on every pan/zoom) or its debounced variant
`view.coarseDynamicBlocks` gets free reactivity:

```jsx
const VisibleRegions = observer(function VisibleRegions({ viewState }) {
  const view = viewState.session.view
  return <div>Current location: {view.coarseVisibleLocStrings}</div>
})
```

**Reading actual feature data** requires a round-trip through the RPC manager
(the same path the renderer uses). Because the fetch is async and the visible
region changes on every animation frame during a drag, key the query off the
**debounced** `coarseDynamicBlocks` (not `dynamicBlocks`) so you don't fire a
fetch per frame, tracking the region with an `autorun` inside an effect.

Every observable property and getter is listed in the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
— anything marked `#getter` or `#property` is reactive and safe to read.
