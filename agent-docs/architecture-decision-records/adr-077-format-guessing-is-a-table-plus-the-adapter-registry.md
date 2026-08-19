---
status: Accepted
summary: "One format table both the app and the CLI read, and the adapter registry — not a per-plugin registration — decides whether a build can open a format"
---

# ADR-077: Format guessing is a table plus the adapter registry

## Status

Accepted (2026-08). The table is `packages/add-track-core`; the guesser is
`installFormatGuessers` in `packages/core/src/util/formatGuessers.ts`.

## Context

Twelve plugins each registered a guesser on `Core-guessAdapterForLocation`
spelling out a filename regex, an adapter type and a location field, and
`@jbrowse/cli` carried the same knowledge again as a table, because the CLI has
no `@jbrowse/core` dependency and cannot fire an extension point.

Thirteen copies of one map, and no check comparing any two. They had drifted in
every direction:

- **App only**: `.fas`, `.bedmethyl.gz` → `MultiQuantitativeTrack`,
  `StarFusionAdapter`, `GWASAdapter`, the two PLINK LD adapters.
- **CLI only**: `.bed.bgz`, `.bg.bgz`, `.pif.bgz` — the CLI wrote `b?gz`
  throughout and the plugins wrote `gz`.
- **Wrong in both**: `rdf` tested `/\/sparql$/i` against `getFileName()`, which
  returns a basename, so SPARQL never guessed except by an explicit hint; the
  CLI wrote SPARQL's `endpoint` as a bare string into a `fileLocation` slot; five
  comparative regexes wrote `(.gz)?` with an unescaped dot; `.h5` guessed
  `LdmatAdapter`, which no plugin registers.

None of that was visible. A guesser that declines returns `undefined` and the
chain moves on, so a missing format and an unsupported one are the same
observation.

## Decision

**One table, `@jbrowse/add-track-core`** — filename regex, adapter type,
location field, index and sidecar layout — with no dependencies, so the CLI reads
it without pulling in the app. `@jbrowse/core` turns an entry into an adapter
config and the CLI turns the same entry into a config plus the files to copy.

**`CorePlugin` installs a single guesser over the whole table, gated on
`pluginManager.hasAdapterType`.** No plugin registers a format. Whether a build
can open a `.bam` follows from the alignments plugin being loaded, which is the
fact itself rather than a restatement of it.

**The track type comes from the `#trackType` tag on each adapter's config
schema**, generated into `trackTypes.generated.ts` by
`scripts/generateTrackTypeMap.ts`. The tag already drove the "Supported file
types" doc table; the guessers' copy was a fourth hand-written map.

## Consequences

- Adding a format is one table entry plus the adapter. There is no list to
  remember to update, which is what the previous shape had no forcing function
  for.
- `addAdapterGuesser` and `addTrackTypeGuesser` are unchanged and still exported:
  a format the table cannot describe, and every third-party plugin, registers the
  same way as before. Those run after `CorePlugin`'s, so they win.
- **The table is now global first-match, where the chain was per-plugin.** That
  changes nothing today because no two plugins' regexes overlap, but a format
  whose adapter is absent no longer falls through to a lower-priority match — it
  guesses nothing, which is the honest answer.
- The generated map covers 52 adapters where the hand-written one covered 27, so
  `SplitVcfTabixAdapter`, `MultiWiggleAdapter`, `GCContentAdapter` and
  `HtsgetBamAdapter` stopped resolving to `FeatureTrack`.
- The CLI matches on the basename now, not the whole location string, so a
  presigned URL's query string no longer defeats every extension.
- Two hand-written switches still walk the `AdapterSpec` union — core's
  `adapterConfigFromSpec` and the CLI's `buildFromSpec`, which additionally
  probes the filesystem for the sidecars it copies.
  `products/jbrowse-web/src/addTrackFormats.test.ts` compares what each writes,
  one filename per table entry, because sharing the table does not make the two
  builders agree.
- General rule: where a capability is registered in one place and described in
  another, the registry is the source and the description should be gated on it.
  A parallel list of "who supports what" cannot be checked against anything.
