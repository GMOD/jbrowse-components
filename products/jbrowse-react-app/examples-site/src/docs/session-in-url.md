Everything a user does — where they navigated, which tracks they opened, how
each display is configured — lives in the session. `encodeSession` serializes
the live session into a compact URL-safe string, and `decodeSession` turns one
back into a snapshot you pass as the `session` prop. That is the whole
round-trip: a shareable link, a bookmarkable view, browser-history state.

```jsx
import { JBrowse, decodeSession, encodeSession } from '@jbrowse/react-app2'

// on load: restore, falling back to the declarative `views` if the link is bad
const param = new URLSearchParams(location.hash.slice(1)).get('session')
const session = param ? await decodeSession(param) : undefined

;<JBrowse
  assemblies={assemblies}
  tracks={tracks}
  views={views}
  session={session}
/>

// later: serialize whatever the user is looking at
const encoded = await encodeSession(viewState)
```

A few things worth knowing:

- **Put it in the hash fragment, not the query string.** The fragment is never
  sent to the server, so a long session can't overflow the request line and get
  an HTTP 414. JBrowse Web moved its own `session=` there for the same reason.
- **The session travels; the config does not.** The receiving page supplies its
  own `assemblies` and `tracks`. A session that references a `trackId` the
  config doesn't have is dropped on load with a notification, rather than
  failing the whole restore.
- **`views` still describes your starting state.** `session` only decides what
  opens now, so File → New session returns to `views` rather than to whatever
  was restored.
- **The format is JBrowse Web's.** `encodeSession` emits the same `encoded-…`
  value that app's `?session=` accepts, so a link built here can be opened there
  and vice versa.
- **It is not a plain `getSnapshot`.** Display settings a user inherits from a
  promoted display-type default live in their browser, not in the session, so a
  raw snapshot renders differently for whoever opens the link. `encodeSession`
  flattens that cascade into the snapshot first.

For a session you want to keep rather than share — surviving a reload without a
link — the same snapshot goes to `localStorage`; use the
[onChange](../customizing-the-app/#with-on-change) patch stream to know when it
changed.
