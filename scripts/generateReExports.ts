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
// A served package is one any product bundles, and a served key is a subpath
// its `exports` map publishes (its `main` where it has no map). A product
// serves the keys of the packages it bundles, and must name each of them as a
// direct dependency so its generated file can resolve the import.
//
// The worker serves a module for real unless the module's own source graph —
// followed through workspace packages, stopped at third-party specifiers —
// names react-dom, a Material UI component, the data grid or floating-ui.
// Such a module still serves for real each export declared by a module that
// does not render, imported by name so the bundler prunes the rest; a stub
// with the export's name stands in for each other one, so the plugin's
// module-scope reads succeed without the worker fetching the UI graph.
// agent-docs/reference/EAGER_BUNDLE.md §"3. The runtime re-export registry" is
// the measurement behind the split.
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

const isServable = (name: string) =>
  name.startsWith('@jbrowse/') &&
  name !== '@jbrowse/mobx-state-tree' &&
  !workspace.get(name)!.manifest.private

// The union over the products, not jbrowse-web's closure alone: a package only
// Desktop or an embedded build bundles is one those hosts serve, and reading it
// off web's closure left it out of `list.ts` with nothing to say so — the
// `missing` check below cannot see it, since it only looks at packages already
// in this set.
const served = [
  ...new Set(
    PRODUCTS.flatMap(product => [
      ...closure(Object.keys(readProduct(product).dependencies!)),
    ]),
  ),
]
  .filter(isServable)
  .sort()

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
for (const pkg of served) {
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

interface Binding {
  spec: string
  name: string
}

interface Parsed {
  edges: string[]
  names: Set<string>
  stars: string[]
  imports: Map<string, Binding>
  reexports: Map<string, Binding>
  exportedLocals: Map<string, string>
  evaluates: boolean
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

const isInertInitializer = (init: ts.Expression | undefined) =>
  !init ||
  ts.isLiteralExpression(init) ||
  ts.isArrowFunction(init) ||
  ts.isFunctionExpression(init) ||
  init.kind === ts.SyntaxKind.TrueKeyword ||
  init.kind === ts.SyntaxKind.FalseKeyword

// Whether a bundler must run the statement, which keeps its module and every
// import that module names even when only a re-export through it is used.
function evaluates(stmt: ts.Statement) {
  if (hasModifier(stmt, ts.SyntaxKind.DeclareKeyword)) {
    return false
  }
  if (ts.isImportDeclaration(stmt)) {
    return !stmt.importClause
  }
  if (ts.isVariableStatement(stmt)) {
    return !stmt.declarationList.declarations.every(d =>
      isInertInitializer(d.initializer),
    )
  }
  if (ts.isExportAssignment(stmt)) {
    return !ts.isIdentifier(stmt.expression)
  }
  if (ts.isClassDeclaration(stmt)) {
    return (
      (ts.getDecorators(stmt) ?? []).length > 0 ||
      (stmt.heritageClauses ?? []).some(h =>
        h.types.some(t => !ts.isIdentifier(t.expression)),
      ) ||
      stmt.members.some(
        m =>
          ts.isClassStaticBlockDeclaration(m) ||
          (ts.isPropertyDeclaration(m) &&
            hasModifier(m, ts.SyntaxKind.StaticKeyword) &&
            !isInertInitializer(m.initializer)),
      )
    )
  }
  return !(
    ts.isExportDeclaration(stmt) ||
    ts.isFunctionDeclaration(stmt) ||
    ts.isTypeAliasDeclaration(stmt) ||
    ts.isInterfaceDeclaration(stmt)
  )
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
  const out: Parsed = {
    edges: [],
    names: new Set(),
    stars: [],
    imports: new Map(),
    reexports: new Map(),
    exportedLocals: new Map(),
    evaluates: source.statements.some(evaluates),
  }
  parsed.set(file, out)
  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text
      if (!clause) {
        out.edges.push(spec)
      } else if (!clause.isTypeOnly) {
        const bindings = clause.namedBindings
        if (clause.name) {
          out.imports.set(clause.name.text, { spec, name: 'default' })
        }
        if (bindings && ts.isNamespaceImport(bindings)) {
          out.imports.set(bindings.name.text, { spec, name: '*' })
        } else if (bindings) {
          for (const el of bindings.elements) {
            out.imports.set(el.name.text, {
              spec,
              name: (el.propertyName ?? el.name).text,
            })
          }
        }
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
        out.reexports.set(clause.name.text, { spec: spec!, name: '*' })
        out.edges.push(spec!)
      } else {
        let value = false
        for (const el of clause.elements) {
          if (!el.isTypeOnly) {
            const local = (el.propertyName ?? el.name).text
            out.names.add(el.name.text)
            if (spec) {
              out.reexports.set(el.name.text, { spec, name: local })
            } else {
              out.exportedLocals.set(el.name.text, local)
            }
            value = true
          }
        }
        if (spec && value) {
          out.edges.push(spec)
        }
      }
    } else if (ts.isExportAssignment(stmt)) {
      out.names.add('default')
      if (ts.isIdentifier(stmt.expression)) {
        out.exportedLocals.set('default', stmt.expression.text)
      }
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
function reachedSpecifiers(file: string) {
  const cached = reachCache.get(file)
  if (cached) {
    return cached
  }
  const out = new Set<string>()
  const seen = new Set([file])
  const pending = [file]
  while (pending.length > 0) {
    const from = pending.pop()!
    for (const spec of parse(from).edges) {
      const target = resolveSpecifier(from, spec)
      if (!target) {
        out.add(spec)
      } else if (!seen.has(target)) {
        seen.add(target)
        pending.push(target)
      }
    }
  }
  reachCache.set(file, out)
  return out
}

const uiVia = (file: string) =>
  [...reachedSpecifiers(file)].filter(s => UI_SPECIFIER.test(s)).sort()

// Whether importing export `name` of `file` by name reaches a rendering
// library once a bundler has pruned what `sideEffects: false` lets it. The
// module that declares the name decides, unless a module the name passes
// through both renders and runs code of its own, which keeps that module's
// whole graph. A name re-exported from a third-party specifier is judged by
// the specifier, a namespace re-export by the module it gathers.
function declaredInUi(
  file: string,
  name: string,
  trail = new Set<string>(),
): boolean {
  const { reexports, exportedLocals, imports, names, stars, evaluates } =
    parse(file)
  trail.add(file)
  const local = exportedLocals.get(name)
  const binding =
    reexports.get(name) ??
    (local === undefined ? undefined : imports.get(local))
  if (
    (binding !== undefined || !names.has(name)) &&
    evaluates &&
    uiVia(file).length > 0
  ) {
    return true
  }
  if (binding) {
    const target = resolveSpecifier(file, binding.spec)
    if (!target) {
      return UI_SPECIFIER.test(binding.spec)
    }
    return binding.name === '*' || trail.has(target)
      ? uiVia(target).length > 0
      : declaredInUi(target, binding.name, trail)
  }
  if (!names.has(name)) {
    for (const spec of stars) {
      const target = resolveSpecifier(file, spec)!
      if (!trail.has(target) && runtimeExportNames(target).has(name)) {
        return declaredInUi(target, name, trail)
      }
    }
  }
  return uiVia(file).length > 0
}

interface Served {
  key: string
  pkg: string
  file: string
  names: string[]
  uiVia: string[]
  stubbed: string[]
}

const servedModules: Served[] = entries.map(entry => {
  const names = [...runtimeExportNames(entry.file)].sort()
  const via = uiVia(entry.file)
  const stubbed =
    via.length > 0 ? names.filter(name => declaredInUi(entry.file, name)) : []
  return { ...entry, names, uiVia: via, stubbed }
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

function workerExpression(
  m: Served,
  alias: string,
  specifier: string,
  imports: string[],
) {
  const real = m.names.filter(name => !m.stubbed.includes(name))
  if (real.length === 0) {
    return stubExpression(m.names)
  }
  imports.push(
    `import { ${real.map(name => `${name} as ${alias}_${name}`).join(', ')} } from ${q(specifier)}`,
  )
  const hasDefault = m.names.includes('default')
  if (hasDefault && m.names.length === 1) {
    return `${alias}_default`
  }
  return `uiNamespace([${m.stubbed.map(q).join(', ')}], ${hasDefault}, { ${real
    .map(name => `${name}: ${alias}_${name}`)
    .join(', ')} })`
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
  if (worker && modules.some(m => m.uiVia.length > 0)) {
    imports.push(
      `import { uiNamespace, uiStub } from ${q(
        file.startsWith(CORE_REEXPORTS)
          ? './uiStub.ts'
          : `${CORE}/ReExports/uiStub`,
      )}`,
    )
  }
  modules.forEach((m, i) => {
    const ns = `m${i}`
    if (worker && m.uiVia.length > 0) {
      lines.push(
        `  ${q(m.key)}: ${workerExpression(m, ns, specifierOf(m), imports)},`,
      )
      return
    }
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
        worker:
          m.uiVia.length === 0
            ? 'real'
            : m.stubbed.length === m.names.length
              ? 'stub'
              : 'mixed',
        ...(m.uiVia.length > 0 ? { uiVia: m.uiVia } : {}),
        ...(m.stubbed.length > 0 && m.stubbed.length < m.names.length
          ? { stubbed: m.stubbed }
          : {}),
      },
    ]),
  ),
  products: Object.fromEntries(
    PRODUCTS.map(product => [
      product,
      [...closure(Object.keys(readProduct(product).dependencies!))]
        .filter(isServable)
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
        `What ${product} serves to a runtime plugin beyond @jbrowse/core: every subpath of every @jbrowse package it bundles.`,
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
  `${servedModules.length} @jbrowse keys over ${served.length} packages, ${framework.length} framework keys; the worker stubs ${servedModules.reduce((n, m) => n + m.stubbed.length, 0)} of the names in ${servedModules.filter(m => m.uiVia.length > 0).length} rendering modules and serves the other ${servedModules.reduce((n, m) => n + (m.uiVia.length > 0 ? m.names.length - m.stubbed.length : 0), 0)} for real`,
)
