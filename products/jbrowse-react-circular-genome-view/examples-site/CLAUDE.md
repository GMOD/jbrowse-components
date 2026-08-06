# examples-site

Shared doctrine for all four examples sites — the copy-pasteable-file rule, the
prose caps, `demoHeights.json`, the CI wiring — is
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
**Read it before adding a page or refactoring an example.** This file is only
what is local here.

The published package an example may import from is
`@jbrowse/react-circular-genome-view2`.

The relative-import grep returns nothing at all here — this site takes not even
the bulk-data exception, and it should stay that way.
