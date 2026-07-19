`createViewState` builds a MobX-state-tree instance — an expensive, stateful
object that must **not** be recreated on every React render. Calling it directly
in a component body would throw away the view (and its scroll position, open
tracks, and in-flight data) on each re-render of the parent.

`useCreateViewState` is a thin hook wrapper that memoizes the instance for the
lifetime of the component, so the view survives parent re-renders:

```jsx
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

function MyComponent() {
  const state = useCreateViewState({ assembly, tracks, location })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

The `location` option accepts either a locstring (`'ctgA:1,000..5,000'`,
1-based) or a `{ refName, start, end }` object (0-based) — the object form is
handy when you already have structured coordinates and don't want to format and
reparse a string.

If you instead call `createViewState` yourself, wrap it in `useState(() => …)`
(as the other examples here do) to get the same stability. To skip
`createViewState` altogether, the managed
[`<LinearGenomeView>`](../setting-up-the-view/#with-init) owns the engine for
you — no hook or state plumbing required.

See the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/)
for the full `createViewState` options.
