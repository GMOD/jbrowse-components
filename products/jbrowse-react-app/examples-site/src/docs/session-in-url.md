`encodeSession` serializes the live session — where the user navigated, which
tracks they opened, how each display is configured — into a compact URL-safe
string, and `decodeSession` turns one back into a snapshot for the `session`
prop.

- **Use the hash fragment**, not the query string. It never reaches the server,
  so a long session can't come back as an HTTP 414.
- **Only the session travels.** The receiving page supplies `assemblies` and
  `tracks`; a session naming a `trackId` the config lacks is dropped with a
  notification rather than failing the restore.
- **`views` still describes the starting state.** `session` only decides what
  opens now, so File → New session returns to `views`.
- **`encodeSession` does more than `getSnapshot`**: display settings a user
  picked up from a promoted display-type default live in their browser rather
  than the session, and it folds those in first — otherwise the link renders
  differently for whoever opens it.

The encoding is JBrowse Web's own, so links open in either. The save button has
to be yours — only your app knows the URL its page is served at; pass it as
`headerButtons` to land it where JBrowse Web puts Share.

To keep a session rather than share it, send the same snapshot to
`localStorage`; [onChange](../customizing-the-app/#with-on-change) tells you
when it changed.
