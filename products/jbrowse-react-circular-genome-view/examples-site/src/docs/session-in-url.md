Everything the user changes — which tracks are open, how the view is rotated —
lives in the session. `encodeSession` serializes the live session into a compact
URL-safe string, and `decodeSession` turns one back into a snapshot you pass as
the `session` option. That round-trip is what turns the current view into a link
someone else can open.

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

`session` and `defaultSession` fill the same slot, but they are checked
differently. `defaultSession` is validated against the session model's shape,
which suits one you write by hand; a decoded session's shape is only known at
runtime, so it goes in `session` and is checked as it is applied.

The encoded value belongs in the hash fragment rather than the query string. The
fragment is never sent to the server, so a long session won't overflow the
request line and come back as an HTTP 414.

Only the session travels in the link. The receiving page supplies its own
`assembly` and `tracks`, and the snapshot refers to them by name. The encoding
is JBrowse Web's own: `encodeSession` emits the same `encoded-…` value that
app's `?session=` accepts.

To keep a session for one browser rather than share it, write the same snapshot
to `localStorage` instead — `onSnapshot(state.session, …)` tells you when it
changed.
