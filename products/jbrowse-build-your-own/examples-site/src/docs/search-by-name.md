The index is three files from `jbrowse text-index`. Each hit records the
`trackId` the index was built against, so the genes track here is `genes`. With
another id the view navigates and fails to show the track. `BRC` matches five
genes and none exactly, so JBrowse queues a dialog, and `EmbedProvider` prints a
line under the view for it.
