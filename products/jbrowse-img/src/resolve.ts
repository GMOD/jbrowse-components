import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Module } from 'node:module'

// The two ESM resolve rewrites this CLI needs, both fixing resolutions that
// bundlers do for free and raw `node` does not. bin.ts installs them as
// synchronous in-thread hooks before the heavy module graph loads;
// integrationResolve.mjs wraps the same two for the node:test loader thread,
// which needs the async hook signature.

// (1) @mui/material's `internal/Transition.mjs` deep-imports the bare subpath
// `react-transition-group/TransitionGroupContext`. That subpath is a directory
// holding only a legacy `package.json` ("main"/"module", no "exports" map), so
// Node's ESM loader rejects it with ERR_UNSUPPORTED_DIR_IMPORT. Rewrite the
// react-transition-group subpath dirs to their real ESM file, resolved relative
// to the importer so each installed copy keeps its own colocated package.
export function transitionGroup(specifier: string) {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m ? `react-transition-group/esm/${m[1]}.js` : specifier
}

// (2) In the workspace, the @jbrowse/* packages point their `exports` map
// straight at source — `"./util": "./src/util/index.ts"` — and swap in
// `esm/*.js` only through `publishConfig.exports` at pack time. So running this
// CLI from source drags in ~390 genuine React `.tsx` files (174 in core, 107 in
// linear-genome-view, ...). `node --experimental-strip-types` erases types but
// does not transform JSX, and there is no flag that makes it, so those files
// are unloadable by raw node however they are named — which is why running from
// source needed tsx at all.
//
// Point the dependency packages at their built output instead. That is the
// graph an installed jb2export loads anyway (publishConfig.exports), so it is
// the shipped behavior rather than an approximation of it, and it leaves node
// with nothing but `.ts` to strip.
//
// jbrowse-img's own src is deliberately NOT redirected: it is pure `.ts`, so
// node strips it in place and a local edit is live with no rebuild.
// The node_modules exclusion keeps this to workspace source: a published
// install resolves to `esm/*.js` already, so nothing matches there, and a
// dependency that happens to ship .ts under a `products/`-shaped path must not
// be dragged into the redirect (it would hit the throw below).
const SRC_PATH =
  /^(file:\/\/(?!.*\/node_modules\/).*\/((?:packages|plugins|products)\/(?!jbrowse-img\/)[^/]+))\/src\/(.+)\.tsx?$/

// Packages already reported stale, so the mtime pair is compared once per
// package rather than once per module.
const staleReported = new Set<string>()

// The redirect's two failure modes, both of which otherwise present as
// something other than what they are.
//
// Missing esm/ is fatal: left alone it surfaces as ERR_MODULE_NOT_FOUND naming
// a path the user never wrote.
//
// STALE esm/ only warns. It is the more dangerous of the two — a figure or a
// test renders old plugin code and looks entirely correct — but it cannot be
// fatal, because `tsc --build` is incremental and legitimately leaves an
// unchanged module's output older than a src file whose mtime moved (a branch
// switch, a checkout). Failing there would demand a rebuild that then changes
// nothing. A warning names the package, which is enough to explain a figure
// that didn't pick up a change.
export function builtUrl(url: string) {
  const m = SRC_PATH.exec(url)
  if (!m) {
    return undefined
  }
  const [, pkgUrl, pkgName, modulePath] = m
  const built = `${pkgUrl}/esm/${modulePath}.js`
  let builtStat
  try {
    builtStat = statSync(fileURLToPath(built))
  } catch {
    throw new Error(
      `jb2export: ${fileURLToPath(built)} is missing — run \`pnpm build\` at the repo root before running this CLI from source`,
    )
  }
  if (!staleReported.has(pkgName!)) {
    if (statSync(fileURLToPath(url)).mtimeMs > builtStat.mtimeMs) {
      staleReported.add(pkgName!)
      console.warn(
        `jb2export: ${pkgName}/src is newer than its esm/ — run \`pnpm build\` if a recent change is missing from this render`,
      )
    }
  }
  return built
}

// The stale case arriving as a hard failure: one built module importing another
// that its own esm/ does not have, which means the two were emitted from
// different commits. Node reports that as a missing path nobody wrote, two hops
// from its cause, so name it.
//
// `--force`, not a plain rebuild, because this is the state an incremental one
// cannot leave: tsc's up-to-date check reads .tsbuildinfo rather than the output
// tree, so it calls a project with a deleted output up to date and emits
// nothing. A forced whole-workspace esm build is ~25s.
const ESM_PATH =
  /^file:\/\/(?!.*\/node_modules\/).*\/(?:packages|plugins|products)\/[^/]+\/esm\//

export function staleEsmImport(specifier: string, parentURL?: string) {
  return parentURL && ESM_PATH.test(parentURL)
    ? new Error(
        `jb2export: ${parentURL} imports ${specifier}, which is not in that package's esm/ — that esm/ is inconsistent with its source, run \`pnpm build:esm --force\` at the repo root`,
      )
    : undefined
}

export const resolve: Module.ResolveHookSync = (
  specifier,
  context,
  nextResolve,
) => {
  let resolved
  try {
    resolved = nextResolve(transitionGroup(specifier), context)
  } catch (e) {
    throw staleEsmImport(specifier, context.parentURL) ?? e
  }
  const built = builtUrl(resolved.url)
  return built ? { ...resolved, url: built } : resolved
}
