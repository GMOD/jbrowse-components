`onChange` fires on every [MST](https://mobx-state-tree.js.org/) patch, with the
forward patch and its inverse — enough to persist the session, build undo/redo,
or sync external UI.

Autosaving to `localStorage` needs a bit more: a full snapshot rather than a
patch, and a `config.defaultSession` you control on mount. Both call for the
unmanaged `createViewState` + `<JBrowseApp>` flow:

```js
import { getSnapshot } from '@jbrowse/mobx-state-tree'

const saved = localStorage.getItem('jbrowse-session')
const state = createViewState({
  config: { ...config, defaultSession: saved ? JSON.parse(saved) : undefined },
  // runs after construction, so referencing `state` here is safe
  onChange: () =>
    localStorage.setItem(
      'jbrowse-session',
      JSON.stringify(getSnapshot(state.session)),
    ),
})
```

Patch `path` strings mirror the session state tree, so
[BaseSessionModel](https://jbrowse.org/jb2/docs/models/basesessionmodel/) and
the per-view model docs tell you which patches matter.
