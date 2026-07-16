Most [view types](../synteny-views/#synteny-example) are declared up front in
`defaultSession.views`. For views that should appear in response to runtime
conditions instead — a button click, a search hit, a backend event — use the
`LaunchView-*` extension points. This example boots an empty session and then
launches a `LinearGenomeView` after mount:

```js
import { getEnv } from '@jbrowse/core/util'

const { pluginManager } = getEnv(state)

await pluginManager.evaluateAsyncExtensionPoint('LaunchView-LinearGenomeView', {
  session: state.session,
  assembly: 'hg38',
  loc: 'chr10:1-100000',
  tracks: ['my_track'],
})
// also: LaunchView-LinearSyntenyView, LaunchView-DotplotView
```

This is the same machinery the import wizard uses internally, so anything the
user can launch from the UI you can launch from code. State actions like
`showTrack`/`hideTrack` and `navToLocString` are documented per view under
[docs/models](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
