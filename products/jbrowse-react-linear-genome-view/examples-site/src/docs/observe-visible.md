The view model is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
anything outside the view can subscribe with `mobx-react`'s `observer` and
re-render when the fields it reads change — coordinate readouts, feature
inspectors, summary tables, with no event wiring:

```jsx
const VisibleRegions = observer(function VisibleRegions({ viewState }) {
  const view = viewState.session.view
  return <div>Current location: {view.coarseVisibleLocStrings}</div>
})
```

Reading the visible regions is synchronous: `view.dynamicBlocks` updates on
every pan/zoom, `view.coarseDynamicBlocks` is its debounced variant. Reading
actual feature data goes through the RPC manager, so key that query off the
coarse blocks with an `autorun` inside an effect, or you fire a fetch per
animation frame of a drag.

Every observable property and getter is listed in the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/);
anything marked `#getter` or `#property` is reactive and safe to read.

`createViewState` also takes an `onChange(patch, reversePatch)` callback firing
a raw MST JSON patch on every state change — what you'd build a change log or
undo/redo on. For keeping UI in sync prefer `observer`, which re-renders only
the components that read what changed. For persisting state,
[`onSnapshot`](../session-setup/#with-session-persistence) gives whole snapshots
rather than patches.
