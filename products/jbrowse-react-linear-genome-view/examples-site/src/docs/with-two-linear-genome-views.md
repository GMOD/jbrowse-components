Two or more views coexist on a page. Each gets its own `viewState`, and they
share no navigation, tracks or session state.

To make them track each other — linked panning, shared zoom — wire it through
the state tree: wrap a sibling in `observer`
([the pattern](../multiple-views/#observe-visible)), read one view's
`bpPerPx`/`offsetPx`, and call the matching actions on the other.
