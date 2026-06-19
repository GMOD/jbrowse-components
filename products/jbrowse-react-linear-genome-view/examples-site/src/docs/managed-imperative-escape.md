The [managed](../managed/) `<LinearGenomeView>` hides the view model, but you
can still reach it when you need imperative control. Attach a `ref` typed as
`ViewModel` and the component populates it with the live `LinearGenomeViewModel`
once constructed. External buttons can then call its actions directly — here, a
row of bookmark buttons drives navigation without the parent ever calling
`createViewState`:

```jsx
import { useRef } from 'react'
import {
  LinearGenomeView,
  type ViewModel,
} from '@jbrowse/react-linear-genome-view2'

function MyComponent() {
  const ref = useRef<ViewModel>(null)
  return (
    <>
      <button onClick={() => ref.current?.session.view.navToLocString('chr2:20,000..25,000')}>
        region B
      </button>
      <LinearGenomeView ref={ref} assembly={assembly} tracks={tracks} init={{ loc: 'chr1:1..10,000' }} />
    </>
  )
}
```

This gives you the convenience of the managed component plus full access to the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
for navigation, observation, and other advanced control.
