// Regenerates packages/core/src/ReExports/abiPreviousRelease.json from the
// @jbrowse/core build we actually published last, so check-published-plugins.ts
// can check the current ABI against what plugins in the wild were built against.
//
// Run at release time, after the version bump lands:
//
//   node --experimental-strip-types scripts/gen-abi-previous-release.ts 4.3.0
//
// It downloads the published tarball rather than reading the git tag: the tag
// carries source, and what a plugin links against is the emitted package. The
// .d.ts tree is the closest offline description of that -- tsc has already
// resolved the `export *` chains that the source spreads over ~40 barrels.
//
// Two surfaces come out of the same tarball, and since the runtime registry
// is generated from the exports map they are one list read two ways.
// `subpaths` is the published `exports` map, which is what a plugin
// deep-importing `@jbrowse/core/util/QuickLRU` resolves against; `modules` is
// every subpath's runtime export names, which is what the served registry
// carries for it (reExports.generated.json holds the current build's answer,
// and check-published-plugins.ts and generate-abi-removals.ts diff the two).
//
// Type-only exports are dropped, because a plugin importing one gets nothing at
// runtime and so can't be broken by its removal.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OUT = 'packages/core/src/ReExports/abiPreviousRelease.json'

function resolveSpec(spec: string, from: string, root: string) {
  if (!spec.startsWith('.')) {
    return undefined
  }
  const base = path.normalize(path.join(path.dirname(from), spec))
  const candidates = [
    base,
    base.replace(/\.ts$/, '.d.ts'),
    `${base}.d.ts`,
    path.join(base, 'index.d.ts'),
  ]
  return candidates.find(c => fs.existsSync(path.join(root, c)))
}

// Collect the runtime (value) exports of a .d.ts, following `export * from`.
function valueExports(entry: string, root: string, seen = new Set<string>()) {
  if (seen.has(entry)) {
    return new Set<string>()
  }
  seen.add(entry)
  const src = fs.readFileSync(path.join(root, entry), 'utf8')
  const names = new Set<string>()

  // `export { a, b as c }` and `export { a } from './x'`, skipping `export type {`
  for (const m of src.matchAll(
    /export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g,
  )) {
    if (m[1]) {
      continue
    }
    for (const raw of m[2]!.split(',')) {
      const part = raw.trim()
      if (!part || part.startsWith('type ')) {
        continue
      }
      names.add(
        (part.includes(' as ') ? part.split(' as ').pop()! : part).trim(),
      )
    }
  }
  for (const m of src.matchAll(
    /export\s+declare\s+(?:async\s+)?(?:abstract\s+class|class|const|function|let|var|enum)\s+([A-Za-z0-9_$]+)/g,
  )) {
    names.add(m[1]!)
  }
  // `export default X` / `export default class` / `export { X as default }`
  // (the last already lands above as `default`)
  if (/^export\s+default\b/m.test(src)) {
    names.add('default')
  }
  for (const m of src.matchAll(/export\s+\*\s+from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveSpec(m[1]!, entry, root)
    if (target) {
      for (const n of valueExports(target, root, seen)) {
        names.add(n)
      }
    }
  }
  return names
}

const version = process.argv[2]
if (!version) {
  throw new Error('usage: gen-abi-previous-release.ts <version>')
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-abi-'))
const tarball = execFileSync(
  'npm',
  ['pack', `@jbrowse/core@${version}`, '--silent'],
  {
    cwd: tmp,
    encoding: 'utf8',
  },
).trim()
execFileSync('tar', ['xzf', tarball], { cwd: tmp })
const root = path.join(tmp, 'package', 'esm')

// The published `exports` map, whose keys are the deep-import subpaths an
// external plugin can resolve. npm swaps `publishConfig.exports` in at publish
// time, so this is the emitted map and not the workspace one.
const exportsMap =
  (
    JSON.parse(
      fs.readFileSync(path.join(tmp, 'package', 'package.json'), 'utf8'),
    ) as {
      exports?: Record<string, string | { import?: string; default?: string }>
    }
  ).exports ?? {}
const subpaths = Object.keys(exportsMap).sort()

// Each published subpath's `.d.ts`, beside its emitted `.js`. A registry-era
// subpath (`ReExports/*`) is the host's own machinery, not something a plugin
// links against, so it carries no names here.
const modules: Record<string, string[]> = {}
for (const subpath of subpaths) {
  if (subpath.includes('/ReExports/')) {
    continue
  }
  const target = exportsMap[subpath]!
  const js =
    typeof target === 'string' ? target : (target.import ?? target.default)
  const entry = path
    .relative(root, path.join(tmp, 'package', js!))
    .replace(/\.js$/, '.d.ts')
  if (fs.existsSync(path.join(root, entry))) {
    modules[`@jbrowse/core${subpath.slice(1)}`] = [
      ...valueExports(entry, root),
    ].sort()
  }
}

fs.writeFileSync(
  OUT,
  `${JSON.stringify({ version, subpaths, modules }, null, 2)}\n`,
)
fs.rmSync(tmp, { recursive: true, force: true })
// JSON.stringify's array wrapping is not oxfmt's, and the Format job checks
// every file, so a regeneration would otherwise land red.
execFileSync('npx', ['oxfmt', OUT], { stdio: 'inherit' })

const total = Object.values(modules).reduce((a, b) => a + b.length, 0)
console.log(
  `wrote ${OUT}: @jbrowse/core@${version}, ${total} names in ${Object.keys(modules).length} modules, ${subpaths.length} subpaths`,
)
