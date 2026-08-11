`view.ready` is the gate every page here puts its tracks behind. It is
`!showLoading && !error`, so its `false` covers **two** states, and
`view.ready ? tracks : null` draws neither.

That shape is fine until a sequence file 404s. Then the box is empty and stays
empty, with no throw and no console error, because the failure is a state on the
model. Pick the third radio above; the fix is the `else` branch.

Read `view.error` **before** `view.loadingMessage`. The message goes `undefined`
when the load stops, whether it stopped by finishing or by failing, so an error
checked second is one the loading branch has already painted over.
`view.loadingProgress` is a 0..1 fraction, present only when the download
reported a Content-Length — draw an indeterminate bar when it is missing rather
than a bar at zero.

No retry, unlike the per-track error bar on the
[Removing Material UI](../removing-material-ui/) page: a view-level failure is a
bad URL or a bad config, so it needs reporting rather than re-attempting.

## The channel that isn't on the view

`session.snackbarMessages` is where JBrowse puts what it has to survive rather
than throw: `showTrack` with an id that isn't in the config,
`addSessionTrackConf` with a config that won't validate, an `init.loc` that
doesn't resolve. `showTrack` returns `undefined` and reports the reason here, so
a host that never reads the array shows a ticked checkbox and a track that never
arrives.

Draw the newest and `popSnackbarMessage()` it back off, as JBrowse's own
snackbar does. Mapping the array is the version that looks better and breaks: a
message carrying actions is never deduped, so identical text gives you no stable
key. Info and success expire after five seconds; warnings and errors do not.
