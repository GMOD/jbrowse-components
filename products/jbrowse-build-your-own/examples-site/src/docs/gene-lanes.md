The twelve genomes go to `assemblies`, and the view opens on the first. The
ortholog display and its adapter come from two comparative plugins, which
`plugins` adds to the linear view's own set.

A track written in full, with its `adapter` and `displays`, goes to
`useCreateViewState` unchanged, so an existing `JBrowseLinearGenomeView` track
list moves over as it is. The `uri` shorthand expands only a track with no
`adapter`.
