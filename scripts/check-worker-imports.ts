/* eslint-disable no-console */
// Which UI packages an RPC worker's entry can statically reach.
//
//   node scripts/check-worker-imports.ts [entry.ts] [--causes] [--top=N]
//
// RPC workers fetch data; nothing in them renders React. But every product's
// worker entry statically imports `corePlugins.ts`, and a plugin's `index.ts`
// reaches its React components (menu icons, tooltips, SVG-export wrappers), so
// MUI + emotion + react-dom land in the chunks the worker parses on boot —
// measured at 2.2 MB of 6.35 MB of module bytes, per worker, on a build whose
// three workers each parse the same chunks.
//
// Webpack keeps a module if ANY reachable importer needs it, so cutting one
// chain saves nothing; this reports every chain so a de-React pass can tell
// when it has actually cut the last one. `--causes` prints them.
//
// Dynamic `import()` is a chunk boundary and deliberately NOT followed: making
// an import lazy is exactly the fix, so it should show up here as progress.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

// Packages that have no business executing in a worker realm.
const UI_PACKAGES = [/^@mui\//, /^@emotion\//, /^react-dom/, /^tss-react/]

const args = process.argv.slice(2)
const showCauses = args.includes('--causes')
const top = Number(
  args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '30',
)
const entryArg =
  args.find(a => !a.startsWith('--')) ?? 'products/jbrowse-web/src/rpcWorker.ts'

// workspace package name -> package dir
const workspace = new Map<string, string>()
for (const group of ['packages', 'plugins', 'products']) {
  const dir = path.join(repoRoot, group)
  for (const name of fs.readdirSync(dir)) {
    const pkgPath = path.join(dir, name, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        name?: string
      }
      if (json.name) {
        workspace.set(json.name, path.join(dir, name))
      }
    }
  }
}

const EXTS = ['.ts', '.tsx', '.js', '.jsx']

function resolveFile(p: string) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) {
    return p
  }
  for (const e of EXTS) {
    if (fs.existsSync(p + e)) {
      return p + e
    }
  }
  for (const e of EXTS) {
    const idx = path.join(p, `index${e}`)
    if (fs.existsSync(idx)) {
      return idx
    }
  }
  return undefined
}

function resolveSpec(spec: string, fromFile: string) {
  if (spec.startsWith('.')) {
    return resolveFile(path.resolve(path.dirname(fromFile), spec))
  }
  // longest match wins, so `@jbrowse/core/util` beats `@jbrowse/core`
  let best: string | undefined
  for (const name of workspace.keys()) {
    const matches = spec === name || spec.startsWith(`${name}/`)
    if (matches && (!best || name.length > best.length)) {
      best = name
    }
  }
  if (best) {
    const sub = spec.slice(best.length).replace(/^\//, '')
    return resolveFile(path.join(workspace.get(best)!, 'src', sub || 'index'))
  }
  return undefined
}

// Comment-stripped scan for static `import`/`export ... from`. `import type` /
// `export type` are erased before webpack sees them, so they don't count.
function staticImports(src: string) {
  const code = src
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:])\/\/.*$/gm, '$1')
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g
  const out: string[] = []
  let m
  while ((m = re.exec(code))) {
    out.push(m[1]!)
  }
  return out
}

const entry = resolveFile(path.resolve(repoRoot, entryArg))
if (!entry) {
  throw new Error(`cannot resolve entry: ${entryArg}`)
}

const parent = new Map<string, string | null>([[entry, null]])
const queue = [entry]
// "<ui package> <- <importing file>" -> shortest chain that reaches it
const causes = new Map<string, string[]>()

while (queue.length) {
  const file = queue.shift()!
  let src: string
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const spec of staticImports(src)) {
    if (UI_PACKAGES.some(r => r.test(spec))) {
      const chain: string[] = []
      for (let f: string | null = file; f; f = parent.get(f) ?? null) {
        chain.push(path.relative(repoRoot, f))
      }
      chain.reverse()
      const pkg = spec.split('/').slice(0, 2).join('/')
      const key = `${pkg} <- ${path.relative(repoRoot, file)}`
      const prev = causes.get(key)
      if (!prev || prev.length > chain.length) {
        causes.set(key, chain)
      }
      continue
    }
    const next = resolveSpec(spec, file)
    if (next && !parent.has(next)) {
      parent.set(next, file)
      queue.push(next)
    }
  }
}

const owner = (file: string) => {
  const m = /(?:^|\/)(packages|plugins|products)\/([^/]+)\//.exec(file)
  return m ? `${m[1]}/${m[2]}` : file
}

const byOwner = new Map<string, number>()
for (const key of causes.keys()) {
  const o = owner(key.split(' <- ')[1]!)
  byOwner.set(o, (byOwner.get(o) ?? 0) + 1)
}

console.log(`entry: ${path.relative(repoRoot, entry)}`)
console.log(`statically reachable modules: ${parent.size}`)
console.log(`UI import sites: ${causes.size}\n`)

if (causes.size === 0) {
  console.log('no UI package is statically reachable from this worker entry')
} else {
  console.log('UI import sites by owning package:')
  for (const [o, n] of [...byOwner].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    console.log(`  ${String(n).padStart(4)}  ${o}`)
  }
  if (showCauses) {
    console.log('\nevery site (fix them all, or webpack keeps the package):')
    for (const key of [...causes.keys()].sort()) {
      console.log(`  ${key}`)
    }
  } else {
    console.log('\nre-run with --causes for the full list')
  }
}
