Anything marked `#getter` or `#property` on the
[session model](https://jbrowse.org/jb2/docs/models/basesessionmodel/) or a
[view model](https://jbrowse.org/jb2/docs/models/lineargenomeview/) is reactive.
To save the session, `getSessionSnapshot(viewState)` returns it as plain JSON to
pass back as the `session` option. Outside React, `createApp` takes
`onSessionChange`, which fires with that snapshot as the user changes the
layout, beside `onLocationChange` and `onFeatureSelect`.
