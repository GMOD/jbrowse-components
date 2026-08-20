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

// Additionally allowed in RETURN position only. A decision whose answer is a
// pair is still scalar in every other respect; the emitter models a returned
// `float2` and nothing else about vectors, so a `float2` *parameter* would be
// refused several steps later by a message about WGSL rather than about this
// directive. See WgslReturnType in wgslToJs.ts.
const SLANG_RETURN_ONLY = new Set(['float2'])

// Statement keywords that can open a line looking like a function signature.
const SLANG_KEYWORDS = new Set(['else', 'do', 'return'])

/**
 * Blank out every comment, keeping the source's length and line structure so
 * the regexes below see the same columns and `^` anchors they would have.
 *
 * Everything that reads a `.slang` as text has to do this first. A LINE comment
 * happens to be self-defending — the patterns here all anchor at `^\s*`, and
 * `//` isn't whitespace — but a BLOCK comment is not: a `static const` or a
 * function signature sitting in one is indistinguishable from a live
 * declaration, and these files carry long block comments explaining the math
 * they replaced. Reading a decommissioned constant back out and emitting it as
 * a TS export is the failure, and it is silent.
 *
 * Note the directive parsers run on the RAW source: `//!` is itself a line
 * comment.
 */
export function stripComments(source: string) {
  return source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, m =>
    m.replaceAll(/[^\n]/g, ' '),
  )
}

/** A module-scope `static const`, with the declared type kept — see `narrow`. */
interface ConstDecl {
  type: 'float' | 'int' | 'uint'
  expr: string
}

// Every module-scope `(public)? static const <type> NAME = <expr>;`, keyed by
// name.
//
// `imported` holds the sources of the modules the shader `import`s, resolved by
// the driver. Slang sees those constants, so this has to as well — otherwise a
// shader that wants `CURVE_SEGMENTS * 6u` has to spell the product literally
// and keep it in step by hand, which is the exact drift this file exists to
// remove. The local source wins on a name collision, matching Slang's shadowing.
function parseConstDecls(source: string, imported: readonly string[] = []) {
  const constRe =
    /^\s*(?:public\s+)?static\s+const\s+(float|int|uint)\s+(\w+)\s*=\s*([^;]+);/gm
  const decls = new Map<string, ConstDecl>()
  for (const raw of [source, ...imported]) {
    const src = stripComments(raw)
    constRe.lastIndex = 0
    for (let m = constRe.exec(src); m; m = constRe.exec(src)) {
      if (!decls.has(m[2]!)) {
        decls.set(m[2]!, {
          type: m[1]! as ConstDecl['type'],
          expr: m[3]!.trim(),
        })
      }
    }
  }
  return decls
}

/**
 * Apply the constant's DECLARED Slang type to the value JS arithmetic produced.
 *
 * The declared type used to be discarded — matched by the regex above and
 * dropped in a non-capturing group — so every constant was evaluated as a
 * float64 and emitted as one. That is wrong for the two things Slang's integer
 * types do that JS's numbers don't, and it is wrong SILENTLY, in the same
 * shader constants `wgslToJs.ts` refuses-on-doubt about one file over:
 *
 *   static const uint FLAG   = 1u << 31;   // 2147483648  emitted -2147483648
 *   static const uint MASK   = ~0u;        // 4294967295  emitted          -1
 *   static const uint SCHEME = (1u<<30)|(1u<<31);        emitted -1073741824
 *
 * JS's bitwise operators are exactly int32 two's complement, so a chain of them
 * is bit-correct and only the interpretation is off — one `>>> 0` at the end
 * recovers Slang's value. `+ - *` agree with Slang below 2^32 and wrap the same
 * way through the same coercion, up to the safe-integer check below.
 *
 * Division is the case that cannot be repaired after the fact: Slang truncates
 * an integer quotient and JS does not, and once a negative intermediate has been
 * divided the sign has contaminated the magnitude (`(1u<<31)/2u` is 1073741824
 * in Slang and -1073741824 in JS, which no final reinterpretation fixes). So it
 * is refused for an integer-typed constant rather than guessed at, which is the
 * same call `wgslToJs.ts` makes for the same reason.
 */
function narrow(value: number, type: ConstDecl['type'], what: string) {
  if (type === 'float') {
    return value
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${what}: '${type}' constant did not evaluate to an exact integer (got ` +
        `${value}). Slang would have computed this in 32-bit integer ` +
        `arithmetic; the evaluator works in float64 and will not guess where ` +
        `the two differ.`,
    )
  }
  return type === 'uint' ? value >>> 0 : value | 0
}

// Evaluate a Slang constant expression to a number, resolving references to
// other `static const`s in the same file the way the shader itself sees them
// (`16u * 6`, `(ARC_CURVE_SEGMENTS + 1u) * 2u`). Each referenced constant is
// narrowed to ITS OWN declared type at the point of substitution, so a `uint`
// referenced from a `float` expression still arrives unsigned.
function evalConstExpr(
  raw: string,
  type: ConstDecl['type'],
  decls: Map<string, ConstDecl>,
  what: string,
  evaluating = new Set<string>(),
): number {
  // Hex first, and to a decimal literal rather than through the suffix strip:
  // `0xffffffffu` would otherwise reach the identifier pass below as the
  // unresolvable name `xffffffffu`, since the leading `0` is all that reads as
  // a number. Hex is how a u32 sentinel gets spelled (`NO_PREV_START`), and it
  // is the only constant form the evaluator could not see.
  const dehexed = raw.replaceAll(/0[xX]([0-9a-fA-F]+)[uU]?\b/g, (_m, digits) =>
    String(Number.parseInt(digits as string, 16)),
  )
  // Strip Slang's literal type suffix so it doesn't leave a stray letter the
  // identifier pass would fail to resolve. The FLOAT suffixes matter as much as
  // the integer ones: `0.5f` is an ordinary Slang literal and reported
  // `references unknown identifier f`. The leading `(?<![\w.])` keeps the match
  // anchored at the start of a number, so a constant named `X1u` isn't clipped.
  const stripped = dehexed.replaceAll(
    /(?<![\w.])((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[uUlLfFhH]\b/g,
    '$1',
  )
  // Replace identifier references with their resolved numeric values. The
  // lookbehind is what lets an exponent through: in `1e-6` the `e` is part of
  // the literal, not a name, and treating it as one was why the allow-list
  // below could permit scientific notation that never reached it.
  const cleaned = stripped.replaceAll(/(?<![\d.])[A-Za-z_]\w*/g, name => {
    if (evaluating.has(name)) {
      throw new Error(`${what}: circular static-const reference: ${name}`)
    }
    const ref = decls.get(name)
    if (ref === undefined) {
      throw new Error(`${what}: references unknown identifier ${name}`)
    }
    evaluating.add(name)
    const value = narrow(
      evalConstExpr(ref.expr, ref.type, decls, what, evaluating),
      ref.type,
      `${what} -> ${name}`,
    )
    evaluating.delete(name)
    return `(${value})`
  })
  // Arithmetic plus the bitwise operators, which Slang and JS agree on for the
  // 32-bit ints these constants are (a scheme bitmask is built as
  // `(1 << CS_A) | (1 << CS_B)`). A stray comparison would evaluate to a
  // boolean, which the isFinite check below rejects.
  if (!/^[\d.\seE+\-*/%()<>|&^~]+$/.test(cleaned)) {
    throw new Error(
      `${what} must be a numeric arithmetic expression; got: ${raw} ` +
        `(post-substitution: ${cleaned})`,
    )
  }
  // See `narrow`: an integer quotient is the one divergence a later coercion
  // cannot undo, so it is refused where it appears rather than at the result.
  if (type !== 'float' && /[/%]/.test(cleaned)) {
    throw new Error(
      `${what}: '${type}' constant divides (${raw}). Slang truncates an ` +
        `integer quotient and JS does not, and the evaluator will not guess ` +
        `which one you meant. Spell the result, or declare the constant ` +
        `'float' if the division really is a float one.`,
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
  const decl = decls.get('VERTS_PER_INSTANCE')
  if (decl === undefined) {
    return undefined
  }
  const what = 'static const VERTS_PER_INSTANCE'
  const n = narrow(
    evalConstExpr(decl.expr, decl.type, decls, what),
    decl.type,
    what,
  )
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
      `//! export-consts names no such 'static const' in this shader: ${missing.join(
        ', ',
      )}`,
    )
  }
  return Object.fromEntries(
    names.map(n => {
      const decl = decls.get(n)!
      const what = `export-const ${n}`
      return [
        n,
        narrow(
          evalConstExpr(decl.expr, decl.type, decls, what),
          decl.type,
          what,
        ),
      ]
    }),
  )
}

// `//! js-export: fnA, fnB` — emit TS twins of these Slang functions so the
// Canvas2D/SVG path runs the shader's own math instead of a hand-written copy.
// Named functions must live in the scalar subset `wgslToJs.ts` supports, and in
// a `module` file must additionally be `public` — a module-private one isn't
// visible to the synthesized wrapper the driver compiles. Both failures are
// reported at `pnpm gen:shaders`.
//
// `importedSources` lets a shader export a function authored in a module it
// imports. The caller passes them ONLY for a shader with entry points, where
// the twin is lifted from that shader's own compiled WGSL and the draw path is
// what keeps the function alive. A module file gets none, because its export
// path compiles a synthesized wrapper that `import`s just the one module —
// Slang does not re-export a grandparent's symbols, so a name from further up
// would vanish between here and the WGSL.
//
// Why a shader would want this: the decision belongs in the shared module (it
// is what the module's own clip-space functions are built on), but `js-export`
// emits one file per shader and `js-export-out` redirects all of it. Exporting
// from the *pass* is how a module-authored decision reaches a package the
// module's own plugin cannot write into — the coverage band's px layout is
// authored in alignmentsUniforms and lifted by coverage.slang into
// @jbrowse/alignments-core.
export function parseJsExports(
  source: string,
  importedSources: readonly string[] = [],
) {
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
  const declared = parseDeclaredFunctions([...importedSources, source])
  const missing = names.filter(n => !declared.has(n))
  if (missing.length > 0) {
    // The `|| '(none)'` has to bind to the joined list, not to the whole
    // concatenation — which is never falsy, so a bare `||` at the end is dead
    // code and an empty module reports "Declared: " with nothing after it.
    const candidates = [...declared.keys()].sort().join(', ') || '(none)'
    throw new Error(
      `//! js-export names no such 'public' function in this shader: ` +
        `${missing.join(', ')}. Declared: ${candidates}${
          importedSources.length === 0
            ? `. (Only this file's own functions are in scope here — a module ` +
              `exports through a synthesized wrapper that cannot see what the ` +
              `module itself imports.)`
            : ''
        }`,
    )
  }
  const fns = names.map(n => declared.get(n)!)
  // Reject non-scalar signatures here rather than letting wgslToJs discover
  // them after a compile: the message can name the function and the type.
  for (const fn of fns) {
    const bad = unsupportedSignatureTypes(fn)
    if (bad.length > 0) {
      throw new Error(
        `//! js-export: ${fn.name} uses unsupported type(s) ` +
          `${[...new Set(bad)].join(', ')}. The JS emitter covers scalars ` +
          `(${[...SLANG_SCALARS].join(', ')}), plus ` +
          `${[...SLANG_RETURN_ONLY].join(', ')} as a return type — factor the ` +
          `supported part of the computation into its own public function and ` +
          `export that.`,
      )
    }
  }
  return fns
}

/**
 * Every `[public] <returnType> <name>(<params>)` these sources declare, keyed by
 * name, later sources winning — so a shader's own definition beats an imported
 * one of the same name, which is the one slangc will have compiled.
 *
 * Split out of `parseJsExports` because the differential oracle needs the same
 * enumeration for a different question: not "is this name real" but "what else
 * in this file could be swept". A second regex over the same syntax is how the
 * two would come to disagree about what counts as a declaration.
 */
export function parseDeclaredFunctions(sources: readonly string[]) {
  // Slang's `[public] <returnType> <name>(<params>)`. Parsing the signature
  // (rather than just the name) is what lets a driver synthesize an entry point
  // that references each function, so slangc emits its body instead of
  // dead-code-eliminating it. A typo then fails at codegen with the candidate
  // list rather than as an "absent from the compiled WGSL" error after a slangc
  // round-trip. `public` is optional because a shader with entry points has no
  // wrapper to be visible to — its own draw path keeps the function alive — and
  // marking a function in such a file `public` is noise.
  const declared = new Map<string, JsExportFn>()
  const fnRe =
    /^\s*(?:public\s+)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm
  for (const raw of sources) {
    const src = stripComments(raw)
    fnRe.lastIndex = 0
    for (let m = fnRe.exec(src); m; m = fnRe.exec(src)) {
      // `else if (...) {` reads as a two-identifier signature. Nothing
      // downstream would resolve it, but it would sit in the "Declared:" list a
      // typo prints.
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
  }
  return declared
}

/**
 * The types in this signature the emitter does not cover, in signature order —
 * empty when it covers all of them.
 *
 * One function rather than two spellings of the rule. `parseJsExports` needs the
 * offending names for its message and `check-oracle` needs the yes/no, and each
 * had its own predicate over the same two sets, sixty lines apart in this file.
 * Widening the subset touches one of them by default: a `float2` *parameter*
 * added to `isSupportedSignature` alone would put functions in the oracle's
 * sweep that `//! js-export` still refuses, and added to the inline copy alone
 * would export functions the oracle then declines to check. Same hazard this
 * file already names for `parseDeclaredFunctions` — "a second regex over the
 * same syntax is how the two would come to disagree" — one level up, in the
 * types rather than the syntax.
 */
function unsupportedSignatureTypes(fn: JsExportFn) {
  return [
    // A float2 return is in the subset; a float2 anywhere else is not, so it is
    // dropped from the check here rather than added to SLANG_SCALARS.
    ...(SLANG_RETURN_ONLY.has(fn.returnType) ? [] : [fn.returnType]),
    ...fn.paramTypes,
  ].filter(t => !SLANG_SCALARS.has(t))
}

/** Whether the emitter can handle this signature — scalars, plus float2 out. */
export function isSupportedSignature(fn: JsExportFn) {
  return unsupportedSignatureTypes(fn).length === 0
}

export interface JsSkip {
  name: string
  reason: string
}

/**
 * `//! js-skip: <fn> — <why not>`, one per line, repeatable.
 *
 * The counterpart to `js-export`, and the reason the generated liftability
 * inventory is readable: most functions the emitter *could* lift should not be
 * lifted — a clip-space wrapper, a per-fragment antialiasing ramp with no
 * Canvas2D counterpart — and a report that lists those next to the real
 * candidates every time is a report whose diff means nothing.
 *
 * The decision therefore lives next to the code it is about, and is checked:
 * `assertJsSkipsResolve` fails the build on a skip naming a function the
 * emitter cannot see, or one that is exported after all. That is the part a
 * prose list in an ADR cannot do — the old "Deliberately not exported" section
 * had an entry (`textWidth`) that had quietly become false, and nothing said so.
 *
 * The separator is an em dash or a double hyphen; everything after it is free
 * text and lands in the report verbatim.
 */
export function parseJsSkips(source: string): JsSkip[] {
  const out: JsSkip[] = []
  for (const m of source.matchAll(
    /^\/\/!\s*js-skip:\s*(\w+)\s*(?:—|--)\s*(.+)$/gm,
  )) {
    out.push({ name: m[1]!, reason: m[2]!.trim() })
  }
  const malformed = [...source.matchAll(/^\/\/!\s*js-skip:\s*(.*)$/gm)].filter(
    m => !/^\w+\s*(?:—|--)\s*\S/.test(m[1]!),
  )
  if (malformed.length > 0) {
    throw new Error(
      `//! js-skip must read '<function> — <why not>' (em dash or --); got: ${malformed
        .map(m => JSON.stringify(m[1]))
        .join(', ')}`,
    )
  }
  return out
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

/**
 * `//! topology: <t>` and `//! blend: <mode>` — the two pieces of pipeline state
 * that follow from what the shader's stages actually do, emitted so a pass reads
 * them off the shader instead of restating them.
 *
 * Topology is a property of `vs_main`: it decides what a `SV_VertexID` means,
 * and `arc.slang`'s strip and everything else's list are not interchangeable.
 * Blend is a property of `fs_main`: whether it returns premultiplied or straight
 * alpha, or (the AA line case) wants coverage unioned rather than accumulated.
 * Both lived at the `slangPass()` call three packages away, where nothing
 * connected them to the stage that determines them.
 *
 * They are **defaults, not verdicts**, and that distinction is load-bearing
 * rather than caution: `wiggleLine.slang` is drawn by two passes at two
 * different blends (the step line src-over, the center line max), so a shader
 * that carries one blend for all its passes would be wrong. A pass may always
 * override, the same way `verticesPerInstance` overrides `VERTS_PER_INSTANCE`
 * — and a shader whose passes disagree simply declares neither and says so at
 * each pass.
 */
const TOPOLOGIES = ['triangle-list', 'triangle-strip', 'line-list'] as const
export type Topology = (typeof TOPOLOGIES)[number]

/**
 * The blend modes, named for what the fragment stage produces rather than for
 * the factor pair it implies.
 *
 * Named rather than spelled as raw factors (`//! blend: one,
 * one-minus-src-alpha`) because the factors are the consequence and the reason
 * is what a reader needs: five shaders in the tree carry that exact pair, and
 * all five carry it for the one reason, which the raw spelling states nowhere.
 * A closed set is also checkable — an unknown mode names the alternatives.
 *
 * `none` is deliberately absent. Nothing in the tree disables blending, and an
 * emitted `BLEND_ENABLED = false` with no consumer is the untested path this
 * codegen refuses elsewhere; a pass that wants it passes `blend: false`.
 */
export const BLEND_MODES = ['straight', 'premultiplied', 'max'] as const
export type BlendMode = (typeof BLEND_MODES)[number]

function parseChoice<T extends string>(
  source: string,
  kind: string,
  allowed: readonly T[],
): T | undefined {
  const match = new RegExp(String.raw`^//!\s*${kind}:\s*(.+)`, 'm').exec(source)
  if (!match) {
    return undefined
  }
  const value = match[1]!.trim()
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `//! ${kind}: unknown value '${value}' (supported: ${allowed.join(', ')})`,
    )
  }
  return value as T
}

export function parseTopology(source: string) {
  return parseChoice(source, 'topology', TOPOLOGIES)
}

export function parseBlend(source: string) {
  return parseChoice(source, 'blend', BLEND_MODES)
}

/**
 * `//! instance-writer` — emit the append-at-a-time `InstanceWriter` class.
 *
 * Opt-in, where `packInstances` and the per-field accessors are emitted for every
 * shader, and the asymmetry is deliberate rather than an oversight. A generated
 * module is imported as a namespace (`import * as readShader`), which marks every
 * export used, so everything a `.iface.generated.ts` carries is paid for by every
 * eager importer of it. Two encoders in the tree want a writer; emitting one into
 * the other forty modules would put a class nobody calls into the always-loaded
 * chunk.
 *
 * Relaxing this is a one-line change once no `.iface.generated.ts` is eager —
 * drop the flag and emit unconditionally. That is not yet true and the check is
 * cheap: `pnpm probe-eager-graph --page synteny --holds iface.generated` in the
 * byo examples site currently names eight, hic and the four synteny shaders among
 * them, none of which wants a writer. (Splitting the `export-consts` into their
 * own module took the largest of them, `read.iface.generated.ts`, out of the
 * eager set entirely, so this list only gets shorter.)
 */
export function parseInstanceWriter(source: string) {
  return /^\/\/!\s*instance-writer\s*$/m.test(source)
}

/**
 * The `//! <kind>-out: <repo-relative path>` directives, which redirect one
 * generated artifact to a second location for a package that can't import the
 * plugin owning the shader.
 *
 * - `layout-out` — the instance stride + per-view offset maps only.
 * - `consts-out` — the `export-consts` values only. A shader constant whose
 *   Canvas2D twin lives in a *different* package (alignments-core can't import
 *   from plugins/alignments) otherwise has to be re-typed there by hand under a
 *   SYNC comment.
 * - `js-export-out` — the `js-export` twins. This one *redirects* rather than
 *   adding: the twin is one file either way, and writing a byte-identical copy
 *   next to the shader as well would leave an artifact nothing imports. The
 *   insertion bar width is shared by plugin-alignments, plugin-maf and the
 *   worker-side hit test, so it lives in alignments-core.
 *
 * One list, because `assertOutPathsUnique` has to enumerate every kind: a fourth
 * directive added as its own parser would compile, work, and silently not be
 * checked for collisions — which is the failure that assertion exists to
 * prevent.
 */
export const OUT_DIRECTIVES = ['layout', 'consts', 'js-export'] as const
export type OutDirective = (typeof OUT_DIRECTIVES)[number]

export function parseOutPath(source: string, kind: OutDirective) {
  const match = new RegExp(String.raw`^//!\s*${kind}-out:\s*(\S+)`, 'm').exec(
    source,
  )
  return match ? match[1]! : undefined
}

// Two .slang files naming the same `//! *-out` path would race, since files
// compile concurrently, and win nondeterministically. Serially they merely
// overwrote each other — already a bug, since one of the two shaders' numbers
// then silently isn't what the importing package reads — so say so rather than
// making it intermittent.
export function assertOutPathsUnique(
  files: readonly { path: string; source: string }[],
) {
  const owner = new Map<string, string>()
  for (const f of files) {
    for (const out of OUT_DIRECTIVES.map(k => parseOutPath(f.source, k))) {
      if (out === undefined) {
        continue
      }
      const prior = owner.get(out)
      if (prior !== undefined) {
        throw new Error(
          `${out} is written by two shaders: ${prior} and ${f.path}. ` +
            `Only one may own a generated file.`,
        )
      }
      owner.set(out, f.path)
    }
  }
}
