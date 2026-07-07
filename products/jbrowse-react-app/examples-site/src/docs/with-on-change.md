Pass an `onChange` callback to `<JBrowse>` (alongside the `assemblies`/`tracks`/
`views` from the [basic example](../basic-example/)) to be notified on every
[MST](https://mobx-state-tree.js.org/) patch. It receives the forward patch and
its inverse, so you can persist the session, build an undo/redo stack, or sync
external UI:

```jsx
<JBrowse
  assemblies={assemblies}
  tracks={tracks}
  views={views}
  onChange={(patch, reversePatch) => {
    // patch: { op, path, value } — the change that was just applied
    // reversePatch: the patch that would undo it
  }}
/>
```

A common use is autosaving the session to `localStorage` so a reload restores
where the user left off. That needs a full snapshot rather than just the
patch, and restoring a saved session on mount needs a `config.defaultSession`
you control directly — both call for the unmanaged `createViewState` +
`<JBrowseApp>` flow instead of the managed component:

```js
// @jbrowse/mobx-state-tree is JBrowse's bundled MST fork
import { getSnapshot } from '@jbrowse/mobx-state-tree'

const saved = localStorage.getItem('jbrowse-session')
const state = createViewState({
  config: {
    ...config,
    defaultSession: saved ? JSON.parse(saved) : config.defaultSession,
  },
  // runs after construction, so referencing `state` here is safe
  onChange: () => {
    localStorage.setItem(
      'jbrowse-session',
      JSON.stringify(getSnapshot(state.session)),
    )
  },
})
```

The patch `path` strings mirror the session state tree. The
[BaseSessionModel](https://jbrowse.org/jb2/docs/models/basesessionmodel/) and
per-view model docs (e.g.
[LinearGenomeView](https://jbrowse.org/jb2/docs/models/lineargenomeview/)) show
which properties live where, so you can tell which patches matter for your use
case.
