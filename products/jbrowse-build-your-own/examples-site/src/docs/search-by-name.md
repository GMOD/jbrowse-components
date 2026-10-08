The index is three files from `jbrowse text-index`. Each hit records the
`trackId` the index was built against, so the genes track here is `genes`: a
mismatched id still navigates, then fails to show the track. `BRC` matches five
genes and none exactly, so JBrowse queues a dialog. This page draws none, and
`EmbedProvider` says so under the view.
