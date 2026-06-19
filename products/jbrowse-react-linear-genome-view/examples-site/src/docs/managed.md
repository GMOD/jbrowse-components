The **managed** `<LinearGenomeView>` component owns the view engine internally —
there's no `createViewState` call and no `viewState` prop to thread through. You
pass the same `assembly` / `tracks` / `init` data as plain props, and the
component constructs and holds the model for you:

```jsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'
;<LinearGenomeView
  assembly={assembly}
  tracks={tracks}
  init={{ loc: 'ctgA:1,000..5,000', tracks: ['my_track'] }}
/>
```

The props are **initial values** — the component reads them once on mount. This
is the lowest-ceremony way to drop a view onto a page. When you need to read or
drive the underlying model from outside (navigation buttons, observers), either
use the unmanaged [`createViewState`](../use-create-view-state/) flow or grab
the model via the [imperative escape hatch](../managed-imperative-escape/).
