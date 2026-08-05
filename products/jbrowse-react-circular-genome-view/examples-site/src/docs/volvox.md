Pass an `assembly`, a list of `tracks`, and an `init` for the tracks to open on
first paint straight to `<CircularGenomeView>` as props — no `createViewState`
call needed. The config reuses the JBrowse format, with one difference: a single
`assembly` rather than an `assemblies` array.

```jsx
import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

;<CircularGenomeView
  assembly={assembly}
  tracks={tracks}
  init={{ tracks: ['volvox_sv_test'] }}
/>
```

The props are **initial values**, read once on mount. To open a track in
response to a runtime event, or to reach the engine imperatively, use the
unmanaged `createViewState` flow — see [show a track](../show-track/).

Every config field is listed under
[docs/config](https://jbrowse.org/jb2/docs/config/), and view snapshot
properties under [docs/models](https://jbrowse.org/jb2/docs/models/) (e.g.
[CircularView](https://jbrowse.org/jb2/docs/models/circularview/)).
