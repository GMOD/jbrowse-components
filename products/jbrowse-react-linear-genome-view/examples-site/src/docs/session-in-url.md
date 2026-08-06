[Persistence](../session-setup/#with-session-persistence) keeps a session for
one browser; putting it in the URL makes it shareable. `encodeSession`
serializes the live session into a compact URL-safe string and `decodeSession`
turns one back into a snapshot:

```js
const param = new URLSearchParams(location.hash.slice(1)).get('session')
const state = createViewState({
  assembly,
  tracks,
  session: param ? await decodeSession(param) : undefined,
  defaultSession: param ? undefined : freshSession,
})
```

Four things worth knowing:

- **`session` vs `defaultSession`** fill the same slot but are checked
  differently. `defaultSession` is validated against the session model's shape,
  which suits one you wrote; a decoded session's shape is only known at runtime,
  so it goes in `session` and is checked as it is applied.
- **Use the hash fragment**, not the query string. The fragment never reaches
  the server, so a long session can't come back as an HTTP 414.
- **Only the session travels.** The receiving page supplies its own `assembly`
  and `tracks`; the snapshot names them. The encoding is JBrowse Web's own, so
  links open in either.
- **`encodeSession` does more than `getSnapshot`**: display settings a user
  picked up from a promoted display-type default live in their browser rather
  than in the session, and it folds those in first — otherwise the link renders
  differently for whoever opens it.
