// Generates DISPLAYCHROME.md's adoption map from the display registrations
// themselves, so the list and its counts cannot drift from the code.
//
// The table was hand-maintained, and agent-docs/CLAUDE.md is explicit that a
// table restating something a reader could check against the code should be a
// generator instead. The neighbouring generateDisplayFoundationDocs.ts exists
// because the equivalent hand-maintained list *had* already drifted — it
// claimed a foundation used by displays that did not compose it.
//
// What is generated is one row per display type registered for
// `LinearGenomeView`, naming which chrome its React component renders. That is
// the drift axis: a display that quietly stops rendering the chrome, or a new
// one that never started, changes a row rather than going unnoticed. Non-LGV
// views (dotplot, synteny, circular) are deliberately NOT here — they are off
// the chrome by design and for reasons prose has to give, so they stay prose.
//
// Resolution handles the four idioms a registration uses to name its component,
// because all four are in the tree today:
//
//   ReactComponent: lazy(() => import('./components/X.tsx'))   most displays
//   ReactComponent: X                    X imported from a relative path
//   ReactComponent: X                    X imported from '@jbrowse/plugin-*'
//   ReactComponent                       shorthand, after
//                                        `const { ReactComponent } =
//                                          pluginManager.getDisplayType('Y')`
//
// **An unresolvable registration is a hard error, never a dropped row.** A
// silently missing row is the exact failure this replaces: the table would look
// authoritative and be short. If a fifth idiom appears, this fails and names
// the file, which is the signal to teach it the idiom.
//
// Only the block between the markers is generated. Run: `pnpm autogen`
// (or `--check` in CI).
import { readFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'

import * as ts from 'typescript'

import {
  checkOrWrite,
  isFile,
  markdownTable,
  spliceGeneratedBlock,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const docPath = join(repoRoot, 'agent-docs', 'reference', 'DISPLAYCHROME.md')

// The two chrome components a display can render. `DisplayChrome` owns the
// rendering-backend hook; `DisplayStatusChrome` is everything below it, which
// is what a display with no backend (arc) renders directly.
const CHROMES = new Set(['DisplayChrome', 'DisplayStatusChrome'])

const LGV = 'LinearGenomeView'

interface Registration {
  /** Display type name, e.g. `LinearWiggleDisplay`. */
  name: string
  /** File the `new DisplayType({...})` call sits in. */
  file: string
  /** How the registration names its React component. */
  component:
    | { kind: 'module'; module: string }
    | { kind: 'borrowsDisplayType'; from: string }
    | { kind: 'borrowsExport'; pkg: string; exportName: string }
}

function parse(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

function literal(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined
}

function propertyOf(obj: ts.ObjectLiteralExpression, key: string) {
  for (const p of obj.properties) {
    if (p.name && ts.isIdentifier(p.name) && p.name.text === key) {
      return p
    }
  }
  return undefined
}

/** `lazy(() => import('X'))` → `'X'`, at any nesting. */
function lazyImportTarget(node: ts.Node): string | undefined {
  if (
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'lazy'
  ) {
    return undefined
  }
  let found: string | undefined
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      found ??= literal(n.arguments[0])
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

/**
 * Every `import`ed binding in a file, local name → module specifier. Type-only
 * imports are skipped: a component referenced only as a type is not the one
 * being registered.
 */
function importMap(src: ts.SourceFile) {
  const map = new Map<string, string>()
  for (const s of src.statements) {
    // `phaseModifier`, not the deprecated `isTypeOnly`: TS 6 widened the field
    // to carry `defer` as well as `type`.
    if (
      !ts.isImportDeclaration(s) ||
      !s.importClause ||
      s.importClause.phaseModifier === ts.SyntaxKind.TypeKeyword
    ) {
      continue
    }
    const module = literal(s.moduleSpecifier)
    if (!module) {
      continue
    }
    const { name, namedBindings } = s.importClause
    if (name) {
      map.set(name.text, module)
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const e of namedBindings.elements) {
        if (!e.isTypeOnly) {
          map.set(e.name.text, module)
        }
      }
    }
  }
  return map
}

/** `const X = lazy(() => import('...'))` declarations, local name → module. */
function lazyMap(src: ts.SourceFile) {
  const map = new Map<string, string>()
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer
    ) {
      const target = lazyImportTarget(n.initializer)
      if (target) {
        map.set(n.name.text, target)
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(src, visit)
  return map
}

/**
 * The display type named by a `getDisplayType('X')` call inside the function
 * enclosing `node` — how a registration borrows another display's registered
 * component without importing across the plugin boundary.
 */
function borrowedDisplayType(node: ts.Node): string | undefined {
  // Scoped to the enclosing function rather than the file, because a file can
  // register several display types (gccontent and LD each register two) and
  // only the one whose factory did the lookup is borrowing. `parent` is typed
  // non-optional but is genuinely absent above a SourceFile, so stop there.
  let scope = node
  while (!ts.isFunctionLike(scope)) {
    if (ts.isSourceFile(scope)) {
      return undefined
    }
    scope = scope.parent
  }
  let found: string | undefined
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'getDisplayType'
    ) {
      found ??= literal(n.arguments[0])
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(scope, visit)
  return found
}

function collectRegistrations(): Registration[] {
  const out: Registration[] = []
  // `plugins/*/node_modules` holds the per-package `@jbrowse/*` links a real
  // install creates, so walking into it re-reads the whole workspace through
  // symlinks — and finds the same registrations twice, under other paths.
  const skip = new Set(['node_modules', 'dist', 'esm', '__snapshots__'])
  // Test support registers display types too, and those are not adoption: ten
  // plugins carry a `testEnv.ts` that registers a stub with
  // `ReactComponent: () => null`. `testEnv.ts` is this repo's convention for
  // that file, so excluding it by name follows the convention rather than
  // guessing — and a stub would otherwise fail the run as an unresolvable
  // inline component, which is the loud failure working correctly on a file
  // that should never have been scanned.
  const isTestSupport = (n: string) =>
    n === 'testEnv.ts' || /\.test\.tsx?$/.test(n)
  for (const file of walkFiles(
    join(repoRoot, 'plugins'),
    n => /\.tsx?$/.test(n) && !isTestSupport(n),
    skip,
  )) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('new DisplayType(')) {
      continue
    }
    const src = parse(file)
    const imports = importMap(src)
    const lazies = lazyMap(src)
    const visit = (n: ts.Node) => {
      if (
        ts.isNewExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === 'DisplayType'
      ) {
        const [arg] = n.arguments ?? []
        if (arg && ts.isObjectLiteralExpression(arg)) {
          // `name` and `viewType` must be string literals in the object, the
          // same constraint `api-docs/util.ts` puts on the display↔track link
          // — and `plugins/variants/src/LDDisplay/index.ts` carries the comment
          // explaining what it cost to learn that: fed identifiers from a loop,
          // that scan silently finds nothing and both LD displays drop out of a
          // generated table with no error anywhere. So a present-but-computed
          // value throws here instead of skipping, since a missing row is the
          // failure this generator exists to prevent.
          const named = (key: string) => {
            const p = propertyOf(arg, key) as ts.PropertyAssignment | undefined
            if (!p) {
              return undefined
            }
            const value = literal(p.initializer)
            if (value === undefined) {
              throw new Error(
                `${rel(file)}: DisplayType \`${key}\` is not a string literal, so this registration cannot be read. Write it out literally (see the note in plugins/variants/src/LDDisplay/index.ts) rather than computing it.`,
              )
            }
            return value
          }
          const name = named('name')
          if (name && named('viewType') === LGV) {
            out.push({
              name,
              file,
              component: resolveComponent(arg, file, imports, lazies),
            })
          }
        }
      }
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(src, visit)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function resolveComponent(
  obj: ts.ObjectLiteralExpression,
  file: string,
  imports: Map<string, string>,
  lazies: Map<string, string>,
): Registration['component'] {
  const prop = propertyOf(obj, 'ReactComponent')
  if (!prop) {
    throw new Error(
      `${rel(file)}: a DisplayType registration has no ReactComponent. Every display registered for ${LGV} needs one; if that has genuinely changed, this generator needs to learn the new shape.`,
    )
  }
  // `ReactComponent,` shorthand means one of two different things, and a local
  // binding of that name wins: maf writes
  // `const ReactComponent = lazy(...)` at module scope and then uses the
  // shorthand, which is its own component, not a borrow. Only with no such
  // binding is the shorthand the registry borrow — the value destructured out
  // of `getDisplayType('Other')`.
  if (ts.isShorthandPropertyAssignment(prop)) {
    const local = lazies.get('ReactComponent') ?? imports.get('ReactComponent')
    if (local) {
      return { kind: 'module', module: moduleFrom(file, local) }
    }
    const from = borrowedDisplayType(prop)
    if (!from) {
      throw new Error(
        `${rel(file)}: \`ReactComponent\` shorthand with neither a local binding of that name nor a \`getDisplayType('...')\` in the enclosing function, so there is no way to tell which component is being registered.`,
      )
    }
    return { kind: 'borrowsDisplayType', from }
  }
  if (!ts.isPropertyAssignment(prop)) {
    throw new Error(`${rel(file)}: unsupported ReactComponent property shape`)
  }
  const init = prop.initializer
  // Inline `lazy(() => import('./x.tsx'))`.
  const inlineLazy = lazyImportTarget(init)
  if (inlineLazy) {
    return { kind: 'module', module: moduleFrom(file, inlineLazy) }
  }
  if (ts.isIdentifier(init)) {
    const viaLazy = lazies.get(init.text)
    if (viaLazy) {
      return { kind: 'module', module: moduleFrom(file, viaLazy) }
    }
    const module = imports.get(init.text)
    if (module?.startsWith('.')) {
      return { kind: 'module', module: moduleFrom(file, module) }
    }
    if (module?.startsWith('@jbrowse/plugin-')) {
      return { kind: 'borrowsExport', pkg: module, exportName: init.text }
    }
    throw new Error(
      `${rel(file)}: cannot resolve \`ReactComponent: ${init.text}\` — it is neither a lazy import, a relative import, nor a \`@jbrowse/plugin-*\` import.`,
    )
  }
  throw new Error(
    `${rel(file)}: cannot resolve ReactComponent (${ts.SyntaxKind[init.kind]}). Teach this generator the idiom rather than letting the row disappear.`,
  )
}

function rel(file: string) {
  return file.slice(repoRoot.length + 1)
}

/** Resolve a relative specifier against its importer, tolerating .ts/.tsx. */
function moduleFrom(importer: string, specifier: string) {
  const base = resolvePath(importer, '..', specifier)
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (isFile(c)) {
      return c
    }
  }
  throw new Error(
    `${rel(importer)}: import '${specifier}' resolves to no file on disk`,
  )
}

/**
 * Which chrome a component module renders, following the render tree. Returns
 * undefined for a component that renders neither — a real answer, and the row
 * that says an LGV display is off the chrome.
 *
 * A registered component does not always render the chrome itself: arc's
 * registers `<BaseDisplayComponent>`, a sibling module, and *that* renders
 * `<DisplayStatusChrome>`. So the walk follows any JSX element whose tag is a
 * relatively-imported binding — the render tree, not the import graph, which
 * would wander into every unrelated module a component happens to import.
 * Barrels and lazy boundaries are followed too, since either can sit between a
 * registration and the component.
 */
function chromeOf(
  module: string,
  seen = new Set<string>(),
): string | undefined {
  if (seen.has(module)) {
    return undefined
  }
  seen.add(module)
  const src = parse(module)
  const imports = importMap(src)
  const rendered = new Set<string>()
  let found: string | undefined
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (ts.isIdentifier(n.tagName)) {
        const tag = n.tagName.text
        if (CHROMES.has(tag)) {
          found ??= tag
        }
        rendered.add(tag)
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(src, visit)
  if (found) {
    return found
  }
  const next: string[] = []
  for (const tag of rendered) {
    const spec = imports.get(tag)
    if (spec?.startsWith('.')) {
      next.push(spec)
    }
  }
  for (const s of src.statements) {
    if (ts.isExportDeclaration(s) && !s.isTypeOnly) {
      const spec = literal(s.moduleSpecifier)
      if (spec?.startsWith('.')) {
        next.push(spec)
      }
    }
  }
  next.push(...lazyMap(src).values())
  for (const spec of next) {
    const chrome = chromeOf(moduleFrom(module, spec), seen)
    if (chrome) {
      return chrome
    }
  }
  return undefined
}

/** Resolve an `export { X as Y } from './p'` chain in a plugin's entry point. */
function moduleForPluginExport(pkg: string, exportName: string) {
  const entry = join(
    repoRoot,
    'plugins',
    pkg.replace('@jbrowse/plugin-', ''),
    'src',
    'index.ts',
  )
  if (!isFile(entry)) {
    throw new Error(
      `${pkg}: no src/index.ts to resolve '${exportName}' through`,
    )
  }
  const src = parse(entry)
  for (const s of src.statements) {
    if (
      !ts.isExportDeclaration(s) ||
      !s.exportClause ||
      !ts.isNamedExports(s.exportClause)
    ) {
      continue
    }
    const spec = literal(s.moduleSpecifier)
    for (const e of s.exportClause.elements) {
      if (e.name.text === exportName && spec?.startsWith('.')) {
        return moduleFrom(entry, spec)
      }
    }
  }
  throw new Error(
    `${pkg}: '${exportName}' is not re-exported from src/index.ts, so its component cannot be resolved`,
  )
}

interface Row {
  name: string
  chrome: string | undefined
  via: string
}

export function collectAdoption(): Row[] {
  const regs = collectRegistrations()
  const byName = new Map(regs.map(r => [r.name, r]))
  const resolve = (r: Registration, seen = new Set<string>()): Row => {
    if (seen.has(r.name)) {
      throw new Error(`${r.name}: circular ReactComponent borrow`)
    }
    seen.add(r.name)
    const { component } = r
    if (component.kind === 'module') {
      return {
        name: r.name,
        chrome: chromeOf(component.module),
        via: `\`${rel(component.module)}\``,
      }
    }
    if (component.kind === 'borrowsDisplayType') {
      const lender = byName.get(component.from)
      if (!lender) {
        throw new Error(
          `${r.name}: borrows the component of '${component.from}', which is not a registered ${LGV} display type`,
        )
      }
      return {
        name: r.name,
        chrome: resolve(lender, seen).chrome,
        via: `borrows ${component.from}`,
      }
    }
    return {
      name: r.name,
      chrome: chromeOf(
        moduleForPluginExport(component.pkg, component.exportName),
      ),
      via: `borrows \`${component.exportName}\``,
    }
  }
  return regs.map(r => resolve(r))
}

const rows = collectAdoption()
const counts = new Map<string, number>()
for (const r of rows) {
  const k = r.chrome ?? 'none'
  counts.set(k, (counts.get(k) ?? 0) + 1)
}

checkOrWrite({
  path: docPath,
  content: spliceGeneratedBlock({
    path: docPath,
    marker: 'DISPLAY_CHROME_ADOPTION',
    body: [
      `${rows.length} display types are registered for \`${LGV}\`: ` +
        [...counts]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) =>
            k === 'none' ? `${n} on neither` : `${n} on \`${k}\``,
          )
          .join(', ') +
        '.',
      '',
      ...markdownTable(
        ['Display type', 'Chrome', 'Component'],
        rows.map(
          r =>
            `| ${r.name} | ${r.chrome ? `\`${r.chrome}\`` : '—'} | ${r.via} |`,
        ),
      ),
    ],
  }),
  label: 'DisplayChrome adoption map',
  staleHint: 'run `pnpm autogen`',
})
