Everything the user changes — which tracks are open, how the view is rotated —
lives in the session. `encodeSession` serializes the live session into a compact
URL-safe string, and `decodeSession` turns one back into a snapshot you pass as
the `session` option. That is the whole round-trip: a shareable link, a
bookmarkable view, browser-history state.

```js
import {
  createViewState,
  decodeSession,
  encodeSession,
} from '@jbrowse/react-circular-genome-view2'

// on load: restore, falling back to the normal starting state if the link is bad
const param = new URLSearchParams(location.hash.slice(1)).get('session')
const state = createViewState({
  assembly,
  tracks,
  session: param ? await decodeSession(param) : undefined,
})

// later: serialize whatever the user is looking at
const encoded = await encodeSession(state)
```

A few things worth knowing:

- **`session` vs `defaultSession`.** They fill the same slot, but
  `defaultSession` is checked against the session model's shape, which suits one
  you write by hand. A decoded session's shape is only known at runtime, so it
  goes in `session` and is validated as it's applied.
- **Put it in the hash fragment, not the query string.** The fragment is never
  sent to the server, so a long session can't overflow the request line and get
  an HTTP 414.
- **The session travels; the config does not.** The receiving page supplies its
  own `assembly` and `tracks`, and the snapshot references them by name.
- **The format is JBrowse Web's.** `encodeSession` emits the same `encoded-…`
  value that app's `?session=` accepts.

To keep a session for one browser rather than share it, write the same snapshot
to `localStorage` instead — `onSnapshot(state.session, …)` tells you when it
changed.
