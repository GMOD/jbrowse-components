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
// Run after `pnpm build:esm`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'plugins', 'products', 'example-plugins']
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

// leaked specifier -> declaration files naming it
const found = new Map<string, Set<string>>()
for (const workspaceDir of workspaceDirs) {
  for (const entry of readdirSync(join(root, workspaceDir))) {
    const esm = join(root, workspaceDir, entry, 'esm')
    try {
      statSync(esm)
    } catch {
      continue // not built, or not a package that emits esm
    }
    for (const file of declarationFiles(esm)) {
      for (const [specifier] of readFileSync(file, 'utf8').matchAll(leak)) {
        const files = found.get(specifier) ?? new Set<string>()
        files.add(relative(root, file))
        found.set(specifier, files)
      }
    }
  }
}

if (found.size > 0) {
  const detail = [...found]
    .sort()
    .map(([s, files]) => `  ${s}\n    named by ${[...files].sort().join(', ')}`)
    .join('\n')
  console.error(
    `Emitted .d.ts files name workspace source paths that published tarballs don't ship.\nRe-export the type from the owning package's entry index.ts.\n\n${detail}\n`,
  )
  process.exit(1)
}

console.log('No source-path leaks in emitted .d.ts')
