A [`defaultSession`](../default-session/) restores state on first paint; to keep
it current, mirror the live session back out. The session is a MobX-state-tree
node, so `onSnapshot` hands you a serializable snapshot after every change:

```js
import { onSnapshot } from '@jbrowse/mobx-state-tree'

onSnapshot(state.session, snap =>
  localStorage.setItem(KEY, JSON.stringify(snap)),
)
```

The snapshot references tracks by `trackId` and the assembly by name, so it
restores against the same `assembly`/`tracks` config you pass on every load.
Swap `localStorage` for a server call to persist per user.

This keeps a session for one browser. To hand one to someone else, use
[the session in the URL](../session-setup/#session-in-url).
