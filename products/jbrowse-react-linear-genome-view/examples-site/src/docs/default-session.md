A _session_ is JBrowse's runtime representation of "what's open": which views,
which tracks, which display settings. `defaultSession` restores one on first
paint. Each entry in `view.tracks` names a track config, and each display under
it names its display config by `configuration`.

**Display settings themselves do not go on those session display nodes.** A
session node is built by the display's _state model_, while nearly every setting
— `height`, `color`, `colorBy` — is a config slot, so a slot name written there
is dropped exactly like a misspelling: the session loads, the track appears, and
the setting silently does nothing. Put it on the track's own `displays` entry,
or use [`displaySnapshot`](../session-setup/#with-init-advanced) on an
`init.tracks` entry, which routes slots onto the display config for you.
`jbrowse validate` reports the wrong side of this.

For most embeds the declarative [`init`](../setting-up-the-view/#with-init)
field is easier to author anyway. Reach for `defaultSession` when you're
round-tripping a session out of JBrowse Web.

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
