// What a module drags onto the startup path: its eager first-party
// static-import closure, in modules and source bytes.
//
//   node --experimental-strip-types scripts/eager-import-closure.ts <entry> \
//     [--minus <entry>] [--rev <commit>]
//
// `--minus` subtracts another entry's closure, which is the form that answers a
// real question: what does THIS way of writing a display load that the other way
// does not. `--rev` reads the tree at a commit instead of the working copy, so a
// claim about code that has since been reverted can still be re-derived.
//
// A state model is eager (ADR-091): everything a plugin's install path names by
// value loads with it, and only what sits behind `React.lazy` or a dynamic
// import escapes. So the closure walks value imports and skips `import type`,
// which tsc erases. External packages are not walked — the question is what of
// OURS a change pulls in, and node_modules is the same either side of a `--minus`.
//
// It counts SOURCE bytes, not bundled ones. Bundling would be the truer number
// and a far slower one; source bytes are stable, exactly reproducible from a
// commit, and the ratio between two arms is what a comparison reads.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
function flag(name: string) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const rev = flag('--rev')
const minus = flag('--minus')
const entry = args.find(
  (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'),
)
if (!entry) {
  throw new Error(
    'usage: eager-import-closure.ts <entry> [--minus <entry>] [--rev <commit>]',
  )
}

const repoRoot = path.join(import.meta.dirname, '..')

// A commit's tree is unpacked whole rather than read blob by blob: resolution
// asks "does this file exist" far more often than it reads one.
function treeAt(commit: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-closure-'))
  const tar = path.join(dir, 'tree.tar')
  fs.writeFileSync(
    tar,
    execFileSync(
      'git',
      ['archive', commit, 'packages', 'plugins', 'products'],
      {
        cwd: repoRoot,
        maxBuffer: 1 << 30,
      },
    ),
  )
  execFileSync('tar', ['-xf', tar, '-C', dir])
  return dir
}

const root = rev ? treeAt(rev) : repoRoot

// package name -> its src directory, so `@jbrowse/render-core/hal` resolves the
// way a workspace consumer resolves it.
const pkgDirs = new Map<string, string>()
for (const group of ['packages', 'plugins', 'products']) {
  const base = path.join(root, group)
  if (!fs.existsSync(base)) {
    continue
  }
  for (const name of fs.readdirSync(base)) {
    const manifest = path.join(base, name, 'package.json')
    if (fs.existsSync(manifest)) {
      const { name: pkg } = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
        name?: string
      }
      if (pkg) {
        pkgDirs.set(pkg, path.join(group, name, 'src'))
      }
    }
  }
}

function isFile(rel: string) {
  const full = path.join(root, rel)
  return fs.existsSync(full) && fs.statSync(full).isFile()
}

function resolveFile(base: string) {
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ].find(isFile)
}

function resolve(spec: string, from: string) {
  if (spec.startsWith('.')) {
    return resolveFile(path.normalize(path.join(path.dirname(from), spec)))
  }
  for (const [pkg, dir] of pkgDirs) {
    if (spec === pkg) {
      return resolveFile(path.join(dir, 'index'))
    }
    if (spec.startsWith(`${pkg}/`)) {
      return resolveFile(path.join(dir, spec.slice(pkg.length + 1)))
    }
  }
  return undefined
}

// `import type` and `export type` are erased by tsc, and so is a clause whose
// every specifier is `type X` — neither reaches a bundle.
function valueSpecs(src: string) {
  const specs: string[] = []
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?([\s\S]*?)from\s*['"]([^'"]+)['"]/g,
  )) {
    if (m[1]) {
      continue
    }
    const clause = m[2] ?? ''
    const braced = /\{([\s\S]*)\}/.exec(clause)
    const before = braced
      ? clause.slice(0, clause.indexOf('{')).replace(/,\s*$/, '').trim()
      : ''
    const named =
      braced?.[1]
        ?.split(',')
        .map(s => s.trim())
        .filter(Boolean) ?? []
    if (
      !before &&
      named.length > 0 &&
      named.every(n => n.startsWith('type '))
    ) {
      continue
    }
    specs.push(m[3]!)
  }
  for (const m of src.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    specs.push(m[1]!)
  }
  return specs
}

function closure(from: string) {
  const start = resolveFile(from.replace(/\.(ts|tsx)$/, '')) ?? from
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length) {
    const rel = queue.shift()!
    if (seen.has(rel)) {
      continue
    }
    seen.add(rel)
    for (const spec of valueSpecs(
      fs.readFileSync(path.join(root, rel), 'utf8'),
    )) {
      const target = resolve(spec, rel)
      if (target && !seen.has(target)) {
        queue.push(target)
      }
    }
  }
  return seen
}

const reached = closure(entry)
const subtracted = minus ? closure(minus) : new Set<string>()
const files = [...reached].filter(f => !subtracted.has(f)).sort()
const size = (f: string) => fs.statSync(path.join(root, f)).size
const bytes = files.reduce((n, f) => n + size(f), 0)

for (const f of files) {
  console.log(`${String(size(f)).padStart(7)}  ${f}`)
}
console.log(`\n${files.length} modules, ${bytes} bytes`)
if (rev) {
  fs.rmSync(root, { recursive: true, force: true })
}
