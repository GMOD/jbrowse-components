// Whether the RPC worker would evaluate a rendering library by serving an
// export of the runtime plugin ABI for real. Under `sideEffects: false` a
// bundler keeps what a barrel's used names need, so the walk follows each
// value import and re-export by binding name to the module that declares it,
// and stops at third-party specifiers. A namespace import takes a module
// whole, and so does a module that runs code of its own at load, since a
// bundler keeps its statements and what they reference.
//
// A name renders when that walk keeps a renderer, or keeps a Material icon
// while the declaring module's whole graph names a renderer: the menu layer of
// a rendering module. An icon alone does not render. The state models and
// plugin classes the worker must serve for real (createBaseTrackModel's Save
// item, the wiggle score menus) name icons, which keeps Material's icon
// machinery in the worker either way.
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import * as ts from 'typescript'

const RENDERER =
  /^(react-dom(\/.*)?|@mui\/material(\/[A-Z].*)?|@mui\/x-.*|@floating-ui\/.*)$/
const ICON = /^@mui\/icons-material(\/.*)?$/

const WHOLE = '*'
const OWN_IMPORTS = ''

interface Binding {
  spec: string
  name: string
}

interface Parsed {
  names: Set<string>
  stars: string[]
  bare: string[]
  imports: Map<string, Binding>
  reexports: Map<string, Binding>
  exportedLocals: Map<string, string>
  evaluates: boolean
}

type Edge = { spec: string } | { file: string; name: string }

type Walk = 'byName' | 'whole'

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

function parseSource(file: string): Parsed {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const out: Parsed = {
    names: new Set(),
    stars: [],
    bare: [],
    imports: new Map(),
    reexports: new Map(),
    exportedLocals: new Map(),
    evaluates: source.statements.some(evaluates),
  }
  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text
      if (!clause) {
        out.bare.push(spec)
      } else if (!clause.isTypeOnly) {
        if (clause.name) {
          out.imports.set(clause.name.text, { spec, name: 'default' })
        }
        const bindings = clause.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) {
          out.imports.set(bindings.name.text, { spec, name: WHOLE })
        } else if (bindings) {
          for (const el of bindings.elements) {
            if (!el.isTypeOnly) {
              out.imports.set(el.name.text, {
                spec,
                name: (el.propertyName ?? el.name).text,
              })
            }
          }
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
      } else if (ts.isNamespaceExport(clause)) {
        out.names.add(clause.name.text)
        out.reexports.set(clause.name.text, { spec: spec!, name: WHOLE })
      } else {
        for (const el of clause.elements) {
          if (!el.isTypeOnly) {
            const local = (el.propertyName ?? el.name).text
            out.names.add(el.name.text)
            if (spec) {
              out.reexports.set(el.name.text, { spec, name: local })
            } else {
              out.exportedLocals.set(el.name.text, local)
            }
          }
        }
      }
    } else if (ts.isExportAssignment(stmt)) {
      out.names.add('default')
      if (ts.isIdentifier(stmt.expression)) {
        out.exportedLocals.set('default', stmt.expression.text)
      }
    } else if (
      hasModifier(stmt, ts.SyntaxKind.ExportKeyword) &&
      !hasModifier(stmt, ts.SyntaxKind.DeclareKeyword)
    ) {
      if (hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) {
        out.names.add('default')
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          bindingNames(decl.name, out.names)
        }
      } else if (
        (ts.isFunctionDeclaration(stmt) ||
          ts.isClassDeclaration(stmt) ||
          (ts.isEnumDeclaration(stmt) &&
            !hasModifier(stmt, ts.SyntaxKind.ConstKeyword))) &&
        stmt.name
      ) {
        out.names.add(stmt.name.text)
      }
    }
  }
  return out
}

export function resolveRelative(from: string, spec: string) {
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

// `resolvePackage` maps a bare specifier to a workspace source file, or to
// undefined for a third-party one.
export function createReExportReach(
  resolvePackage: (spec: string) => string | undefined,
) {
  const parsed = new Map<string, Parsed>()
  const parse = (file: string) => {
    let out = parsed.get(file)
    if (!out) {
      out = parseSource(file)
      parsed.set(file, out)
    }
    return out
  }

  const resolve = (from: string, spec: string) =>
    spec.startsWith('.') ? resolveRelative(from, spec) : resolvePackage(spec)

  function runtimeExportNames(
    file: string,
    seen = new Set<string>(),
  ): Set<string> {
    const { names, stars } = parse(file)
    const out = new Set(names)
    for (const spec of stars) {
      const target = resolve(file, spec)
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

  function edgesOf(file: string, name: string, walk: Walk): Edge[] {
    const p = parse(file)
    const edge = ({ spec, name }: Binding): Edge => {
      const target = resolve(file, spec)
      return target ? { file: target, name } : { spec }
    }
    const whole = (spec: string) => edge({ spec, name: WHOLE })
    const imported = (b: Binding) =>
      walk === 'byName' ? edge(b) : whole(b.spec)
    if (name === OWN_IMPORTS) {
      return [...p.bare.map(whole), ...[...p.imports.values()].map(imported)]
    }
    if (name === WHOLE) {
      return [
        { file, name: OWN_IMPORTS },
        ...[...p.reexports.values()].map(imported),
        ...p.stars.map(whole),
      ]
    }
    const out: Edge[] = p.evaluates ? [{ file, name: WHOLE }] : []
    const local = p.exportedLocals.get(name)
    const binding =
      p.reexports.get(name) ??
      (local === undefined ? undefined : p.imports.get(local))
    if (binding) {
      out.push(edge(binding))
    } else if (p.names.has(name)) {
      out.push({ file, name: walk === 'byName' ? OWN_IMPORTS : WHOLE })
    } else {
      const spec = p.stars.find(s =>
        runtimeExportNames(resolve(file, s)!).has(name),
      )
      if (spec) {
        out.push(edge({ spec, name }))
      }
    }
    return out
  }

  const edgeCache = new Map<string, Edge[]>()

  function reachedSpecifiers(file: string, name: string, walk: Walk) {
    const specs = new Set<string>()
    const seen = new Set<string>()
    const pending = [{ file, name }]
    while (pending.length > 0) {
      const node = pending.pop()!
      const key = `${walk}\0${node.name}\0${node.file}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      let edges = edgeCache.get(key)
      if (!edges) {
        edges = edgesOf(node.file, node.name, walk)
        edgeCache.set(key, edges)
      }
      for (const next of edges) {
        if ('spec' in next) {
          specs.add(next.spec)
        } else {
          pending.push(next)
        }
      }
    }
    return [...specs]
  }

  // What makes serving `name` of `file` (the whole module when `name` is
  // omitted) evaluate a rendering library: the renderers it keeps, else the
  // icons it keeps inside a module that renders. Empty when it is served real.
  function uiVia(file: string, name = WHOLE) {
    const kept = reachedSpecifiers(file, name, 'byName')
    const renderers = kept.filter(s => RENDERER.test(s))
    if (renderers.length > 0) {
      return renderers.sort()
    }
    const icons = kept.filter(s => ICON.test(s))
    return icons.length > 0 &&
      reachedSpecifiers(file, name, 'whole').some(s => RENDERER.test(s))
      ? icons.sort()
      : []
  }

  return { runtimeExportNames, uiVia }
}
