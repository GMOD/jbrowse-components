`view.ready` is the gate every page here puts its tracks behind. It is
`!showLoading && !error`, so its `false` covers **two** states, and
`view.ready ? tracks : null` draws neither.

That shape is fine until a sequence file 404s. Then the box stays empty, with no
throw and no console error: the failure is a state on the model. Pick the third
radio; the fix is the `else` branch.

Read `view.error` **before** `view.loadingMessage`. The message goes `undefined`
once the load stops, however it stopped, so an error checked second is one the
loading branch has already painted over. `view.loadingProgress` is a 0..1
fraction, present only when the download reported a Content-Length — draw an
indeterminate bar when it is missing, not one at zero.

No retry, unlike the per-track error bar on
[Removing Material UI](../removing-material-ui/): a view-level failure is a bad
URL or config, not a flaky fetch.

## The channel that isn't on the view

`session.snackbarMessages` is where JBrowse reports what it survives rather than
throws: `showTrack` with an id that isn't in the config, `addSessionTrackConf`
with a config that won't validate, an `init.loc` that doesn't resolve.
`showTrack` returns `undefined` and reports the reason here, so a host that
never reads it shows a ticked checkbox and no track.

Draw the newest and `popSnackbarMessage()` it back off, as JBrowse's own
snackbar does. Mapping the array looks better and breaks: a message carrying
actions is never deduped, so identical text gives no stable key. Info and
success expire after five seconds; warnings and errors do not.

## Throwing one away

Each radio builds a fresh engine; unmounting the old one's component does not
stop it. `destroyViewState(state)` ends its autoruns and worker threads. Call it
where you discard the engine — an effect cleanup runs on a live one under
StrictMode.
