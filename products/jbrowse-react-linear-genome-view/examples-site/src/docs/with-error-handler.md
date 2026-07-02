The embedded view does not ship with a built-in error boundary, so catching
errors is the host application's responsibility. There are two classes of error:

- **Construction errors** — `createViewState` validates the configuration and
  can throw a (sometimes verbose) `@jbrowse/mobx-state-tree` error. Wrap the
  call in try/catch.
- **Runtime errors** — observable on `viewState.session.view.error`. An
  `observer` component can render an error UI when this becomes truthy.

For both cases we recommend the `ErrorBanner` component from `@jbrowse/core/ui`
(an error _display_, not a React error boundary) — it formats JBrowse errors
with helpful context, adding a stack-trace button and, for `createViewState`
validation failures, the offending config snapshot. Its plainer sibling
`ErrorMessage` renders just the message text.

This example wraps [`createViewState`](../use-create-view-state/) in a
try/catch, configures a `BadTrack` track type that fails validation, and renders
the caught error with `ErrorBanner`.
