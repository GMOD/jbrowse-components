The view model is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
anything outside the LGV can subscribe to its state with `mobx-react`'s
`observer` HOC and re-render when relevant fields change. This is how you build
companion panels (coordinate readouts, feature inspectors, summary tables) that
stay in sync with the view without manual event wiring.

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
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
Anything marked `#getter` or `#property` is reactive and safe to read.

`createViewState` also takes an `onChange(patch, reversePatch)` callback that
fires a raw MST JSON patch on every state change. Because you get the reverse
patch too, it is what you'd build a change log or undo/redo on. For keeping UI
in sync, though, prefer the `observer` approach above: it re-renders only the
components that read the fields that changed, whereas `onChange` hands you every
patch to route yourself. For persisting state,
[`onSnapshot`](../session-setup/#with-session-persistence) gives whole snapshots
rather than patches.
