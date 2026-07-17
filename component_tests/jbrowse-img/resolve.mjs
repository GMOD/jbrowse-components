// ESM resolve/load hooks for the packed-@jbrowse/img component test.
//
// @mui/material's `internal/Transition.mjs` deep-imports the bare subpath
// `react-transition-group/TransitionGroupContext`. That subpath is a directory
// holding only a legacy `package.json` ("main"/"module", no "exports" map), so
// Node's ESM loader rejects it with ERR_UNSUPPORTED_DIR_IMPORT. Bundlers
// (webpack/vite/jest) resolve it fine; raw `node run.mjs` does not. Rewrite the
// react-transition-group subpath dirs to their real ESM file, resolved relative
// to the importer so each pnpm/yarn copy keeps its own colocated package.
export async function resolve(specifier, context, nextResolve) {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m
    ? nextResolve(`react-transition-group/esm/${m[1]}.js`, context)
    : nextResolve(specifier, context)
}

// @jbrowse/react-app2's barrel side-effect imports dockview-react's CSS for
// browser bundles. Bundlers strip/inline it; Node's ESM loader has no CSS
// support and throws ERR_UNKNOWN_FILE_EXTENSION. jb2export is headless (no
// dockview panel is ever rendered), so the stylesheet is a no-op here - short
// circuit it to an empty module instead of loading the file.
export async function load(url, context, nextLoad) {
  return url.endsWith('.css')
    ? { format: 'module', source: '', shortCircuit: true }
    : nextLoad(url, context)
}
