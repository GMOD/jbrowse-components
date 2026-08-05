Two or more `JBrowseLinearGenomeView` instances can coexist on a page. Each gets
its own `viewState` from `createViewState`, and they share no navigation, tracks
or session state.

To make them track each other (linked panning, shared zoom), wire it up through
the state tree: wrap a sibling component in `observer` (the
[observe the visible view](../multiple-views/#observe-visible) example shows the
pattern), read one view's `bpPerPx`/`offsetPx`, and call the matching actions on
the other. The
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
list every property to read and action to call.
