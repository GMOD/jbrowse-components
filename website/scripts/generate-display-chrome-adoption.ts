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
// `LinearGenomeView`, naming which chrome it renders **on screen and on
// export**. Those are two independent drift axes over the same set of displays:
// a display that quietly stops rendering the chrome, or a new one that never
// started, changes a row rather than going unnoticed. Non-LGV views (dotplot,
// synteny, circular) are deliberately NOT here — they are off the chrome by
// design and for reasons prose has to give, so they stay prose.
//
// The export column exists because the SVG side had the same drift axis and no
// guard. It was audited by hand once, in 2026-08, and came back clean; a
// hand-audit that has to be repeated is the thing this file replaces. The two
// columns are resolved from the two halves of the same registration:
//
//   ReactComponent  →  the render tree  →  DisplayChrome / DisplayStatusChrome
//   stateModel      →  renderSvg        →  SvgChrome
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
// and the two a `stateModel` uses:
//
//   stateModel: modelFactory(configSchema)          most displays
//   stateModel                                      shorthand, after
//                                                   `const stateModel =
//                                                     modelFactory(schema)`
//
// **An unresolvable registration is a hard error, never a dropped row.** A
// silently missing row is the exact failure this replaces: the table would look
// authoritative and be short. If a fifth idiom appears, this fails and names
// the file, which is the signal to teach it the idiom.
//
// Only the block between the markers is generated. Run: `pnpm autogen`
// (or `--check` in CI).
import { readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'

import * as ts from 'typescript'

import {
  checkOrWrite,
  isFile,
  markdownTableLines,
  spliceGeneratedBlock,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const docPath = join(repoRoot, 'agent-docs', 'reference', 'DISPLAYCHROME.md')

// The two chrome components a display can render. `DisplayChrome` owns the
// rendering-backend hook; `DisplayStatusChrome` is everything below it, which
// is what a display with no backend (arc) renders directly.
const CHROMES = new Set(['DisplayChrome', 'DisplayStatusChrome'])

// The export-side counterpart, and there is only one of it: `SvgChrome` has a
// single terminal (regionTooLarge) where the on-screen chrome has five, and the
// asymmetry is argued in `packages/core/src/svg/SvgExport.tsx` rather than being
// decay. So the SVG column's information is not *which* chrome but whether the
// display reaches it, and by which route.
const SVG_CHROME = 'SvgChrome'

const LGV = 'LinearGenomeView'

/** How a registration names one of its two resolvable members. */
type Ref =
  | { kind: 'module'; module: string }
  | { kind: 'borrowsDisplayType'; from: string }
  | { kind: 'borrowsExport'; pkg: string; exportName: string }

interface Registration {
  /** Display type name, e.g. `LinearWiggleDisplay`. */
  name: string
  /** File the `new DisplayType({...})` call sits in. */
  file: string
  /** How the registration names its React component. */
  component: Ref
  /** Module of the factory the registration's `stateModel` calls. */
  model: string
}

// Memoized: resolution walks the same modules from many starting points — one
// display's registration reaches `renderDisplaySvg.tsx` and every other
// display's does too, so a run parsed it 38 times, and 171 parses covered ~60
// distinct files. Nothing here mutates a tree, so one parse per file is the
// same answer for a third of the work.
const parsed = new Map<string, ts.SourceFile>()

function parse(file: string) {
  let src = parsed.get(file)
  if (!src) {
    src = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    parsed.set(file, src)
  }
  return src
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

/** A module-scope `function name(){}` or `const name = () => {}`. */
function moduleScopeFunction(src: ts.SourceFile, name: string) {
  for (const s of src.statements) {
    if (ts.isFunctionDeclaration(s) && s.name?.text === name) {
      return s
    }
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const init = d.initializer
        if (
          ts.isIdentifier(d.name) &&
          d.name.text === name &&
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          return init
        }
      }
    }
  }
  return undefined
}

/** The object literals a module-scope function returns. */
function returnedObjectLiterals(src: ts.SourceFile, name: string) {
  const fn = moduleScopeFunction(src, name)
  const out: ts.ObjectLiteralExpression[] = []
  const body = fn?.body
  if (!body) {
    return out
  }
  if (!ts.isBlock(body)) {
    const expr = ts.isParenthesizedExpression(body) ? body.expression : body
    if (ts.isObjectLiteralExpression(expr)) {
      out.push(expr)
    }
    return out
  }
  for (const st of body.statements) {
    if (st.kind === ts.SyntaxKind.ReturnStatement) {
      const expr = (st as ts.ReturnStatement).expression
      if (expr && ts.isObjectLiteralExpression(expr)) {
        out.push(expr)
      }
    }
  }
  return out
}

/**
 * A property of a registration's object literal, following `...helper(...)`
 * spreads into the object that helper returns. The LD pair is registered that
 * way: `...makeLDStateModel('LDDisplay')` supplies both `configSchema` and
 * `stateModel`, because the two registrations differ only in their names and
 * the helper is how they avoid being a loop — see the comment in
 * `plugins/variants/src/LDDisplay/index.ts` for why a loop is not an option.
 *
 * Only same-file helpers are followed, which is every one today and is what
 * keeps the caller's import map the right one to resolve the result against.
 */
function registrationProperty(
  obj: ts.ObjectLiteralExpression,
  key: string,
  src: ts.SourceFile,
  seen = new Set<ts.Node>(),
): ts.ObjectLiteralElementLike | undefined {
  const direct = propertyOf(obj, key)
  if (direct) {
    return direct
  }
  for (const p of obj.properties) {
    if (!ts.isSpreadAssignment(p) || !ts.isCallExpression(p.expression)) {
      continue
    }
    const callee = p.expression.expression
    if (!ts.isIdentifier(callee)) {
      continue
    }
    for (const returned of returnedObjectLiterals(src, callee.text)) {
      if (seen.has(returned)) {
        continue
      }
      seen.add(returned)
      const hit = registrationProperty(returned, key, src, seen)
      if (hit) {
        return hit
      }
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
  // Test support registers display types too, and those are not adoption: a
  // dozen plugins carry a harness that registers a stub with
  // `ReactComponent: () => null`. Excluded by name, because the names are a
  // convention rather than a guess — `testEnv.ts` in 13 places and
  // `testUtils.ts` in 4. Both, not one: the list was `testEnv.ts` alone until
  // an alignments harness picked the other name and failed the whole run as an
  // unresolvable inline component. That is the loud failure working correctly
  // on a file that should never have been scanned, so widen the names here
  // rather than teaching the resolver a stub idiom — resolving it would put a
  // test harness in the adoption map as though it shipped.
  const isTestSupport = (n: string) =>
    /^(testEnv|testUtils)\.tsx?$/.test(n) || /\.test\.tsx?$/.test(n)
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
              component: resolveComponent(arg, src, file, imports, lazies),
              model: resolveStateModel(arg, src, file, imports),
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
  src: ts.SourceFile,
  file: string,
  imports: Map<string, string>,
  lazies: Map<string, string>,
): Registration['component'] {
  const prop = registrationProperty(obj, 'ReactComponent', src)
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

/**
 * The module of the factory a registration's `stateModel` calls — the entry
 * point of the model half, as `resolveComponent` is of the component half.
 *
 * Unlike `ReactComponent` there is no registry borrow to handle: a display that
 * wants another's model composes the factory inside its own, which is
 * `modelChainBases`' problem rather than this one's.
 */
function resolveStateModel(
  obj: ts.ObjectLiteralExpression,
  src: ts.SourceFile,
  file: string,
  imports: Map<string, string>,
): string {
  const prop = registrationProperty(obj, 'stateModel', src)
  if (!prop) {
    throw new Error(
      `${rel(file)}: a DisplayType registration has no stateModel. Every display registered for ${LGV} needs one; if that has genuinely changed, this generator needs to learn the new shape.`,
    )
  }
  // `stateModel,` shorthand, after `const stateModel = factory(configSchema)` —
  // four registrations do this so they can name the model before the object.
  const init = ts.isShorthandPropertyAssignment(prop)
    ? localBinding(prop, 'stateModel')
    : ts.isPropertyAssignment(prop)
      ? prop.initializer
      : undefined
  if (!init) {
    throw new Error(
      `${rel(file)}: cannot read the \`stateModel\` of a DisplayType registration — a shorthand with no \`const stateModel = ...\` in the enclosing function, or a property shape this generator has not been taught.`,
    )
  }
  const bases = modelChainBases(init, localBindings(init))
  // One base is what every registration has today: `factory(configSchema)`,
  // possibly with `.named(...).props(...)` chained on. A registration that
  // composes two models inline would land here with two, and picking one would
  // silently report half the model — so it fails and asks to be taught.
  if (bases.size !== 1) {
    throw new Error(
      `${rel(file)}: \`stateModel\` resolves to ${bases.size} base factories (${[...bases].join(', ') || 'none'}), and this generator reads exactly one. Teach it the idiom rather than letting the row report half a model.`,
    )
  }
  const [base] = [...bases]
  const module = moduleForName(base!, file, imports)
  if (!module) {
    throw new Error(
      `${rel(file)}: cannot resolve the \`stateModel\` factory \`${base}\` — it is neither a relative import nor a \`@jbrowse/plugin-*\` one.`,
    )
  }
  return module
}

/** The initializer of a `const <name> = ...` in the function enclosing `node`. */
function localBinding(node: ts.Node, name: string): ts.Expression | undefined {
  let scope: ts.Node = node
  while (!ts.isFunctionLike(scope)) {
    if (ts.isSourceFile(scope)) {
      return undefined
    }
    scope = scope.parent
  }
  let found: ts.Expression | undefined
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer
    ) {
      found ??= n.initializer
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(scope, visit)
  return found
}

/** Every `const x = ...` in the function enclosing `node`, by name. */
function localBindings(node: ts.Node): Map<string, ts.Expression> {
  const map = new Map<string, ts.Expression>()
  let scope: ts.Node = node
  while (!ts.isFunctionLike(scope)) {
    if (ts.isSourceFile(scope)) {
      return map
    }
    scope = scope.parent
  }
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer
    ) {
      if (!map.has(n.name.text)) {
        map.set(n.name.text, n.initializer)
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(scope, visit)
  return map
}

/**
 * The factories a model expression is built out of — the MST equivalent of the
 * render tree the component half walks. Two positions count, and both are in
 * the tree today:
 *
 *   return baseFactory(schema).props({...}).views(...)   the chain's base
 *   types.compose('X', baseFactory(schema), types.model({...}))   an argument
 *
 * `locals` resolves `const baseModel = factory(schema)`, which three displays
 * write before composing it. `types.*` calls other than `compose` terminate:
 * `types.model({...})` adds props, never a `renderSvg`.
 */
function modelChainBases(
  expr: ts.Expression,
  locals: Map<string, ts.Expression>,
  out = new Set<string>(),
  seen = new Set<ts.Node>(),
): Set<string> {
  if (seen.has(expr)) {
    return out
  }
  seen.add(expr)
  if (ts.isParenthesizedExpression(expr)) {
    return modelChainBases(expr.expression, locals, out, seen)
  }
  if (ts.isIdentifier(expr)) {
    const init = locals.get(expr.text)
    if (init) {
      modelChainBases(init, locals, out, seen)
    } else {
      out.add(expr.text)
    }
    return out
  }
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression
    if (ts.isPropertyAccessExpression(callee)) {
      if (
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'types'
      ) {
        if (callee.name.text === 'compose') {
          for (const a of expr.arguments) {
            modelChainBases(a, locals, out, seen)
          }
        }
        return out
      }
      // `.props(...)` / `.views(...)` / `.named(...)` — the receiver is the base.
      return modelChainBases(callee.expression, locals, out, seen)
    }
    if (ts.isIdentifier(callee)) {
      out.add(callee.text)
    }
  }
  return out
}

/**
 * A module for an imported binding: the file itself for a relative import, for
 * a `@jbrowse/plugin-*` one the file that actually declares the name (a plugin
 * entry point re-exports through a display's barrel, and the barrel is not
 * where the model lives), and for a workspace package subpath
 * (`@jbrowse/display-kit/renderDisplaySvg`) the source file its `exports` map
 * names — which is how every `renderSvg.tsx` reaches the export chrome.
 * Undefined for a bare package barrel: `@jbrowse/core` exports helpers, never
 * a display model.
 */
function moduleForName(
  name: string,
  file: string,
  imports: Map<string, string>,
): string | undefined {
  const spec = imports.get(name)
  if (spec?.startsWith('.')) {
    return moduleFrom(file, spec)
  }
  if (spec?.startsWith('@jbrowse/plugin-')) {
    return findPluginExport(spec, name)
  }
  if (spec?.startsWith('@jbrowse/')) {
    return workspaceSubpathModule(spec)
  }
  return undefined
}

/**
 * The source file behind `@jbrowse/<package>/<subpath>`, off the package's own
 * `exports` map. Undefined for a barrel import or an unknown subpath.
 */
function workspaceSubpathModule(spec: string): string | undefined {
  const [, pkg, ...rest] = spec.split('/')
  if (!pkg || rest.length === 0) {
    return undefined
  }
  const manifest = join(repoRoot, 'packages', pkg, 'package.json')
  if (!isFile(manifest)) {
    return undefined
  }
  const { exports } = JSON.parse(readFileSync(manifest, 'utf8')) as {
    exports?: Record<string, string>
  }
  const target = exports?.[`./${rest.join('/')}`]
  return target ? join(repoRoot, 'packages', pkg, target) : undefined
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

/** Where a display's `renderSvg` is declared, and what it delegates to. */
interface SvgRoute {
  /** Model module whose `.actions()` declares `renderSvg`. */
  model: string
  /** The module that declaration hands the export to. */
  body: string
}

/** Module-scope function declarations and `const f = () => ...` bindings. */
function topLevelFunctions(src: ts.SourceFile) {
  const out: (
    | ts.FunctionDeclaration
    | ts.ArrowFunction
    | ts.FunctionExpression
  )[] = []
  for (const s of src.statements) {
    if (ts.isFunctionDeclaration(s)) {
      out.push(s)
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const init = d.initializer
        if (
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          out.push(init)
        }
      }
    }
  }
  return out
}

/**
 * The factories a module's own model factories compose, read off their `return`
 * statements. Scoped to module-scope functions on purpose: a model file is
 * mostly `.views(self => ({...}))` and `.actions(self => ({...}))` callbacks,
 * which return objects rather than models, and following every `return` in the
 * file would walk into whatever a helper happens to call.
 */
function factoryBases(src: ts.SourceFile) {
  const out = new Set<string>()
  for (const fn of topLevelFunctions(src)) {
    const { body } = fn
    if (!body) {
      continue
    }
    if (!ts.isBlock(body)) {
      modelChainBases(body, localBindings(body), out)
      continue
    }
    for (const st of body.statements) {
      if (ts.isReturnStatement(st) && st.expression) {
        modelChainBases(st.expression, localBindings(st.expression), out)
      }
    }
  }
  return out
}

/** The `renderSvg` action of a model, at any depth inside its `.actions()`. */
function renderSvgMethod(src: ts.SourceFile) {
  let found: ts.Node | undefined
  const visit = (n: ts.Node) => {
    if (
      (ts.isMethodDeclaration(n) || ts.isPropertyAssignment(n)) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'renderSvg'
    ) {
      found ??= n
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(src, visit)
  return found
}

/**
 * The module a `renderSvg` action hands the export to. Every display writes the
 * same two lines — `const { renderSvg } = await import('./renderSvg.tsx')` —
 * which keeps the export path out of the bundle until someone exports; a static
 * import of the same function is accepted as the other way to spell it.
 */
function delegateOf(
  method: ts.Node,
  file: string,
  imports: Map<string, string>,
) {
  let dynamic: string | undefined
  const called = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        dynamic ??= literal(n.arguments[0])
      } else if (ts.isIdentifier(n.expression)) {
        called.add(n.expression.text)
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(method, visit)
  if (dynamic?.startsWith('.')) {
    return moduleFrom(file, dynamic)
  }
  for (const name of called) {
    const module = moduleForName(name, file, imports)
    if (module) {
      return module
    }
  }
  return undefined
}

/**
 * Where a display's SVG export is implemented: the model module declaring
 * `renderSvg`, and the module that declaration delegates to. Undefined when no
 * model in the composition chain declares one — a real answer, and the row that
 * says an LGV display cannot be exported at all.
 *
 * A display need not declare it itself. `LGVSyntenyDisplay` composes the
 * alignments model and inherits its export, the same way it borrows the
 * alignments component on the other half of the registration — so a missing
 * `renderSvg` here means following what the factory composes, not stopping.
 */
function renderSvgRouteOf(
  module: string,
  seen = new Set<string>(),
): SvgRoute | undefined {
  if (seen.has(module)) {
    return undefined
  }
  seen.add(module)
  const src = parse(module)
  const imports = importMap(src)
  const method = renderSvgMethod(src)
  if (method) {
    const body = delegateOf(method, module, imports)
    // Same doctrine as an unresolvable registration: a `renderSvg` whose body
    // this cannot follow would otherwise be reported as no chrome at all, which
    // is a false accusation rather than a missing row.
    if (!body) {
      throw new Error(
        `${rel(module)}: \`renderSvg\` delegates to nothing this generator can follow — neither a relative \`await import('...')\` nor a call to an imported function. Teach it the idiom rather than letting the row claim the export is off the chrome.`,
      )
    }
    return { model: module, body }
  }
  for (const name of factoryBases(src)) {
    const next = moduleForName(name, module, imports)
    const route = next && renderSvgRouteOf(next, seen)
    if (route) {
      return route
    }
  }
  return undefined
}

/**
 * Whether an export body reaches `SvgChrome`, following the call tree the way
 * `chromeOf` follows the render tree. Two hops are needed in the tree today:
 * most `renderSvg.tsx` call `renderDisplaySvg`, which renders the chrome, but
 * arc's calls `renderArcSvg` first and that calls `renderDisplaySvg`.
 *
 * `renderDisplaySvg` is followed rather than trusted by name, so the claim that
 * a display is on the chrome is derived at both hops.
 */
function svgChromeOf(module: string, seen = new Set<string>()): boolean {
  if (seen.has(module)) {
    return false
  }
  seen.add(module)
  const src = parse(module)
  const imports = importMap(src)
  // Rendered as JSX or called outright — the chrome is reached either way, and
  // one set of names covers both the terminal test and what to follow next.
  const used = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (ts.isIdentifier(n.tagName)) {
        used.add(n.tagName.text)
      }
    } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      used.add(n.expression.text)
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(src, visit)
  if (used.has(SVG_CHROME)) {
    return true
  }
  for (const name of used) {
    const next = moduleForName(name, module, imports)
    if (next && svgChromeOf(next, seen)) {
      return true
    }
  }
  return false
}

/**
 * Whether a module declares `name` itself, rather than re-exporting it.
 *
 * `default` counts, and has to: the models are re-exported as
 * `export { default as modelFactory } from './model.ts'`, so `declaringModule`
 * recurses looking for the name `default`. Without this arm nothing ever
 * matched it, the chain "ran out", and the answer came from the fallback below
 * — which happened to be the same file, so the bug was invisible. It fired for
 * the alignments, wiggle and canvas base models, i.e. the three most-composed
 * models in the tree, which is a lot of weight on a documented last resort. The
 * risk was never the answer, it was the next person tightening that fallback
 * into a throw on the reasonable belief that it was exceptional.
 */
function declaresName(src: ts.SourceFile, name: string) {
  for (const s of src.statements) {
    const isDefaultExport =
      ts.canHaveModifiers(s) &&
      !!ts.getModifiers(s)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) {
      if (s.name?.text === name || (name === 'default' && isDefaultExport)) {
        return true
      }
    }
    // `export default <expr>`, the other way to spell it
    if (ts.isExportAssignment(s) && !s.isExportEquals && name === 'default') {
      return true
    }
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * The module that actually declares `name`, following `export { A as B } from
 * './p'` chains. One hop is not enough: a plugin's entry point re-exports
 * through the *display's* barrel, so `@jbrowse/plugin-canvas` →
 * `LinearBasicDisplay/index.ts` → `baseModel.ts`, and stopping at the barrel
 * names a file that holds two different models. Which one matters, because the
 * barrel is where `LinearBasicDisplay`'s model and the base every other canvas
 * display composes both come from.
 *
 * A re-export chain that runs out before a declaration returns the last module
 * it reached, which is the best answer available and the one-hop behaviour this
 * replaced.
 */
function declaringModule(
  module: string,
  name: string,
  seen = new Set<string>(),
): string | undefined {
  const key = `${module}#${name}`
  if (seen.has(key)) {
    return undefined
  }
  seen.add(key)
  const src = parse(module)
  if (declaresName(src, name)) {
    return module
  }
  for (const s of src.statements) {
    if (!ts.isExportDeclaration(s) || s.isTypeOnly) {
      continue
    }
    const spec = literal(s.moduleSpecifier)
    if (!spec?.startsWith('.')) {
      continue
    }
    const target = moduleFrom(module, spec)
    if (!s.exportClause) {
      const hit = declaringModule(target, name, seen)
      if (hit) {
        return hit
      }
      continue
    }
    if (!ts.isNamedExports(s.exportClause)) {
      continue
    }
    for (const e of s.exportClause.elements) {
      if (e.isTypeOnly || e.name.text !== name) {
        continue
      }
      return (
        declaringModule(target, e.propertyName?.text ?? name, seen) ?? target
      )
    }
  }
  return undefined
}

/** `declaringModule` from a plugin's entry point. Undefined if it has none. */
function findPluginExport(pkg: string, exportName: string) {
  const entry = join(
    repoRoot,
    'plugins',
    pkg.replace('@jbrowse/plugin-', ''),
    'src',
    'index.ts',
  )
  return isFile(entry) ? declaringModule(entry, exportName) : undefined
}

/** The throwing form, for a registration that must resolve or fail the run. */
function moduleForPluginExport(pkg: string, exportName: string) {
  const module = findPluginExport(pkg, exportName)
  if (!module) {
    throw new Error(
      `${pkg}: '${exportName}' is not re-exported from src/index.ts, so its component cannot be resolved`,
    )
  }
  return module
}

interface Row {
  name: string
  /** On-screen chrome the registered component renders. */
  chrome: string | undefined
  /** Where that component is. */
  via: string
  /** Whether the export reaches `SvgChrome`. */
  svgChrome: boolean
  /** Where the export body is, and whether the display declares it itself. */
  svgVia: string
}

/** The component half — which on-screen chrome, and where the component is. */
type ComponentRow = Pick<Row, 'name' | 'chrome' | 'via'>

function collectAdoption(): Row[] {
  const regs = collectRegistrations()
  const byName = new Map(regs.map(r => [r.name, r]))
  const resolve = (r: Registration, seen = new Set<string>()): ComponentRow => {
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
  return regs.map(r => {
    const route = renderSvgRouteOf(r.model)
    // "inherits" is the model half's answer to the component half's "borrows":
    // the display composes another display's model rather than declaring a
    // `renderSvg` of its own. Keyed on the *directory*, not the module, because
    // a display routinely splits its model across `model.ts` and `baseModel.ts`
    // and inheriting from the file next door is not a borrow — the four real
    // ones all reach across a plugin boundary. Either way the export body is
    // named rather than the lending model, since the body is the file the
    // chrome is reached from.
    const inherited = !!route && dirname(route.model) !== dirname(r.model)
    return {
      ...resolve(r),
      svgChrome: !!route && svgChromeOf(route.body),
      svgVia: !route
        ? '—'
        : inherited
          ? `inherits \`${rel(route.body)}\``
          : `\`${rel(route.body)}\``,
    }
  })
}

const rows = collectAdoption()
const counts = new Map<string, number>()
for (const r of rows) {
  const k = r.chrome ?? 'none'
  counts.set(k, (counts.get(k) ?? 0) + 1)
}
const onSvgChrome = rows.filter(r => r.svgChrome).length

checkOrWrite({
  path: docPath,
  content: spliceGeneratedBlock({
    path: docPath,
    marker: 'DISPLAY_CHROME_ADOPTION',
    body: [
      `${rows.length} display types are registered for \`${LGV}\`: ${[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) =>
          k === 'none' ? `${n} on neither` : `${n} on \`${k}\``,
        )
        .join(', ')}. On export, ${
        onSvgChrome === rows.length
          ? `all ${rows.length}`
          : `${onSvgChrome} of ${rows.length}`
      } reach \`${SVG_CHROME}\`.`,
      '',
      ...markdownTableLines(
        ['Display type', 'Chrome', 'Component', 'SVG chrome', 'renderSvg'],
        rows.map(
          r =>
            `| ${r.name} | ${r.chrome ? `\`${r.chrome}\`` : '—'} | ${r.via} | ${
              r.svgChrome ? `\`${SVG_CHROME}\`` : '—'
            } | ${r.svgVia} |`,
        ),
      ),
    ],
  }),
  label: 'DisplayChrome adoption map',
  staleHint: 'run `pnpm autogen`',
})
