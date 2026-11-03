import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Module } from 'node:module'

// integrationResolve.mjs wraps these same rewrites for the node:test loader
// thread.

// @mui deep-imports `react-transition-group/TransitionGroupContext`, a directory
// with no "exports" map, which Node's ESM loader rejects as a dir import.
export function transitionGroup(specifier: string) {
  const m = /^react-transition-group\/([A-Za-z]+)$/.exec(specifier)
  return m ? `react-transition-group/esm/${m[1]}.js` : specifier
}

// Workspace packages export their `src`, which holds `.tsx` that Node's type
// stripping cannot load, so they are pointed at their built `esm/`, as an
// installed jb2export resolves them. jbrowse-img's own src is pure `.ts` and
// stays live.
const SRC_PATH =
  /^(file:\/\/(?!.*\/node_modules\/).*\/((?:packages|plugins|products)\/(?!jbrowse-img\/)[^/]+))\/src\/(.+)\.tsx?$/

const staleReported = new Set<string>()

// A stale esm/ only warns: incremental `tsc --build` legitimately leaves an
// unchanged module's output older than its src after a checkout.
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

// An esm/ missing a module its own files import. `--force`, because tsc's
// up-to-date check reads .tsbuildinfo, not the output tree.
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
