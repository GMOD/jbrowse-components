`createViewState` builds a MobX-state-tree instance — an expensive stateful
object that must not be rebuilt on every render, or each parent re-render throws
away the view's scroll position, open tracks and in-flight data.
`useCreateViewState` memoizes it for the component's lifetime, and
`<JBrowseLinearGenomeView viewState={state}>` renders it.

It takes the same options the managed
[`<LinearGenomeView>`](../setting-up-the-view/#with-init) takes, `init`
included, so choosing it costs no extra setup. It resolves the lazily loaded
view and display types the options name first, so it returns `undefined` for the
first frame and the component renders nothing until then; after that the engine
is a plain value in render, where a `ref` on that component is a `RefObject` to
read through. Two things need it: reading the view _while_ rendering (a button
of yours that depends on view state), and
[destroying the engine](../plugins/#with-external-plugin) when you discard it.

`location` is a shorthand for `init.loc` that also accepts a
`{ refName, start, end }` object (0-based), handier when you already have
structured coordinates than the 1-based locstring.
