// Pure parsers for the `//!` directives and the module-scope `static const`
// declarations the codegen lifts out of a `.slang` source. Slang's reflection
// JSON doesn't expose module-scope constants, so these read the source text.
//
// They live here rather than in the driver so they're unit-testable and so
// `VERTS_PER_INSTANCE` and `//! export-consts` share ONE constant-expression
// evaluator: before, the former resolved identifier arithmetic (`(N + 1u) * 2u`)
// while the latter ran `parseFloat` and silently emitted `NaN` for anything
// that wasn't a bare literal.

export type ShaderTarget = 'wgsl' | 'glsl'
const TARGETS: readonly ShaderTarget[] = ['wgsl', 'glsl']

export interface JsExportFn {
  name: string
  returnType: string
  paramTypes: string[]
}

const SLANG_SCALARS = new Set(['float', 'uint', 'int', 'bool'])

// Statement keywords that can open a line looking like a function signature.
const SLANG_KEYWORDS = new Set(['else', 'do', 'return'])

// Every module-scope `(public)? static const <type> NAME = <expr>;`, keyed by
// name with the raw right-hand side as the value.
//
// `imported` holds the sources of the modules the shader `import`s, resolved by
// the driver. Slang sees those constants, so this has to as well — otherwise a
// shader that wants `CURVE_SEGMENTS * 6u` has to spell the product literally
// and keep it in step by hand, which is the exact drift this file exists to
// remove. The local source wins on a name collision, matching Slang's shadowing.
function parseConstDecls(source: string, imported: readonly string[] = []) {
  const constRe =
    /^\s*(?:public\s+)?static\s+const\s+(?:float|int|uint)\s+(\w+)\s*=\s*([^;]+);/gm
  const decls = new Map<string, string>()
  for (const src of [source, ...imported]) {
    constRe.lastIndex = 0
    for (let m = constRe.exec(src); m; m = constRe.exec(src)) {
      if (!decls.has(m[1]!)) {
        decls.set(m[1]!, m[2]!.trim())
      }
    }
  }
  return decls
}

// Evaluate a Slang constant expression to a number, resolving references to
// other `static const`s in the same file the way the shader itself sees them
// (`16u * 6`, `(ARC_CURVE_SEGMENTS + 1u) * 2u`).
function evalConstExpr(
  raw: string,
  decls: Map<string, string>,
  what: string,
  evaluating = new Set<string>(),
): number {
  // Strip Slang's `u` / `U` integer suffix first so `1u` doesn't leave a stray
  // `u` that the identifier pass would fail to resolve.
  const stripped = raw.replaceAll(/(\d+)[uU]\b/g, '$1')
  // Replace identifier references with their resolved numeric values.
  const cleaned = stripped.replaceAll(/[A-Za-z_]\w*/g, name => {
    if (evaluating.has(name)) {
      throw new Error(`${what}: circular static-const reference: ${name}`)
    }
    const ref = decls.get(name)
    if (ref === undefined) {
      throw new Error(`${what}: references unknown identifier ${name}`)
    }
    evaluating.add(name)
    const value = evalConstExpr(ref, decls, what, evaluating)
    evaluating.delete(name)
    return `(${value})`
  })
  // Arithmetic plus the bitwise operators, which Slang and JS agree on for the
  // 32-bit ints these constants are (a scheme bitmask is built as
  // `(1 << CS_A) | (1 << CS_B)`). A stray comparison would evaluate to a
  // boolean, which the isFinite check below rejects.
  if (!/^[\d.\se+\-*/%()<>|&^~]+$/.test(cleaned)) {
    throw new Error(
      `${what} must be a numeric arithmetic expression; got: ${raw} ` +
        `(post-substitution: ${cleaned})`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const value = new Function(`"use strict"; return (${cleaned})`)() as number
  if (!Number.isFinite(value)) {
    throw new Error(`${what} did not evaluate to a finite number; got ${value}`)
  }
  return value
}

// Resolves `(public)? static const uint VERTS_PER_INSTANCE`, the per-instance
// vertex count `slangPass()` reads off the generated module.
export function parseVertsPerInstance(
  source: string,
  imported: readonly string[] = [],
) {
  const decls = parseConstDecls(source, imported)
  const expr = decls.get('VERTS_PER_INSTANCE')
  if (expr === undefined) {
    return undefined
  }
  const n = evalConstExpr(expr, decls, 'static const VERTS_PER_INSTANCE')
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `static const VERTS_PER_INSTANCE must be a positive integer; got ${n}`,
    )
  }
  return n
}

// `//! export-consts: A, B` — re-emits those shader constants as TS so the
// JS/Canvas2D twin of a pass shares the exact value. A name that isn't declared
// in the file is an error: silently omitting it moved the failure to whichever
// TS file imported the missing export, or (worse, when a whole group was
// misspelled) to no failure at all.
export function parseExportedConsts(
  source: string,
  imported: readonly string[] = [],
) {
  const directive = /^\/\/!\s*export-consts:\s*(.+)/m.exec(source)
  if (!directive) {
    return undefined
  }
  const names = directive[1]!
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const decls = parseConstDecls(source, imported)
  const missing = names.filter(n => !decls.has(n))
  if (missing.length > 0) {
    throw new Error(
      `//! export-consts names no such 'static const' in this shader: ` +
        missing.join(', '),
    )
  }
  return Object.fromEntries(
    names.map(n => [
      n,
      evalConstExpr(decls.get(n)!, decls, `export-const ${n}`),
    ]),
  )
}

// `//! js-export: fnA, fnB` — emit TS twins of these Slang functions so the
// Canvas2D/SVG path runs the shader's own math instead of a hand-written copy.
// Named functions must live in the scalar subset `wgslToJs.ts` supports, and in
// a `module` file must additionally be `public` — a module-private one isn't
// visible to the synthesized wrapper the driver compiles. Both failures are
// reported at `pnpm gen:shaders`.
export function parseJsExports(source: string) {
  const directive = /^\/\/!\s*js-export:\s*(.+)/m.exec(source)
  if (!directive) {
    return undefined
  }
  const names = directive[1]!
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (names.length === 0) {
    throw new Error(`//! js-export names no functions`)
  }
  // Slang's `[public] <returnType> <name>(<params>)`. Parsing the signature here
  // (rather than just the name) is what lets the driver synthesize a wrapper
  // entry point that references each function, so slangc emits its body instead
  // of dead-code-eliminating it. A typo then fails at codegen with the
  // candidate list rather than as an "absent from the compiled WGSL" error
  // after a slangc round-trip. `public` is optional because a shader with entry
  // points has no wrapper to be visible to — its own draw path keeps the
  // function alive — and marking a function in such a file `public` is noise.
  const declared = new Map<string, JsExportFn>()
  const fnRe =
    /^\s*(?:public\s+)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm
  for (let m = fnRe.exec(source); m; m = fnRe.exec(source)) {
    // `else if (...) {` reads as a two-identifier signature. Nothing downstream
    // would resolve it, but it would sit in the "Declared:" list a typo prints.
    if (SLANG_KEYWORDS.has(m[1]!)) {
      continue
    }
    const paramTypes = m[3]!
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(p => p.split(/\s+/)[0]!)
    declared.set(m[2]!, { name: m[2]!, returnType: m[1]!, paramTypes })
  }
  const missing = names.filter(n => !declared.has(n))
  if (missing.length > 0) {
    // The `|| '(none)'` has to bind to the joined list, not to the whole
    // concatenation — which is never falsy, so a bare `||` at the end is dead
    // code and an empty module reports "Declared: " with nothing after it.
    const candidates = [...declared.keys()].sort().join(', ') || '(none)'
    throw new Error(
      `//! js-export names no such 'public' function in this shader: ` +
        `${missing.join(', ')}. Declared: ${candidates}`,
    )
  }
  const fns = names.map(n => declared.get(n)!)
  // Reject non-scalar signatures here rather than letting wgslToJs discover
  // them after a compile: the message can name the function and the type.
  for (const fn of fns) {
    const bad = [fn.returnType, ...fn.paramTypes].filter(
      t => !SLANG_SCALARS.has(t),
    )
    if (bad.length > 0) {
      throw new Error(
        `//! js-export: ${fn.name} uses non-scalar type(s) ` +
          `${[...new Set(bad)].join(', ')}. The JS emitter covers scalars ` +
          `(${[...SLANG_SCALARS].join(', ')}) only — factor the scalar part of ` +
          `the computation into its own public function and export that.`,
      )
    }
  }
  return fns
}

// `//! targets: wgsl, glsl` — which backends to emit. Default: both.
export function parseTargets(source: string): ShaderTarget[] {
  const match = /^\/\/!\s*targets:\s*(.+)/m.exec(source)
  if (!match) {
    return [...TARGETS]
  }
  const requested = match[1]!
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const unknown = requested.filter(
    (s): s is string => !TARGETS.includes(s as ShaderTarget),
  )
  if (unknown.length > 0) {
    throw new Error(
      `//! targets: unknown target(s) ${unknown.join(', ')} ` +
        `(supported: ${TARGETS.join(', ')})`,
    )
  }
  if (requested.length === 0) {
    throw new Error(`//! targets: names no targets`)
  }
  return requested as ShaderTarget[]
}

// `//! layout-out: <repo-relative path>` — write an instance-layout-only module
// to a second location, for packages that can't import the owning plugin.
export function parseLayoutOut(source: string) {
  const match = /^\/\/!\s*layout-out:\s*(\S+)/m.exec(source)
  return match ? match[1]! : undefined
}

// `//! consts-out: <repo-relative path>` — the same escape hatch for
// `export-consts`. A shader constant whose Canvas2D twin lives in a *different*
// package (alignments-core can't import from plugins/alignments) otherwise has
// to be re-typed there by hand under a SYNC comment.
export function parseConstsOut(source: string) {
  const match = /^\/\/!\s*consts-out:\s*(\S+)/m.exec(source)
  return match ? match[1]! : undefined
}

// `//! js-export-out: <repo-relative path>` — the same escape hatch again, for
// `js-export`. It *redirects* rather than adding: the twin is one file either
// way, and writing a byte-identical copy next to the shader as well would leave
// an artifact nothing imports. Reach for it when the function's Canvas2D
// consumer is in a package that can't depend on the shader's own — the
// insertion bar width is shared by plugin-alignments, plugin-maf and the
// worker-side hit test, so it lives in alignments-core.
export function parseJsExportOut(source: string) {
  const match = /^\/\/!\s*js-export-out:\s*(\S+)/m.exec(source)
  return match ? match[1]! : undefined
}
