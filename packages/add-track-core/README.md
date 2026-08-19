# @jbrowse/add-track-core

The file-format table the add-track guessers and the CLI both read — no
framework deps.

One entry per format: the filename regex that identifies it, the adapter type
and location field its config uses, where its index or sidecar files sit, and
the track type to draw it with. `@jbrowse/core`'s `CorePlugin` turns an entry
into the config the `Core-guessAdapterForLocation` chain returns;
`@jbrowse/cli`'s `add-track` turns the same entry into a config plus the list of
files to copy.

Adding a format is one entry here plus the adapter itself. Nothing else claims
it: core guesses an entry only when `pluginManager.hasAdapterType` says the
build has that adapter, so whether a format is available follows from the
plugins loaded rather than from a list somebody has to remember to edit. A
format the table cannot express is still added the old way, with
`addAdapterGuesser` — those run later in the chain and win.

This package carries no dependencies on purpose: `npm i -g @jbrowse/cli` should
install a CLI, not a copy of the app.
