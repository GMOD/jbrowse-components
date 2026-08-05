import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ESM resolve hooks for the integration tests (see integrationRegister.mjs).
// Hand-authored .mjs on purpose: the loader thread reads this file directly, so
// it cannot be a `.ts` that something else has to strip first.
//
// Kept in sync with src/resolve.ts, which does the same two rewrites for the
// `jb2export` binary. See that file for the full reasoning.

// (1) @mui/material's `internal/Transition.mjs` deep-imports the bare subpath
// `react-transition-group/TransitionGroupContext`, a directory holding only a
// legacy `package.json` ("main"/"module", no "exports" map) that Node's ESM
// loader rejects. Rewrite it to the real ESM file, resolved relative to the
// importer so each pnpm copy keeps its own colocated react-transition-group.
function transitionGroup(specifier) {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m ? `react-transition-group/esm/${m[1]}.js` : specifier
}

// (2) The workspace @jbrowse/* packages export source (`./src/util/index.ts`)
// and only swap in `esm/*.js` via publishConfig at pack time, so the graph
// carries hundreds of real React `.tsx` files. Node strips types but does not
// transform JSX, so redirect the dependency packages to their built output —
// the same graph an installed jb2export loads. jbrowse-img's own src stays on
// source: it is pure `.ts`, so a local edit is live with no rebuild.
// The node_modules exclusion keeps this to workspace source; see resolve.ts.
const SRC_PATH =
  /^(file:\/\/(?!.*\/node_modules\/).*\/(?:packages|plugins|products)\/(?!jbrowse-img\/)[^/]+)\/src\/(.+)\.tsx?$/

function builtUrl(url) {
  const m = SRC_PATH.exec(url)
  if (!m) {
    return undefined
  }
  const built = `${m[1]}/esm/${m[2]}.js`
  if (!existsSync(fileURLToPath(built))) {
    throw new Error(
      `${fileURLToPath(built)} is missing — run \`pnpm build\` at the repo root before running the integration tests`,
    )
  }
  return built
}

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(transitionGroup(specifier), context)
  const built = builtUrl(resolved.url)
  return built ? { ...resolved, url: built } : resolved
}
