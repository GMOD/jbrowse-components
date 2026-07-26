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

// Every module-scope `(public)? static const <type> NAME = <expr>;`, keyed by
// name with the raw right-hand side as the value.
function parseConstDecls(source: string) {
  const constRe =
    /^\s*(?:public\s+)?static\s+const\s+(?:float|int|uint)\s+(\w+)\s*=\s*([^;]+);/gm
  const decls = new Map<string, string>()
  for (let m = constRe.exec(source); m; m = constRe.exec(source)) {
    decls.set(m[1]!, m[2]!.trim())
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
export function parseVertsPerInstance(source: string) {
  const decls = parseConstDecls(source)
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
export function parseExportedConsts(source: string) {
  const directive = /^\/\/!\s*export-consts:\s*(.+)/m.exec(source)
  if (!directive) {
    return undefined
  }
  const names = directive[1]!
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const decls = parseConstDecls(source)
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
