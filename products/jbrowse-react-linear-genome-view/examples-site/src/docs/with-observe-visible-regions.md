The view model is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
anything outside the LGV can subscribe to its state with `mobx-react`'s
`observer` HOC and re-render when relevant fields change. This is how you build
companion panels — coordinate readouts, feature inspectors, summary tables —
that stay in sync with the view without manual event wiring.

```jsx
import { observer } from 'mobx-react'

const VisibleRegion = observer(function VisibleRegion({ viewState }) {
  const view = viewState.session.view
  return <div>Current location: {view.coarseVisibleLocStrings}</div>
})
```

`view.dynamicBlocks` describes the regions currently scrolled into view, updated
on every pan and zoom; an observer reading it gets free reactivity. For
frequently-changing reads, `view.coarseDynamicBlocks` is the debounced variant
and is usually what you want. Every observable property and getter is listed in
the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
— anything marked `#getter` or `#property` is reactive and safe to read.

To read actual feature data (not just regions), see
[observe visible features](../with-observe-visible-features/).
