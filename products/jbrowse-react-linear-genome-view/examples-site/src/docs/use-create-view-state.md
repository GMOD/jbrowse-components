`createViewState` builds a MobX-state-tree instance, an expensive stateful
object that must not be recreated on every render — calling it in a component
body throws away the view (its scroll position, open tracks, and in-flight data)
each time the parent re-renders. `useCreateViewState` memoizes it for the
lifetime of the component:

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

`location` is the hook-form equivalent of the declarative `init.loc`. It accepts
a locstring (`'ctgA:1,000..5,000'`, 1-based) or a `{ refName, start, end }`
object (0-based), which is handy when you already have structured coordinates.

Calling `createViewState` yourself works the same if you wrap it in
`useState(() => …)`, as the other examples here do. To skip it altogether, the
managed [`<LinearGenomeView>`](../setting-up-the-view/#with-init) owns the
engine for you. The
[Embedding JBrowse tutorial](https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/)
has `createViewState` in a full worked example.
