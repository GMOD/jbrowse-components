import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

import ts from 'typescript'

import { workspaceFolders, workspaceManifests } from './releaseWorkspaces.ts'

// The sibling of workspaceLayering.test.ts, one axis over: that file pins
// which WORKSPACE packages may depend on which, this one pins that an external
// import is declared at all. Both exist for the same reason — pnpm links every
// installed package into the root `node_modules`, so an undeclared import
// typechecks and runs here while breaking the published package for any
// consumer whose package manager does not hoist. `@jbrowse/synteny-core`
// shipped that way with `mobx` and `react`, and `@jbrowse/plugin-blat` with
// `@jbrowse/mobx-state-tree`; nothing in tree could notice.
//
// The rule: a runtime import in a package's `src/` must be in its
// `dependencies` or `peerDependencies`. A type-only import may also live in
// `devDependencies` (it costs a consumer nothing at runtime). A file the
// package's build leaves out is exempt — its tier is `devDependencies`, and
// jest resolves those from the root. Which files that is comes from the build
// config itself (`tsconfig.base.esm.json`'s `exclude`, the one definition of
// test-only source), and a package with no build of its own is held to that
// base config's rule.

const builtins = new Set(builtinModules)

interface Manifest {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function pkgNameOf(spec: string) {
  return spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0]!
}

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') {
        yield* walk(p)
      }
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      yield p
    }
  }
}

function builtFiles(root: string, pkgDir: string) {
  const buildConfig =
    ['tsconfig.build.esm.json', 'tsconfig.build.json']
      .map(name => join(pkgDir, name))
      .find(existsSync) ?? join(root, 'tsconfig.base.esm.json')
  return new Set(
    ts.parseJsonConfigFileContent(
      { extends: buildConfig },
      ts.sys,
      pkgDir,
      undefined,
      join(pkgDir, 'tsconfig.declaredDependencies.json'),
    ).fileNames,
  )
}

// Comments first, so a JSDoc line quoting `import('x')` is not an import
// (display-ui's importGraph.node.ts has exactly that). Crude — a template
// literal holding comment-like text loses its imports too — but a checker may
// under-read source; what it may not do is report the quote.
function stripComments(text: string) {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*/g, '')
}

// The clause between `import` and `from` is spelled out rather than matched
// as "anything up to from" so a multi-line `{ … }` list is read without letting
// the match run on through code to some later `from '…'`.
const importRe =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+)\s*from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

interface Violation {
  pkg: string
  file: string
  spec: string
  typeOnly: boolean
  privatePackage: boolean
}

function readManifest(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

function scan(root: string) {
  const violations: Violation[] = []
  const privatePackages = new Set(
    workspaceManifests(root)
      .map(path => readManifest(join(root, path)))
      .filter(m => m.private)
      .map(m => m.name),
  )
  for (const r of workspaceFolders(root)) {
    const tierDir = join(root, r)
    if (!existsSync(tierDir)) {
      continue
    }
    for (const dir of readdirSync(tierDir)) {
      const pkgPath = join(tierDir, dir, 'package.json')
      const srcPath = join(tierDir, dir, 'src')
      if (!existsSync(pkgPath) || !existsSync(srcPath)) {
        continue
      }
      const manifest = readManifest(pkgPath)
      if (!manifest.name) {
        continue
      }
      const runtimeTier = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        manifest.name,
      ])
      const devTier = new Set(Object.keys(manifest.devDependencies ?? {}))
      const built = builtFiles(root, join(tierDir, dir))
      for (const file of walk(srcPath)) {
        if (!built.has(file)) {
          continue
        }
        const text = stripComments(readFileSync(file, 'utf8'))
        for (const m of text.matchAll(importRe)) {
          const spec = m[2] ?? m[3] ?? m[4]
          if (!spec || spec.startsWith('.') || spec.startsWith('node:')) {
            continue
          }
          const name = pkgNameOf(spec)
          const typeOnly = !!m[1]
          const privatePackage = !manifest.private && privatePackages.has(name)
          const declared =
            runtimeTier.has(name) ||
            builtins.has(name) ||
            (typeOnly && devTier.has(name))
          if (privatePackage || !declared) {
            violations.push({
              pkg: manifest.name,
              file: file.replace(`${root}/`, ''),
              spec,
              typeOnly,
              privatePackage,
            })
          }
        }
      }
    }
  }
  return violations
}

// `__dirname`, not `import.meta.dirname`: jest compiles this to CJS, where
// `import.meta` is a syntax error (same as workspaceLayering.test.ts).
const repoRoot = join(__dirname, '..')

test('every external import in a package src/ is declared by that package', () => {
  const violations = scan(repoRoot)
  const report = violations.map(v =>
    v.privatePackage
      ? `${v.pkg} is published but imports the private '${v.spec}' in ${v.file}, which no consumer can install`
      : `${v.pkg} imports '${v.spec}'${v.typeOnly ? ' (type-only)' : ''} in ${v.file} without declaring it — add it to that package.json's ${v.typeOnly ? 'dependencies, peerDependencies or devDependencies' : 'dependencies or peerDependencies'}`,
  )
  expect(report).toEqual([])
})
