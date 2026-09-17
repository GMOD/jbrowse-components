// The runtime plugin ABI, from the packages' exports maps. Rides `pnpm
// autogen`; run directly after editing an exports map, a package.json
// dependency or a product's plugin set:
//
//   node --experimental-strip-types scripts/generateReExports.ts
//
// A runtime plugin's build externalizes every specifier `ReExports/list.ts`
// names, and at runtime reads each off `JBrowseExports`. What this writes:
//
//   packages/core/src/ReExports/list.ts                 every key a plugin may externalize
//   packages/core/src/ReExports/coreModules.generated.ts        the @jbrowse/core half, main thread
//   packages/core/src/ReExports/coreWorkerModules.generated.ts  the same keys in the RPC worker
//   packages/core/src/ReExports/frameworkWorkerModules.generated.ts
//                                                       the framework half in the worker
//   packages/core/src/ReExports/reExports.generated.json
//                                                       every key with its export names,
//                                                       for the checkers and the docs
//   products/<p>/src/reExports.generated.ts             what that product serves beyond core
//   products/<p>/src/workerReExports.generated.ts       the same in its worker
//
// The served packages are `SERVED`: core and the display toolkit a plugin
// builds on. No plugin's code is served, so a runtime plugin never runs against
// another plugin's internals. A served key is a subpath a served package's
// `exports` map publishes (its `main` where it has no map), and each product
// names the served packages as direct dependencies so its generated file can
// resolve the import.
//
// The worker serves a module for real unless the module's own source graph —
// followed through workspace packages, stopped at third-party specifiers —
// names react-dom, a Material UI component, the data grid or floating-ui.
// Those are the modules a plugin reads only to render, and a stub with the
// module's own export names stands in so the plugin's module-scope reads
// succeed without the worker fetching the UI graph. agent-docs/reference/
// EAGER_BUNDLE.md §"3. The runtime re-export registry" is the measurement
// behind the split.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import esbuild from 'esbuild'
import * as ts from 'typescript'

import frameworkShared from '../packages/core/src/ReExports/frameworkShared.ts'
import { REACT_INTERNAL_KEYS } from '../packages/core/src/ReExports/uiStub.ts'
import { checkOrWriteAll } from '../website/scripts/check-utils.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const CORE = '@jbrowse/core'
const CORE_REEXPORTS = path.join(ROOT, 'packages/core/src/ReExports')
const PRODUCTS = [
  'jbrowse-web',
  'jbrowse-desktop',
  'jbrowse-react-linear-genome-view',
  'jbrowse-react-app',
  'jbrowse-react-circular-genome-view',
]
// A specifier that means "this module renders": named by a module's own graph,
// it puts the module behind a stub in the worker.
const UI_SPECIFIER =
  /^(react-dom(\/.*)?|@mui\/material(\/(?!styles|utils|colors)[A-Z].*)?|@mui\/x-data-grid.*|@floating-ui\/.*)$/

interface Manifest {
  name: string
  private?: boolean
  main?: string
  exports?: Record<string, string | { import?: string; default?: string }>
  dependencies?: Record<string, string>
}

interface Workspace {
  dir: string
  manifest: Manifest
}

const workspace = new Map<string, Workspace>()
for (const group of ['packages', 'plugins']) {
  for (const entry of execFileSync('ls', [path.join(ROOT, group)], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')) {
    const dir = path.join(ROOT, group, entry)
    const file = path.join(dir, 'package.json')
    if (existsSync(file)) {
      const manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest
      workspace.set(manifest.name, { dir, manifest })
    }
  }
}

function readProduct(product: string) {
  return JSON.parse(
    readFileSync(path.join(ROOT, 'products', product, 'package.json'), 'utf8'),
  ) as Manifest
}

function closure(direct: Iterable<string>) {
  const out = new Set<string>()
  const walk = (name: string) => {
    const pkg = workspace.get(name)
    if (!pkg || out.has(name)) {
      return
    }
    out.add(name)
    for (const dep of Object.keys(pkg.manifest.dependencies ?? {})) {
      walk(dep)
    }
  }
  for (const name of direct) {
    walk(name)
  }
  return out
}

const SERVED = new Set([
  CORE,
  '@jbrowse/display-kit',
  '@jbrowse/display-ui',
  '@jbrowse/render-core',
])

interface Entry {
  key: string
  pkg: string
  file: string
}

function targetFile(
  dir: string,
  target: string | { import?: string; default?: string },
) {
  const rel =
    typeof target === 'string' ? target : (target.import ?? target.default)
  if (!rel) {
    throw new Error(`${dir}: an exports entry names no file`)
  }
  return path.join(dir, rel)
}

const entries: Entry[] = []
const entryByKey = new Map<string, Entry>()
for (const pkg of SERVED) {
  const { dir, manifest } = workspace.get(pkg)!
  if (manifest.exports) {
    for (const [sub, target] of Object.entries(manifest.exports)) {
      // the registry itself, which nothing outside the host has any business
      // resolving at runtime
      if (sub.includes('/ReExports/')) {
        continue
      }
      const key = sub === '.' ? pkg : pkg + sub.slice(1)
      const entry = { key, pkg, file: targetFile(dir, target) }
      entries.push(entry)
      entryByKey.set(key, entry)
    }
  } else if (manifest.main) {
    const entry = { key: pkg, pkg, file: path.join(dir, manifest.main) }
    entries.push(entry)
    entryByKey.set(pkg, entry)
  }
}
entries.sort((a, b) => a.key.localeCompare(b.key))

// ---- resolution ----------------------------------------------------------

function resolveRelative(from: string, spec: string) {
  const base = path.resolve(path.dirname(from), spec)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate
    }
  }
  throw new Error(`${from}: cannot resolve '${spec}'`)
}

// A workspace specifier, followed so the walk crosses package boundaries the
// way the bundle does. One the served set does not name (a private package,
// or a subpath a sibling reaches that its exports map does not publish)
// resolves through the package directory instead.
function resolveWorkspace(spec: string) {
  const entry = entryByKey.get(spec)
  if (entry) {
    return entry.file
  }
  const match = /^(@jbrowse\/[^/]+)(\/.*)?$/.exec(spec)
  if (!match || !workspace.has(match[1]!)) {
    return undefined
  }
  const { dir, manifest } = workspace.get(match[1]!)!
  if (!match[2]) {
    return manifest.main ? path.join(dir, manifest.main) : undefined
  }
  const mapped = manifest.exports?.[`.${match[2]}`]
  return mapped
    ? targetFile(dir, mapped)
    : resolveRelative(path.join(dir, 'package.json'), `./src${match[2]}`)
}

function resolveSpecifier(from: string, spec: string) {
  if (spec.startsWith('.')) {
    return resolveRelative(from, spec)
  }
  if (spec.startsWith('@jbrowse/') && spec !== '@jbrowse/mobx-state-tree') {
    return resolveWorkspace(spec)
  }
  return undefined
}

// ---- one parse per file: its value edges and its runtime export names --------

interface Parsed {
  edges: string[]
  names: Set<string>
  stars: string[]
}

const parsed = new Map<string, Parsed>()

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node) ?? []).some(m => m.kind === kind)
    : false
}

function bindingNames(name: ts.BindingName, out: Set<string>) {
  if (ts.isIdentifier(name)) {
    out.add(name.text)
  } else {
    for (const el of name.elements) {
      if (ts.isBindingElement(el)) {
        bindingNames(el.name, out)
      }
    }
  }
}

function parse(file: string): Parsed {
  const cached = parsed.get(file)
  if (cached) {
    return cached
  }
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const out: Parsed = { edges: [], names: new Set(), stars: [] }
  parsed.set(file, out)
  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text
      if (!clause) {
        out.edges.push(spec)
      } else if (!clause.isTypeOnly) {
        const bindings = clause.namedBindings
        const allTypeOnly =
          !clause.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.every(el => el.isTypeOnly)
        if (!allTypeOnly) {
          out.edges.push(spec)
        }
      }
    } else if (ts.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly) {
        continue
      }
      const spec = stmt.moduleSpecifier
        ? (stmt.moduleSpecifier as ts.StringLiteral).text
        : undefined
      const clause = stmt.exportClause
      if (!clause) {
        out.stars.push(spec!)
        out.edges.push(spec!)
      } else if (ts.isNamespaceExport(clause)) {
        out.names.add(clause.name.text)
        out.edges.push(spec!)
      } else {
        let value = false
        for (const el of clause.elements) {
          if (!el.isTypeOnly) {
            out.names.add(el.name.text)
            value = true
          }
        }
        if (spec && value) {
          out.edges.push(spec)
        }
      }
    } else if (ts.isExportAssignment(stmt)) {
      out.names.add('default')
    } else if (hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(stmt, ts.SyntaxKind.DeclareKeyword)) {
        continue
      }
      if (hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) {
        out.names.add('default')
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          bindingNames(decl.name, out.names)
        }
      } else if (
        (ts.isFunctionDeclaration(stmt) ||
          ts.isClassDeclaration(stmt) ||
          ts.isEnumDeclaration(stmt)) &&
        stmt.name
      ) {
        if (
          ts.isEnumDeclaration(stmt) &&
          hasModifier(stmt, ts.SyntaxKind.ConstKeyword)
        ) {
          continue
        }
        out.names.add(stmt.name.text)
      }
    }
  }
  return out
}

function runtimeExportNames(
  file: string,
  seen = new Set<string>(),
): Set<string> {
  const { names, stars } = parse(file)
  const out = new Set(names)
  for (const spec of stars) {
    const target = resolveSpecifier(file, spec)
    if (!target) {
      throw new Error(
        `${file}: \`export *\` from '${spec}' reaches outside the workspace, so its names cannot be listed`,
      )
    }
    if (!seen.has(target)) {
      seen.add(target)
      for (const name of runtimeExportNames(target, seen)) {
        if (name !== 'default') {
          out.add(name)
        }
      }
    }
  }
  return out
}

// The third-party specifiers a module's graph names, through workspace edges.
const reachCache = new Map<string, Set<string>>()
function reachedSpecifiers(
  file: string,
  trail = new Set<string>(),
): Set<string> {
  const cached = reachCache.get(file)
  if (cached) {
    return cached
  }
  const out = new Set<string>()
  // a cycle contributes nothing on its own; the caller that closed it holds
  // the rest of the graph
  if (trail.has(file)) {
    return out
  }
  trail.add(file)
  for (const spec of parse(file).edges) {
    const target = resolveSpecifier(file, spec)
    if (target) {
      for (const s of reachedSpecifiers(target, trail)) {
        out.add(s)
      }
    } else {
      out.add(spec)
    }
  }
  trail.delete(file)
  reachCache.set(file, out)
  return out
}

interface Served {
  key: string
  pkg: string
  file: string
  names: string[]
  ui: boolean
  uiVia: string[]
}

const servedModules: Served[] = entries.map(entry => {
  const names = [...runtimeExportNames(entry.file)].sort()
  const uiVia = [...reachedSpecifiers(entry.file)]
    .filter(s => UI_SPECIFIER.test(s))
    .sort()
  return { ...entry, names, ui: uiVia.length > 0, uiVia }
})

// ---- the framework half, evaluated ----------------------------------------

interface FrameworkModule {
  key: string
  names: string[]
}

async function evaluateFramework(): Promise<FrameworkModule[]> {
  const dir = mkdtempSync(path.join(tmpdir(), 'jbrowse-framework-reexports-'))
  const outfile = path.join(dir, 'frameworkModules.mjs')
  await esbuild.build({
    entryPoints: [path.join(CORE_REEXPORTS, 'frameworkModules.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'warning',
  })
  const mod = (await import(pathToFileURL(outfile).href)) as {
    default: Record<string, unknown>
  }
  rmSync(dir, { recursive: true, force: true })
  return Object.entries(mod.default)
    .map(([key, value]) => ({
      key,
      names:
        value !== null &&
        (typeof value === 'object' || typeof value === 'function')
          ? Object.keys(value)
              .filter(k => !REACT_INTERNAL_KEYS.has(k))
              .sort()
          : [],
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

const framework = await evaluateFramework()

// ---- emit ------------------------------------------------------------------

const HEADER = (what: string) =>
  `// Generated by scripts/generateReExports.ts — do not edit by hand.\n// ${what}\n// Regenerate with \`pnpm autogen\`.\n`

const q = (s: string) =>
  `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

// What a key holds on the main thread, given the namespace `ns`: a default-only
// module is served as its default value, since a runtime plugin's default
// import reads the served value itself; a module with named exports beside a
// default is served as the namespace with `__esModule` set, which is what makes
// the bundler's interop read its `default` rather than wrap the namespace.
function servedExpression(ns: string, names: string[]) {
  const hasDefault = names.includes('default')
  if (hasDefault && names.length === 1) {
    return `${ns}.default`
  }
  return hasDefault ? `{ ...${ns}, __esModule: true }` : ns
}

function stubExpression(names: string[]) {
  const hasDefault = names.includes('default')
  if (hasDefault && names.length === 1) {
    return 'uiStub'
  }
  return `uiNamespace([${names.map(q).join(', ')}]${hasDefault ? ', true' : ''})`
}

function relativeImport(from: string, file: string) {
  const rel = path.relative(path.dirname(from), file).replaceAll(path.sep, '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function emitMap(
  file: string,
  what: string,
  modules: Served[],
  {
    worker,
    base,
    specifierOf,
  }: {
    worker: boolean
    base?: { specifier: string; name: string }
    specifierOf: (m: Served) => string
  },
) {
  const imports: string[] = []
  const lines: string[] = []
  if (base) {
    imports.push(`import ${base.name} from ${q(base.specifier)}`)
  }
  if (worker && modules.some(m => m.ui)) {
    imports.push(
      `import { uiNamespace, uiStub } from ${q(
        file.startsWith(CORE_REEXPORTS)
          ? './uiStub.ts'
          : `${CORE}/ReExports/uiStub`,
      )}`,
    )
  }
  modules.forEach((m, i) => {
    if (worker && m.ui) {
      lines.push(`  ${q(m.key)}: ${stubExpression(m.names)},`)
      return
    }
    const ns = `m${i}`
    imports.push(`import * as ${ns} from ${q(specifierOf(m))}`)
    lines.push(`  ${q(m.key)}: ${servedExpression(ns, m.names)},`)
  })
  return `${HEADER(what)}${imports.join('\n')}\n\nconst libs: Record<string, unknown> = {\n${
    base ? `  ...${base.name},\n` : ''
  }${lines.join('\n')}\n}\n\nexport default libs\n`
}

const coreModules = servedModules.filter(m => m.pkg === CORE)
const coreMain = path.join(CORE_REEXPORTS, 'coreModules.generated.ts')
const coreWorker = path.join(CORE_REEXPORTS, 'coreWorkerModules.generated.ts')
const coreSpecifier = (from: string) => (m: Served) =>
  relativeImport(from, m.file)

const frameworkWorker = `${HEADER(
  'The framework half of the runtime ABI as the RPC worker serves it: the shared singletons for real, the UI libraries as stubs carrying the names the main thread serves.',
)}import frameworkShared from './frameworkShared.ts'
import { uiNamespace, uiStub } from './uiStub.ts'

const libs: Record<string, unknown> = {
  ...frameworkShared,
${framework
  .filter(m => !(m.key in frameworkShared))
  .map(
    m =>
      `  ${q(m.key)}: ${m.names.length ? `uiNamespace([${m.names.map(q).join(', ')}])` : 'uiStub'},`,
  )
  .join('\n')}
}

export default libs
`

const list = [...framework.map(m => m.key), ...servedModules.map(m => m.key)]
const listFile = `${HEADER(
  'Every specifier a runtime plugin may externalize and read off the host: the framework singletons, Material UI, and every subpath the served @jbrowse packages publish. Plugin build tooling reads this file; it imports nothing so that stays cheap.',
)}
export default [
${list.map(k => `  ${q(k)},`).join('\n')}
]
`

const manifest = {
  framework: Object.fromEntries(framework.map(m => [m.key, m.names])),
  modules: Object.fromEntries(
    servedModules.map(m => [
      m.key,
      {
        package: m.pkg,
        names: m.names,
        worker: m.ui ? 'stub' : 'real',
        ...(m.ui ? { uiVia: m.uiVia } : {}),
      },
    ]),
  ),
  products: Object.fromEntries(
    PRODUCTS.map(product => [
      product,
      [...closure(Object.keys(readProduct(product).dependencies!))]
        .filter(name => SERVED.has(name))
        .sort(),
    ]),
  ),
}

const generated = [
  { path: path.join(CORE_REEXPORTS, 'list.ts'), content: listFile },
  {
    path: coreMain,
    content: emitMap(
      coreMain,
      'The @jbrowse/core half of the runtime ABI on the main thread.',
      coreModules,
      {
        worker: false,
        specifierOf: coreSpecifier(coreMain),
      },
    ),
  },
  {
    path: coreWorker,
    content: emitMap(
      coreWorker,
      'The @jbrowse/core half of the runtime ABI in the RPC worker: every key the main thread serves, a rendering module stubbed.',
      coreModules,
      {
        worker: true,
        specifierOf: coreSpecifier(coreWorker),
      },
    ),
  },
  {
    path: path.join(CORE_REEXPORTS, 'frameworkWorkerModules.generated.ts'),
    content: frameworkWorker,
  },
  {
    path: path.join(CORE_REEXPORTS, 'reExports.generated.json'),
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  },
]

for (const product of PRODUCTS) {
  const manifestOf = readProduct(product)
  const direct = new Set(Object.keys(manifestOf.dependencies ?? {}))
  const bundled = closure(direct)
  const modules = servedModules.filter(
    m => m.pkg !== CORE && bundled.has(m.pkg),
  )
  const missing = [...new Set(modules.map(m => m.pkg))].filter(
    p => !direct.has(p),
  )
  if (missing.length) {
    throw new Error(
      `products/${product} bundles ${missing.join(', ')} through another package and so serves ${missing.length === 1 ? 'it' : 'them'} to runtime plugins, but does not name ${missing.length === 1 ? 'it' : 'them'} in its own dependencies, so its generated registry cannot import ${missing.length === 1 ? 'it' : 'them'}. Add each as "workspace:^" and run pnpm install.`,
    )
  }
  const dir = path.join(ROOT, 'products', product, 'src')
  const main = path.join(dir, 'reExports.generated.ts')
  const worker = path.join(dir, 'workerReExports.generated.ts')
  generated.push(
    {
      path: main,
      content: emitMap(
        main,
        `What ${product} serves to a runtime plugin beyond @jbrowse/core: every subpath of the display toolkit.`,
        modules,
        {
          worker: false,
          base: { specifier: `${CORE}/ReExports/modules`, name: 'coreLibs' },
          specifierOf: m => m.key,
        },
      ),
    },
    {
      path: worker,
      content: emitMap(
        worker,
        `The same keys as reExports.generated.ts, as ${product}'s RPC worker serves them: a rendering module stubbed.`,
        modules,
        {
          worker: true,
          base: {
            specifier: `${CORE}/ReExports/workerModules`,
            name: 'coreLibs',
          },
          specifierOf: m => m.key,
        },
      ),
    },
  )
}

checkOrWriteAll(
  generated.map(g => ({
    ...g,
    label: path.relative(ROOT, g.path),
  })),
  'run `pnpm autogen`',
)
console.log(
  `${servedModules.length} @jbrowse keys over ${SERVED.size} packages (${servedModules.filter(m => m.ui).length} stubbed in the worker), ${framework.length} framework keys`,
)
