The view model is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
anything outside the view can wrap in `mobx-react`'s `observer` and re-render
when the fields it reads change — coordinate readouts, feature inspectors,
summary tables — with no event wiring:

```jsx
const VisibleRegions = observer(function VisibleRegions({ viewState }) {
  return <div>{viewState.session.view.coarseVisibleLocStrings}</div>
})
```

Reading the visible regions is synchronous: `view.dynamicBlocks` updates every
pan/zoom frame, `view.coarseDynamicBlocks` is its debounced twin. Reading actual
feature data goes through the RPC manager, so **key that query off the coarse
blocks** in an `autorun` inside an effect, or you fire a fetch per animation
frame of a drag.

Anything marked `#getter` or `#property` in the
[state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/) is reactive
and safe to read. That is the whole read API: there is no change callback to
subscribe to, because `observer` already re-renders exactly the components that
read what changed.
