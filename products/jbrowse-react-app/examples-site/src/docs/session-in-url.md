Everything a user does — where they navigated, which tracks they opened, how
each display is configured — lives in the session. `encodeSession` serializes
the live session into a compact URL-safe string, and `decodeSession` turns one
back into a snapshot you pass as the `session` prop. That round-trip is what
turns the current view into a link someone else can open.

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

The encoded value belongs in the hash fragment rather than the query string. The
fragment is never sent to the server, so a long session won't overflow the
request line and come back as an HTTP 414; JBrowse Web moved its own `session=`
there for the same reason.

Only the session travels in the link. The receiving page supplies its own
`assemblies` and `tracks`, and a session that references a `trackId` the config
doesn't have is dropped on load with a notification rather than failing the
whole restore. Your `views` prop still describes the starting state: `session`
only decides what opens now, so File → New session returns to `views` rather
than to whatever was restored.

The encoding is JBrowse Web's own: `encodeSession` emits the same `encoded-…`
value that app's `?session=` accepts, so a link built here opens there, and one
built there opens here.

`encodeSession` does a little more than `getSnapshot`. Display settings a user
picks up from a promoted display-type default live in their own browser rather
than in the session, so a raw snapshot can render differently for whoever opens
the link. `encodeSession` folds those settings into the snapshot before encoding
it.

The demo puts its save button above the app to keep the example short. In a real
app it belongs in the toolbar: pass it as `headerButtons` and it renders beside
the session name, where JBrowse Web puts its own Share button. The button has to
be yours rather than built in — only your app knows the URL its page is served
at, and whether that page restores a session on load.

For a session you want to keep rather than share — surviving a reload without a
link — the same snapshot goes to `localStorage`; use the
[onChange](../customizing-the-app/#with-on-change) patch stream to know when it
changed.
