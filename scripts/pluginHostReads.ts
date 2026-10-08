// The `module#name` pairs an ES module plugin bundle reads off the host's
// JBrowseExports, from the parsed chunks. check-published-plugins.ts commits
// them per store plugin and check-plugin-reads.ts fails `pnpm autogen --check`
// when the ABI stops serving one.
//
// Parsed with scope analysis because minified chunks reuse one-letter names:
// joined into one text, a module alias in one chunk matches an unrelated local
// in another, and a regex over graphgenomeviewer 6.9.0 reported a thousand
// names beside the one real break.
//
// esbuild's shapes, which is what every v5 store plugin is built with:
//   X = __commonJS((exports, module) => { module.exports = JBrowseExports["mod"] })
//   Y = __toESM(X(), 1)          then  Y.name, Y.default
//   import { a as e } from './chunk.js'   naming another chunk's X or Y
//
// `default` off a `__toESM(m, 1)` wrapper is the served module itself, so it
// stands for the module and never for a name in it. `*` records a module
// that escapes as a value or is indexed dynamically: its names are unknown.
import * as acorn from 'acorn'
import { analyze } from 'eslint-scope'

import type { Scope } from 'eslint-scope'

type AnyNode = acorn.AnyNode

const HOST = 'JBrowseExports'

type Kind =
  | { t: 'shim'; mod: string }
  | { t: 'mod'; mod: string; viaDefault?: boolean }
  | { t: 'esm'; mod: string }

interface Chunk {
  url: string
  ast: acorn.Program
  parents: Map<AnyNode, AnyNode>
  imports: Map<string, { from: string; name: string }>
  exports: Map<string, { local: string; from?: string }>
  deps: string[]
  hostLookups: acorn.MemberExpression[]
  kinds: Map<string, Kind | undefined>
  moduleScope?: Scope
}

function isNode(v: unknown): v is AnyNode {
  return !!v && typeof (v as { type?: unknown }).type === 'string'
}

// Iterative: a minified chunk nests deeper than the stack allows.
function walk(root: AnyNode, visit: (node: AnyNode, parent?: AnyNode) => void) {
  const stack: [AnyNode, AnyNode | undefined][] = [[root, undefined]]
  while (stack.length > 0) {
    const [node, parent] = stack.pop()!
    visit(node, parent)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (isNode(child)) {
            stack.push([child, node])
          }
        }
      } else if (isNode(value)) {
        stack.push([value, node])
      }
    }
  }
}

function hostKey(n: AnyNode) {
  if (
    n.type !== 'MemberExpression' ||
    n.object.type !== 'Identifier' ||
    n.object.name !== HOST
  ) {
    return undefined
  }
  if (!n.computed) {
    return n.property.type === 'Identifier' ? n.property.name : undefined
  }
  return n.property.type === 'Literal' && typeof n.property.value === 'string'
    ? n.property.value
    : undefined
}

function propertyName(n: acorn.MemberExpression) {
  if (!n.computed) {
    return n.property.type === 'Identifier' ? n.property.name : undefined
  }
  return n.property.type === 'Literal' ? String(n.property.value) : undefined
}

const specifierName = (n: acorn.Identifier | acorn.Literal) =>
  n.type === 'Identifier' ? n.name : String(n.value)

export function hostReads(sources: Map<string, string>, entry: string) {
  const chunks = new Map<string, Chunk>()
  const reads = new Set<string>()
  const resolve = (spec: string, from: string) => new URL(spec, from).href

  function load(url: string) {
    const cached = chunks.get(url)
    if (cached) {
      return cached
    }
    const src = sources.get(url)
    if (src === undefined) {
      return undefined
    }
    const ast = acorn.parse(src, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
    })
    const c: Chunk = {
      url,
      ast,
      parents: new Map(),
      imports: new Map(),
      exports: new Map(),
      deps: [],
      hostLookups: [],
      kinds: new Map(),
    }
    chunks.set(url, c)
    walk(ast, (n, parent) => {
      if (parent) {
        c.parents.set(n, parent)
      }
      if (
        n.type === 'MemberExpression' &&
        n.object.type === 'Identifier' &&
        n.object.name === HOST
      ) {
        c.hostLookups.push(n)
      }
      if (
        n.type === 'ImportExpression' &&
        n.source.type === 'Literal' &&
        typeof n.source.value === 'string'
      ) {
        c.deps.push(resolve(n.source.value, url))
      }
    })
    for (const n of ast.body) {
      if (
        n.type === 'ImportDeclaration' &&
        String(n.source.value).startsWith('.')
      ) {
        const from = resolve(String(n.source.value), url)
        c.deps.push(from)
        for (const s of n.specifiers) {
          c.imports.set(s.local.name, {
            from,
            name:
              s.type === 'ImportSpecifier'
                ? specifierName(s.imported)
                : s.type === 'ImportDefaultSpecifier'
                  ? 'default'
                  : '*',
          })
        }
      } else if (n.type === 'ExportNamedDeclaration') {
        const from = n.source ? resolve(String(n.source.value), url) : undefined
        if (from) {
          c.deps.push(from)
        }
        for (const s of n.specifiers) {
          c.exports.set(specifierName(s.exported), {
            local: specifierName(s.local),
            from,
          })
        }
      } else if (n.type === 'ExportAllDeclaration') {
        c.deps.push(resolve(String(n.source.value), url))
      }
    }
    return c
  }

  function scopeOf(c: Chunk) {
    c.moduleScope ??= analyze(c.ast as never, {
      ecmaVersion: 2022,
      sourceType: 'module',
    }).globalScope!.childScopes[0]!
    return c.moduleScope
  }

  // the host module a function body assigns to `<x>.exports`
  function shimModule(fn: AnyNode | undefined) {
    if (
      fn?.type !== 'ArrowFunctionExpression' &&
      fn?.type !== 'FunctionExpression'
    ) {
      return undefined
    }
    let mod: string | undefined
    walk(fn.body, n => {
      if (
        n.type === 'AssignmentExpression' &&
        n.left.type === 'MemberExpression' &&
        propertyName(n.left) === 'exports'
      ) {
        mod = hostKey(n.right) ?? mod
      }
    })
    return mod
  }

  function isModuleRef(c: Chunk, id: acorn.Identifier) {
    return !!scopeOf(c)
      .set.get(id.name)
      ?.references.some(r => (r.identifier as unknown) === id)
  }

  function kindOf(
    c: Chunk,
    name: string,
    stack = new Set<string>(),
  ): Kind | undefined {
    if (c.kinds.has(name)) {
      return c.kinds.get(name)
    }
    const key = `${c.url}#${name}`
    if (stack.has(key)) {
      return undefined
    }
    stack.add(key)
    let out: Kind | undefined
    const imp = c.imports.get(name)
    if (imp) {
      const src = load(imp.from)
      const ex = src?.exports.get(imp.name)
      const owner = ex?.from ? load(ex.from) : src
      if (ex && owner) {
        out = kindOf(owner, ex.local, stack)
      }
    } else {
      const variable = scopeOf(c).set.get(name)
      const def = variable?.defs[0]
      const writes = variable?.references.filter(r => r.isWrite()) ?? []
      const declarator = def?.node as AnyNode | undefined
      if (
        variable?.defs.length === 1 &&
        def?.type === 'Variable' &&
        declarator?.type === 'VariableDeclarator' &&
        declarator.init &&
        writes.length === 1
      ) {
        out = kindOfExpr(c, declarator.init, stack)
      }
    }
    c.kinds.set(name, out)
    return out
  }

  function kindOfExpr(
    c: Chunk,
    e: AnyNode,
    stack: Set<string>,
  ): Kind | undefined {
    const direct = hostKey(e)
    if (direct) {
      return { t: 'mod', mod: direct }
    }
    if (e.type === 'Identifier') {
      return isModuleRef(c, e) ? kindOf(c, e.name, stack) : undefined
    }
    if (e.type !== 'CallExpression') {
      return undefined
    }
    const first = e.arguments[0]
    const shim = shimModule(first)
    if (shim) {
      return { t: 'shim', mod: shim }
    }
    if (e.callee.type === 'Identifier' && e.arguments.length === 0) {
      const k = kindOf(c, e.callee.name, stack)
      return k?.t === 'shim' ? { t: 'mod', mod: k.mod } : undefined
    }
    if (first) {
      const inner = kindOfExpr(c, first, stack)
      if (inner?.t === 'mod') {
        return { t: 'esm', mod: inner.mod }
      }
    }
    return undefined
  }

  // `expr` evaluates to host module `k.mod` or its __toESM wrapper; what is
  // read off it shows in how its parent uses it
  function recordUse(c: Chunk, expr: AnyNode, k: Kind) {
    const p = c.parents.get(expr)
    if (p?.type === 'MemberExpression' && p.object === expr) {
      const name = propertyName(p)
      if (name === undefined) {
        reads.add(`${k.mod}#*`)
      } else if (name === 'default' && k.t === 'esm') {
        reads.add(`${k.mod}#default`)
        recordUse(c, p, { t: 'mod', mod: k.mod, viaDefault: true })
      } else {
        reads.add(`${k.mod}#${name}`)
      }
      return
    }
    if (
      p?.type === 'VariableDeclarator' &&
      p.init === expr &&
      p.id.type === 'ObjectPattern'
    ) {
      for (const prop of p.id.properties) {
        if (prop.type === 'RestElement' || prop.computed) {
          reads.add(`${k.mod}#*`)
        } else {
          reads.add(`${k.mod}#${specifierName(prop.key as acorn.Identifier)}`)
        }
      }
      return
    }
    // a default import used as a value: called, extended, rendered
    if (!(k.t === 'mod' && k.viaDefault)) {
      reads.add(`${k.mod}#*`)
    }
  }

  function scan(c: Chunk) {
    const relevant =
      c.hostLookups.length > 0 ||
      [...c.imports.keys()].some(name => kindOf(c, name))
    if (!relevant) {
      return
    }
    for (const variable of scopeOf(c).variables) {
      const k = kindOf(c, variable.name)
      if (!k) {
        continue
      }
      for (const r of variable.references) {
        const n = r.identifier as unknown as acorn.Identifier
        const p = c.parents.get(n)
        if ((r.isWrite() && !r.isRead()) || p?.type === 'ExportSpecifier') {
          continue
        }
        if (k.t !== 'shim') {
          recordUse(c, n, k)
        } else if (p?.type === 'CallExpression' && p.callee === n) {
          // `Y = X()` and `Y = __toESM(X())` are tracked through Y instead
          const pp = c.parents.get(p)
          const declarator =
            pp?.type === 'CallExpression' ? c.parents.get(pp) : pp
          const bound =
            declarator?.type === 'VariableDeclarator' &&
            declarator.id.type === 'Identifier' &&
            kindOf(c, declarator.id.name)
          if (!bound) {
            recordUse(c, p, { t: 'mod', mod: k.mod })
          }
        } else {
          reads.add(`${k.mod}#*`)
        }
      }
    }
    for (const lookup of c.hostLookups) {
      const mod = hostKey(lookup)
      if (mod === undefined) {
        continue
      }
      const p = c.parents.get(lookup)
      const inShim =
        p?.type === 'AssignmentExpression' &&
        p.left.type === 'MemberExpression' &&
        propertyName(p.left) === 'exports'
      // `Y = lookup` and `Y = __toESM(lookup)` are tracked through Y instead
      const declarator = p?.type === 'CallExpression' ? c.parents.get(p) : p
      const tracked =
        declarator?.type === 'VariableDeclarator' &&
        declarator.id.type === 'Identifier' &&
        kindOf(c, declarator.id.name)
      if (!inShim && !tracked) {
        recordUse(c, lookup, { t: 'mod', mod })
      }
    }
  }

  const queue = [entry]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const url = queue.pop()!
    if (!seen.has(url)) {
      seen.add(url)
      queue.push(...(load(url)?.deps ?? []))
    }
  }
  for (const c of chunks.values()) {
    scan(c)
  }
  return [...reads].sort()
}

export interface AbiManifest {
  framework: Record<string, string[]>
  modules: Record<string, { names: string[] }>
}

// The plugin build keeps the pre-fork key for the state-tree package.
const ALIASES: Record<string, string> = {
  'mobx-state-tree': '@jbrowse/mobx-state-tree',
}

// Reads this ABI no longer serves. A framework module listed without names is
// served whole, so only its presence is checked.
export function unservedReads(reads: string[], manifest: AbiManifest) {
  return reads.filter(read => {
    const at = read.lastIndexOf('#')
    const mod = ALIASES[read.slice(0, at)] ?? read.slice(0, at)
    const name = read.slice(at + 1)
    const names = manifest.modules[mod]?.names ?? manifest.framework[mod]
    return (
      !names ||
      (name !== 'default' &&
        name !== '*' &&
        names.length > 0 &&
        !names.includes(name))
    )
  })
}

// What the offline gate reports. `accepted` maps a read to the reason it was
// removed while a store plugin still reads it; an entry that excuses nothing
// is stale, so the list empties itself as plugins release.
export function gatePluginReads(
  pluginReads: Record<string, string[]>,
  manifest: AbiManifest,
  accepted: Record<string, string>,
) {
  const unserved = Object.entries(pluginReads).map(([plugin, reads]) => ({
    plugin,
    gone: unservedReads(reads, manifest),
  }))
  const excused = new Set(unserved.flatMap(r => r.gone))
  return {
    broken: unserved
      .map(({ plugin, gone }) => ({
        plugin,
        gone: gone.filter(read => !(read in accepted)),
      }))
      .filter(r => r.gone.length > 0),
    stale: Object.keys(accepted).filter(read => !excused.has(read)),
  }
}
