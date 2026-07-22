// Fails when an emitted `.d.ts` names a *source* path of another workspace
// package, e.g. `import("@jbrowse/plugin-canvas/src/…/hitTesting.ts").FooType`.
// Published tarballs ship `esm/`, not `src/`, so those specifiers don't resolve
// for consumers and surface as errors unless they set `skipLibCheck` (see
// https://github.com/GMOD/jbrowse-components/issues/4678).
//
// It happens when tsc infers a type whose declaring file isn't reachable from
// the dependency's entry: with no exported name to reach it, tsc falls back to
// serializing the file path. The fix is always to re-export the type from that
// package's entry `index.ts`.
//
// Run after `pnpm build:esm`. `KNOWN` is a shrinking baseline, not a config
// knob — entries come off it, never on.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'plugins', 'products', 'example-plugins']

// Packages whose non-entry types are still leaked, with the count of distinct
// leaked symbols. Drive these to zero by re-exporting the types from each
// package's entry; delete the entry once it's gone.
const KNOWN = new Map([
  ['@jbrowse/plugin-alignments', 20],
  ['@jbrowse/plugin-canvas', 12],
  ['@jbrowse/plugin-spreadsheet-view', 2],
  ['@jbrowse/plugin-wiggle', 2],
])

const leak = /@jbrowse\/[a-z0-9-]+\/src\/[^"']+/g

function* declarationFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      yield* declarationFiles(path)
    } else if (entry.endsWith('.d.ts')) {
      yield path
    }
  }
}

// leaked package name -> specifiers -> files naming them
const found = new Map<string, Map<string, Set<string>>>()
for (const workspaceDir of workspaceDirs) {
  for (const entry of readdirSync(join(root, workspaceDir))) {
    const esm = join(root, workspaceDir, entry, 'esm')
    try {
      statSync(esm)
    } catch {
      continue // not built, or not a package that emits esm
    }
    for (const file of declarationFiles(esm)) {
      for (const specifier of readFileSync(file, 'utf8').matchAll(leak)) {
        const [, pkg] = /^(@jbrowse\/[a-z0-9-]+)\//.exec(specifier[0])!
        const bySpecifier = found.get(pkg!) ?? new Map<string, Set<string>>()
        const files = bySpecifier.get(specifier[0]) ?? new Set<string>()
        files.add(relative(root, file))
        bySpecifier.set(specifier[0], files)
        found.set(pkg!, bySpecifier)
      }
    }
  }
}

const problems: string[] = []
for (const [pkg, bySpecifier] of [...found].sort()) {
  const budget = KNOWN.get(pkg) ?? 0
  if (bySpecifier.size > budget) {
    problems.push(
      `${pkg}: ${bySpecifier.size} leaked source specifier(s), budget ${budget}\n` +
        [...bySpecifier]
          .sort()
          .map(
            ([s, files]) =>
              `    ${s}\n      named by ${[...files].sort().join(', ')}`,
          )
          .join('\n'),
    )
  }
}

// A budget nobody spends is a budget that should be deleted.
for (const [pkg, budget] of KNOWN) {
  const actual = found.get(pkg)?.size ?? 0
  if (actual < budget) {
    problems.push(
      `${pkg}: leaks are down to ${actual} (budget ${budget}) — lower or remove its entry in KNOWN in ${relative(root, import.meta.filename)}`,
    )
  }
}

if (problems.length > 0) {
  console.error(
    `Emitted .d.ts files name workspace source paths that published tarballs don't ship.\nRe-export the type from the owning package's entry index.ts.\n\n${problems.join('\n\n')}\n`,
  )
  process.exit(1)
}

console.log('No new source-path leaks in emitted .d.ts')
