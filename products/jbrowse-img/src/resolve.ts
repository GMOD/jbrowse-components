import type { Module } from 'node:module'

// ESM resolve hook installed by bin.ts before the heavy module graph loads.
//
// @mui/material's `internal/Transition.mjs` deep-imports the bare subpath
// `react-transition-group/TransitionGroupContext`. That subpath is a directory
// holding only a legacy `package.json` ("main"/"module", no "exports" map), so
// Node's ESM loader rejects it with ERR_UNSUPPORTED_DIR_IMPORT. Bundlers
// (webpack/vite/jest) resolve it fine; raw `node` does not. Rewrite the
// react-transition-group subpath dirs to their real ESM file, resolved relative
// to the importer so each installed copy keeps its own colocated package.
//
// Kept in sync with src/integrationResolve.mjs (the tsx-test equivalent, which
// must stay hand-authored .mjs so the loader thread can read it pre-build).
export const resolve: Module.ResolveHookSync = (
  specifier,
  context,
  nextResolve,
) => {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m
    ? nextResolve(`react-transition-group/esm/${m[1]}.js`, context)
    : nextResolve(specifier, context)
}
