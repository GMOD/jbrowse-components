---
name: add-track-core
description: One source of truth for adapter guessing, across the add-track paths that each carry their own.
---

# packages/add-track-core

A minimal shared package (zero external deps) for adapter guessing logic, so the CLI and the
plugins don't duplicate file-extension → adapter-type and adapter-type → track-type mappings.

The CLI's `guessAdapter`/`guessFileNames`/`adapterTypesToTrackTypeMap` in
`products/jbrowse-cli/src/commands/add-track-utils/adapter-utils.ts` and the plugins'
`Core-guessAdapterForLocation` / `Core-guessTrackTypeForLocation` extension points both encode
the same knowledge. When a new adapter is added the list must be updated in both places, which
is how bugs creep in (e.g. missing BedGraphTabixAdapter, unescaped regex dots).

A shared package would centralize at least the mappings (regex constants, type maps). The CLI
flat-function path and the plugin extension-point path could remain separate consumers; they
just import from one source of truth.

Motivation: avoid CLI depending directly on `packages/core`, and eliminate the duplication
that causes drift bugs.
