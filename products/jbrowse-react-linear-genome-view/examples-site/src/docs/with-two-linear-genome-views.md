Two or more `JBrowseLinearGenomeView` instances can coexist on a single page —
each gets its own `viewState` from `createViewState`, and they share no
navigation, tracks, or session state. Useful for side-by-side locus comparisons,
multi-assembly dashboards, or report-style layouts with several small views.

If you need the two views to track each other (linked panning, shared zoom),
wire it up yourself via the MobX state tree: wrap a sibling component in
`observer` (the [observe the visible view](../observe-visible/)
example shows this pattern), read one view's `bpPerPx`/`offsetPx`, and call the
matching actions on the other. Both `viewState` objects are ordinary state-tree
nodes, so anything one view exposes can be mirrored onto another — see the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
for every property to read and action to call.
