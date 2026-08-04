A [`defaultSession`](../default-session/) restores state on first paint. To keep
it up to date, mirror the live session back out as the user interacts. The
session is a [MobX-state-tree](https://mobx-state-tree.js.org) node, so
`onSnapshot` gives you a serializable snapshot after every change:

```js
import { getSnapshot, onSnapshot } from '@jbrowse/mobx-state-tree'

const state = createViewState({
  assembly,
  tracks,
  defaultSession: JSON.parse(localStorage.getItem(KEY)) ?? freshSession,
})
onSnapshot(state.session, snap =>
  localStorage.setItem(KEY, JSON.stringify(snap)),
)
```

The snapshot references tracks by `trackId` and the assembly by name, so it
restores against the same `assembly`/`tracks` config you pass on every load.
Swap `localStorage` for a server call to persist per-user views.

This keeps a session for one browser. To hand one to someone else, use
[the session in the URL](../session-setup/#session-in-url) — `encodeSession`
compresses it for a link and bakes in settings a raw `getSnapshot` would leave
behind in your own browser.
