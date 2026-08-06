`createViewState` builds a MobX-state-tree instance — an expensive stateful
object that must not be rebuilt on every render, or each parent re-render throws
away the view's scroll position, open tracks and in-flight data.
`useCreateViewState` memoizes it for the component's lifetime, and
`<JBrowseLinearGenomeView viewState={state}>` renders it.

`location` is the hook-form equivalent of `init.loc`. It takes a locstring
(`'ctgA:1,000..5,000'`, 1-based) or a `{ refName, start, end }` object
(0-based), which is handier when you already have structured coordinates.

Calling `createViewState` yourself works the same wrapped in
`useState(() => …)`. To skip it entirely, the managed
[`<LinearGenomeView>`](../setting-up-the-view/#with-init) owns the engine for
you.
