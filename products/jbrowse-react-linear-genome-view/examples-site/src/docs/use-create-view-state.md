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

If you instead call `createViewState` yourself, wrap it in `useState(() => …)`
(as the other examples here do) to get the same stability.
