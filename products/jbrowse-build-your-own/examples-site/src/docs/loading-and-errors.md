`view.status` is the view's lifecycle as one value, and the gate every page here
puts its tracks behind: `ready`, `loading` with `message` and `progress`,
`error` with `error`, and `noRegions`.

Switch on it rather than reading `view.error` and `view.loadingMessage`
separately: that message goes `undefined` once a load stops, however it stopped,
so an error checked second is one the loading branch has painted over. The third
radio breaks the assembly — a state on the model, so nothing throws. No retry: a
view-level failure is a bad URL, not the flaky fetch the
[per-track error bar](../removing-material-ui/) answers.

`progress` is a 0..1 fraction, present only when the download reported a
Content-Length — draw an indeterminate bar when it is missing, not one at zero.

`noRegions` means nothing has told the view where to look, and it is the one
state `view.ready` answers _ready_ to, so gating on that mounts tracks over an
empty view. The last radio withholds the location from `createViewState` to sit
in it, and its button leaves by handing the view an `init` blob through
`setInit`.

## The channel that isn't on the view

`session.snackbarMessages` is where JBrowse reports what it survives rather than
throws. `showTrack` with an id that isn't in the config returns `undefined` and
reports the reason here, so a host that never reads it shows a ticked checkbox
and no track.

Draw the newest and `popSnackbarMessage()` it back off; mapping the array gives
duplicates no stable key. Info and success expire after five seconds; warnings
and errors do not.

## Throwing one away

Unmounting an engine's component does not stop it. `destroyViewState(state)`
ends its autoruns and worker threads — call it where you discard one, not in an
effect cleanup, which StrictMode runs on a live engine.
