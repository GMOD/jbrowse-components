# examples-site

Shared doctrine for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
Local to this one:

The published package an example may import from is
`@jbrowse/react-circular-genome-view2`, plus `@jbrowse/core/util/hooks` in the
one example the product's own `useCreateViewState` cannot serve —
`SessionInUrl`, where whether there is an engine to build depends on the URL, so
it needs the bare `useCreateOnce` underneath instead.

The relative-import grep returns nothing at all here — this site takes not even
the bulk-data exception, and it should stay that way.
