# @jbrowse/add-track-core

The file-format table the add-track guessers and the CLI both read — no
framework deps.

One entry per format: the filename regex that identifies it, the adapter type
and location field its config uses, and where its index or sidecar files sit.
`@jbrowse/core`'s `CorePlugin` turns an entry into the config the
`Core-guessAdapterForLocation` chain returns; `@jbrowse/cli`'s `add-track` turns
the same entry into a config plus the list of files to copy.

The track type to draw each adapter with is not in the table — it is
`trackTypes.generated.ts`, written from the `#trackType` tag on each adapter's
config schema by `scripts/generateTrackTypeMap.ts`. `pnpm autogen` regenerates
it and `--check` fails on drift.

Adding a format is one entry here plus the adapter itself. Nothing else claims
it: core guesses an entry only when `pluginManager.hasAdapterType` says the
build has that adapter, so whether a format is available follows from the
plugins loaded rather than from a list somebody has to remember to edit. A
format the table cannot express is still added the old way, with
`addAdapterGuesser` — those run later in the chain and win.

`products/jbrowse-web/src/addTrackFormats.test.ts` is the check over all of it:
one filename per entry, compared between the app's guesser chain and the CLI.

This package carries no dependencies on purpose: `npm i -g @jbrowse/cli` should
install a CLI, not a copy of the app.
