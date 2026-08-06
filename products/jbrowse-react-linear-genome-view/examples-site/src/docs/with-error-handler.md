The embedded view ships no error boundary, so catching errors is the host app's
job. There are two kinds:

- **construction** — `createViewState` validates the config and can throw a
  (verbose) `@jbrowse/mobx-state-tree` error. Wrap the call in try/catch.
- **runtime** — observable at `viewState.session.view.error`. An `observer` can
  render your own UI when it becomes truthy.

For both, `ErrorBanner` from `@jbrowse/core/ui` is an error _display_ (not a
React error boundary): it formats JBrowse errors with a stack-trace button and,
for validation failures, the offending config snapshot. `ErrorMessage` is the
plain-text sibling.

This demo configures a `BadTrack` track type that fails validation, so the
banner has something real to render.
