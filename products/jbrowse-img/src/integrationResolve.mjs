// ESM resolve hook for the integration tests (see integrationRegister.mjs).
//
// @mui/material 9.1's `internal/Transition.mjs` deep-imports the bare subpath
// `react-transition-group/TransitionGroupContext`. That subpath is a directory
// holding only a legacy `package.json` ("main"/"module", no "exports" map).
// tsx's resolver doesn't honor a directory's main/module, so it probes for
// `TransitionGroupContext/index.jsx` and fails with ERR_MODULE_NOT_FOUND.
//
// Bundlers (webpack/vite/jest) resolve it fine, so this only bites the
// tsx-driven node:test runner. We rewrite the handful of react-transition-group
// subpath dirs to their real ESM file, resolved relative to the importer (so
// each pnpm copy keeps its own colocated react-transition-group).
export async function resolve(specifier, context, nextResolve) {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m
    ? nextResolve(`react-transition-group/esm/${m[1]}.js`, context)
    : nextResolve(specifier, context)
}
