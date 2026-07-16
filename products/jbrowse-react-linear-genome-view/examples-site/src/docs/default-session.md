A _session_ is JBrowse's runtime representation of "what's open" — which views,
which tracks, which display settings. Passing `defaultSession` to
`createViewState` restores that state on first paint.

```js
const defaultSession = {
  name: 'My session',
  view: {
    id: 'linearGenomeView',
    type: 'LinearGenomeView',
    tracks: [
      // open tracks, in render order
    ],
  },
}
```

Each entry in `tracks` references a track configuration plus the display(s) you
want active. The `configuration` strings are the `trackId` (or `displayId`) of
the matching entry in `tracks` / its `displays` array:

```js
{
  type: 'ReferenceSequenceTrack',
  configuration: 'GRCh38-ReferenceSequenceTrack',
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      configuration:
        'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
    },
  ],
}
```

For most use cases the declarative [`init`](../setting-up-the-view/#with-init) field is easier to
author by hand. Reach for the full `defaultSession` when you need finer control
over per-track display settings, or when you're round-tripping a session
exported from JBrowse Web.

### Exporting from JBrowse Web

The fastest way to get a working `defaultSession` is to build the view
graphically in JBrowse Web, use **File → Export session** to download a
`session.json`, then pull out the view:

```js
import sessionJson from './session.json'

const defaultSession = {
  name: 'My session',
  view: sessionJson.session.views[0],
}
```

This avoids hand-authoring the deeply-nested track/display tree. The exact
fields available come from the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/).
