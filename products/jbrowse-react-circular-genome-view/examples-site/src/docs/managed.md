The **managed** `<CircularGenomeView>` component owns the view engine internally
— there's no `createViewState` call and no `viewState` prop to thread through.
You pass the same `assembly` / `tracks` / `init` data as plain props and the
component constructs and holds the model for you:

```jsx
import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'
;<CircularGenomeView
  assembly={assembly}
  tracks={tracks}
  init={{ tracks: ['volvox_sv_test'] }}
/>
```

The props are **initial values** — read once on mount. This is the
lowest-ceremony way to drop a view onto a page. When you need to read or drive
the underlying model from outside, use the unmanaged
[`createViewState`](../volvox/) flow instead.
