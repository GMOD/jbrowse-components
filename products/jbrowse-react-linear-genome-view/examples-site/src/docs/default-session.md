A _session_ is JBrowse's runtime representation of "what's open": which views,
which tracks, which display settings. `defaultSession` restores one on first
paint. Each entry in `view.tracks` names a track config and the display(s) to
activate, by `trackId` / `displayId`.

For most embeds the declarative [`init`](../setting-up-the-view/#with-init)
field is far easier to author. Reach for `defaultSession` when you need
per-track display settings init can't express, or when you're round-tripping a
session out of JBrowse Web.

The fastest way to get one is to build the view graphically in JBrowse Web, use
**File → Export session**, and lift the view out of the download:

```js
import sessionJson from './session.json'

const defaultSession = {
  name: 'My session',
  view: sessionJson.session.views[0],
}
```

The available fields come from the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
