// Fails when a module declaring an extension point is not reachable in its
// package's emitted type graph, so the `declare module
// '@jbrowse/core/PluginManager'` block inside it never loads for an installed
// consumer.
//
// A registry declaration only constrains a caller whose program already
// contains the file the block is written in. In tree that is invisible — one
// program holds everything. An external plugin's program holds only what it
// imports, and `addToExtensionPoint` then falls to its untyped overload and
// infers the callback's parameter from whatever the callback claims.
// jbrowse-plugin-apollo kept a `Core-extendWorker` callback typed against a
// `{ client, worker }` handle for months that way, and it typechecked clean the
// whole time — the shape was not unchecked, it *was* the check.
//
// **Why this reads the emitted `.d.ts` rather than `src/`.** The two disagree,
// and only the emitted one is what a consumer resolves. tsc keeps a module in
// the declarations only when the entry's public surface names it: core's
// `import type {}` side-effect imports survive because the augmentation targets
// `PluginManager` itself, but the same line in a plugin is elided, and a value
// import used inside `install()` is erased. Every `Launch*View` point in the
// tree was reached that second way and shipped untyped to exactly the plugins
// it exists for, while three points in linear-genome-view arrived only because
// their modules happen to export types the entry re-exports. Source-level
// reachability tracks which modules a consumer pulls in for other reasons, not
// which points are plugin-facing — which is the same confusion the untyped
// overload makes.
//
// The fix is always to re-export a name from that module in the package's entry
// `index.ts`, the same fix `check-declaration-leaks.ts` prescribes.
//
// Run after `pnpm build:esm`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = join(import.meta.dirname, '..')
const workspaceDirs = ['packages', 'plugins', 'products']

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

function declaresExtensionPoint(file: string) {
  const source = readFileSync(file, 'utf8')
  return (
    source.includes('interface ExtensionPointRegistry') &&
    /declare module ['"](?:@jbrowse\/core\/PluginManager|\.[^'"]*PluginManager)/.test(
      source,
    )
  )
}

// Every relative specifier a declaration names, in any position that carries
// the module into the consumer's program: a bare side-effect import, a re-export,
// and the `import('./x')` form tsc writes for an inferred type.
function specifiers(file: string) {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /(?:from\s*|^\s*import\s*|import\()\s*['"](\.[^'"]+)['"]/gm,
    ),
  ].map(m => m[1]!)
}

function resolveDeclaration(from: string, specifier: string) {
  const base = resolve(dirname(from), specifier)
    .replace(/\.tsx?$/, '')
    .replace(/\.js$/, '')
  return [`${base}.d.ts`, join(base, 'index.d.ts')].find(candidate =>
    existsSync(candidate),
  )
}

function reachableFrom(entry: string) {
  const seen = new Set<string>()
  const stack = [entry]
  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    for (const specifier of specifiers(file)) {
      const resolved = resolveDeclaration(file, specifier)
      if (resolved !== undefined && !seen.has(resolved)) {
        stack.push(resolved)
      }
    }
  }
  return seen
}

// package -> the declaring modules its entry does not carry
const unreachable = new Map<string, string[]>()
let declaringTotal = 0

for (const workspaceDir of workspaceDirs) {
  for (const name of readdirSync(join(root, workspaceDir))) {
    const esm = join(root, workspaceDir, name, 'esm')
    if (!existsSync(esm) || !statSync(esm).isDirectory()) {
      continue // not built, or not a package that emits esm
    }
    const declaring = [...declarationFiles(esm)].filter(declaresExtensionPoint)
    if (declaring.length === 0) {
      continue
    }
    declaringTotal += declaring.length
    // Core has no entry index; every plugin's `install` takes a PluginManager,
    // so that declaration is the one core can be sure a consumer's program holds.
    const entry = ['index.d.ts', 'PluginManager.d.ts']
      .map(f => join(esm, f))
      .find(f => existsSync(f))
    const pkg = `${workspaceDir}/${name}`
    if (entry === undefined) {
      unreachable.set(pkg, ['no esm/index.d.ts to carry them'])
      continue
    }
    const reachable = reachableFrom(entry)
    const missing = declaring
      .filter(file => file !== entry && !reachable.has(file))
      .map(file => relative(esm, file))
    if (missing.length > 0) {
      unreachable.set(pkg, missing)
    }
  }
}

if (declaringTotal === 0) {
  console.error(
    'No extension-point declarations found in any esm/ — run `pnpm build:esm` first.',
  )
  process.exit(1)
}

if (unreachable.size > 0) {
  const detail = [...unreachable]
    .sort()
    .map(([pkg, files]) => `  ${pkg}\n    ${files.sort().join('\n    ')}`)
    .join('\n')
  console.error(
    `Extension points declared in modules an installed consumer's program never loads.\n` +
      `\`addToExtensionPoint\` is untyped for them: the callback's parameter is inferred\n` +
      `from whatever the callback claims, so a wrong shape defines the check instead of\n` +
      `failing it. Re-export a name from each module in its package's entry index.ts.\n\n${detail}\n`,
  )
  process.exit(1)
}

console.log(
  `All ${declaringTotal} extension-point declarations reach their package entry`,
)
