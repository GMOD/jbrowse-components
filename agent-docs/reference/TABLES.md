---
name: tables
description: "@jbrowse/tables — a display's data as columnar tables for a host that draws it (R through V8 in ggjbrowse): the contract, the bare-host bundle, and the downstream canary keeping ggjbrowse, JBrowseR and jbrowse-anywidget current."
audience: internal
kind: spec
---

# @jbrowse/tables

A display's data as tables, for a host that draws it with its own graphics
system: the alignments display's reads on their pileup rows, with their
mismatches, gaps and coverage, each as columns (one array per field), which R
reads as data frames. [ggjbrowse](https://github.com/GMOD/ggjbrowse) is the R
package on it; ggbandage and ggtubemap do the same over bandage-core and
tubemap-core.

## Why tables and not a translator

The R exporter ([R_EXPORT.md](R_EXPORT.md)) re-derives the browser's rules in
R: a BigBed parser, the BED12 transcript shape, MAPQ bins, the category hash,
the insert-size band, the pileup packing, the mismatch walk. Two adversarial
reviews found nearly every bug in one of those copies drifting from the
browser. A table is the browser's own answer, so that class of bug cannot
happen. On volvox ctgA the alignments table's reads, rows and mismatches equal
the exporter's hand-written R exactly, and a CRAM gives the tables its BAM
gives, with no samtools.

## Publishing

`@jbrowse/tables` is `private` until its first publish. A name npm has never
seen cannot publish through the trusted-publisher (OIDC) path `publish.yml`
uses, so a public package here would stop `pnpm publish -r` partway through
the next release tag. The first publish is by hand, followed by the trusted
publisher setup; then drop `private`. Its npm tarball carries
`dist/jbrowse-tables.js`, so ggjbrowse can take a release from npm rather than
build one.

## The contract

Each table lives in the plugin whose code computes it, exported on a subpath:
`@jbrowse/plugin-alignments/tables` (`alignmentTables`,
`registerAlignmentsAdapters`), and `@jbrowse/plugin-sequence/adapters` for the
reference. A table function takes a plugin manager holding the adapters, so it
needs none of the plugin's displays, React or MobX state. Coordinates are
0-based genomic; a `read` column is a 0-based index into `reads`. A
mismatch's `frequency` is its base's count over the depth there, not the
worker's `mismatchFrequencies`, which is a display fade zeroed below a
depth-dependent threshold. A region over `byteLimit` (200 MB of compressed
alignments by default) is refused off the index with an error naming the
size, since a host holds the whole table in memory.
`@jbrowse/tables` composes them (`createTablesEngine`) and serves the colors a
host should draw in (`alignmentColors`), read off the palette rather than
copied.

The field names are an external contract once ggjbrowse reads them: renaming
one breaks a downstream repo with no compiler between them, which is what the
downstream canary is for.

## The bare-host bundle

`pnpm build:bundle` writes `dist/jbrowse-tables.js`, one IIFE with no imports.
`src/bareHost.ts` installs what the readers need of `fetch`, `TextDecoder`,
`URL`, `Headers`, `AbortController` and the timers, and answers every byte
range through the host's synchronous `jbrowseHost.readRange(url, start, end)`.

- **A timer with a delay never fires.** There is no event loop; the only
  delayed timers on this path are deadlines guarding a request that has
  already answered.
- **`fetch` is replaced even where the host has one**, so Node or Deno still
  reads every byte through `readRange`; the other globals are installed only
  where missing. A range starting past the end of a file answers 416, as a
  server does: a 206 naming an end before its start is refused by the range
  cache.
- **`TextDecoder` follows the WHATWG UTF-8 decoder**, U+FFFD and `fatal`
  included, and `bareHost.test.ts` holds it to Node's on random bytes. A
  decoder that threw on a byte past 0xF7, or swallowed the newline after a
  Latin-1 byte, read a text header wrong.
- **`sideEffects` names `hostGlobals.*` and `bundle.*`.** With `false`,
  esbuild drops the side-effect import that installs the globals, and core's
  `featureTable.ts` reads `TextDecoder` at load.
- **The test that matters runs the bundle in an empty `node:vm` context**,
  which has no web globals, as V8 in R has none (`bundle.test.ts`). A shim
  removed turns it red.

## Hooks: who notices a break

Downstream repos build against a jbrowse-components checkout beside them and
commit what they build, so a change here fires no event there.

- **Each downstream repo keeps its checks in one script of its own**,
  `check-against-jbrowse.sh` under its `scripts/` (ggjbrowse, JBrowseR,
  jbrowse-anywidget), which its own CI runs too.
- **`.github/workflows/downstream-canary.yml`** runs each of those scripts
  against this commit, nightly and on a `v*` tag, with this checkout and the
  downstream repo side by side under the workspace. A red run names the repo
  this commit broke. It goes red for any repo whose main lacks the script,
  and for ggjbrowse until that repo exists on GitHub.
- **ggjbrowse takes each `@jbrowse/tables` release from npm** into its
  committed bundle once R CMD check passes (its Bundle workflow), so nothing
  here has to tell it a release happened.
- ggbandage and ggtubemap follow bandage-core and tubemap-core, not this repo;
  their upstreams are where the same canary would go.
