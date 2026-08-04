[Persistence](../session-setup/#with-session-persistence) keeps a session for
one browser. Putting it in the URL makes it _shareable_: `encodeSession`
serializes the live session into a compact URL-safe string, and `decodeSession`
turns one back into a snapshot you pass as the `session` option.

```js
import {
  createViewState,
  decodeSession,
  encodeSession,
} from '@jbrowse/react-linear-genome-view2'

// on load: restore, falling back to your normal starting state if the link is bad
const param = new URLSearchParams(location.hash.slice(1)).get('session')
const state = createViewState({
  assembly,
  tracks,
  session: param ? await decodeSession(param) : undefined,
  defaultSession: param ? undefined : freshSession,
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
  value that app's `?session=` accepts, so a link built here can be opened there
  and vice versa.
- **It is not a plain `getSnapshot`.** Display settings a user inherits from a
  promoted display-type default live in their browser, not in the session, so a
  raw snapshot can render differently for whoever opens the link.
  `encodeSession` flattens that cascade into the snapshot first.
