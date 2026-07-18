A [`defaultSession`](../default-session/) restores state on first paint; to keep
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
onSnapshot(state.session, snap => localStorage.setItem(KEY, JSON.stringify(snap)))
```

The snapshot references tracks by `trackId` and the assembly by name, so it
restores against the same `assembly`/`tracks` config you pass on every load —
swap `localStorage` for a server call to persist per-user views. `getSnapshot`
is also how you export the current session on demand (e.g. a "share" button).
