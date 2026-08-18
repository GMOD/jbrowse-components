// Translate the scalar subset of slangc's WGSL output into TypeScript, so the
// Canvas2D/SVG path can call the *same* geometry and color math the shader runs
// instead of a hand-written twin that drifts.
//
// WGSL is the intermediate representation on purpose. By the time slangc has
// emitted it, every question a hand-rolled `.slang` parser would have to answer
// itself is already settled: generics are monomorphized, overloads resolved,
// `&&` expanded into explicit branches, `?:` lowered to if/else, implicit
// conversions made explicit. What is left is straight-line scalar code with
// structured control flow — `if`/`else`/`return`/named locals, no SSA, no phi
// nodes — which is why this file is a transliterator and not a compiler.
//
// SPIR-V would give the same post-analysis guarantee but arrives as SSA with
// `OpSelectionMerge`/phi, so even a single `?:` would need control-flow
// reconstruction, and the emitted JS would be unreadable `_23 = _19 * _21`.
// See adr-051.
//
// **The subset is deliberately small and every gap is a hard error.** A
// transliterator that silently guesses is strictly worse than the hand-written
// twin it replaces — the twin is at least reviewable. Anything outside the
// subset throws at `pnpm gen:shaders`, naming the construct and the line.
//
// "Every gap" means every gap *an export reaches*. A whole shader's WGSL — as
// opposed to a module's — also carries its vertex/fragment support code: vec4
// math, `ptr<function, Uniforms>` params, texture samples. Those functions are
// parked with the reason they were refused, and the reason is re-thrown the
// moment an exported function turns out to call one. Nothing is emitted for a
// function that was not fully understood.

import { demangle } from './slangcMangling.ts'

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

interface Token {
  kind: 'ident' | 'number' | 'punct'
  text: string
  line: number
}

// Longest-first: `<=` must beat `<`, `->` must beat `-`.
const PUNCT = [
  '->',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<<',
  '>>',
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  '<',
  '>',
  ',',
  ';',
  ':',
  '=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '.',
  '!',
  '&',
  '|',
  '^',
  '~',
  '@',
]

const NUMBER_RE =
  /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[fhuil]?/

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  let line = 1
  while (i < src.length) {
    const c = src[i]!
    if (c === '\n') {
      line++
      i++
    } else if (c === ' ' || c === '\t' || c === '\r') {
      i++
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        i++
      }
    } else if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') {
          line++
        }
        i++
      }
      i += 2
    } else if (
      /[0-9]/.test(c) ||
      (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))
    ) {
      // WGSL literals carry a type suffix (`0.5f`, `1u`, `3i`) and may be hex
      // (`0xFFu`) or carry an exponent (`1e-05f`).
      const m = NUMBER_RE.exec(src.slice(i))
      if (!m) {
        throw new Error(`wgslToJs: bad numeric literal at line ${line}`)
      }
      out.push({ kind: 'number', text: m[0], line })
      i += m[0].length
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!
      out.push({ kind: 'ident', text: m[0], line })
      i += m[0].length
    } else {
      const p = PUNCT.find(x => src.startsWith(x, i))
      if (!p) {
        throw new Error(
          `wgslToJs: unexpected character ${JSON.stringify(c)} at line ${line}`,
        )
      }
      out.push({ kind: 'punct', text: p, line })
      i += p.length
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type Expr =
  | { k: 'num'; text: string }
  | { k: 'ident'; name: string }
  | { k: 'unary'; op: string; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'call'; name: string; args: Expr[]; line: number }
  // `vec2<f32>(a, b)`. Legal ONLY as the whole of a `return` — see `stmts`.
  | { k: 'vec2'; args: Expr[]; line: number }

type Stmt =
  // `type` is absent for an un-annotated `let`, whose type the emitter infers
  // from `init` — see the parser's `var`/`let` case. A declaration with no
  // initializer always carries one; the parser refuses the other spelling.
  | { k: 'var'; name: string; type?: WgslType; init?: Expr }
  | { k: 'assign'; name: string; value: Expr }
  | { k: 'if'; cond: Expr; thenBody: Stmt[]; else?: Stmt[] }
  | { k: 'return'; value?: Expr }
  | { k: 'expr'; e: Expr }

/**
 * The WGSL type is carried, not just the TypeScript one, because `u32` and
 * `i32` are both `number` in TS and yet behave differently under the bitwise
 * operators: JS coerces to *signed* int32, so a `u32` above 2^31 comes back
 * negative and `>>` shifts in sign bits. Knowing which one an expression is is
 * what lets the emitter re-normalize instead of guessing.
 */
export type WgslType = 'f32' | 'u32' | 'i32' | 'bool'

/**
 * What a function may RETURN. `vec2f` is the one non-scalar type in the subset,
 * and it is deliberately return-only: a decision whose answer is a pair (the
 * two screen-x edges a rect paints) is still a scalar decision in every other
 * respect — nothing indexes it, swizzles it or does vector arithmetic on it,
 * and the emitter refuses all three. Params and locals stay strictly scalar, so
 * none of the signedness/division inference below has to know about it.
 *
 * adr-051 held vector support open for "a function whose decision is genuinely
 * vector-valued"; `rectSpanPx` was that function and `arcRadiiPx` is the second,
 * so a pair is as far as the evidence goes but is no longer a sample of one.
 * `vec3`/`vec4` remain refused, by name.
 */
export type WgslReturnType = WgslType | 'vec2f' | 'void'

export interface WgslParam {
  name: string
  type: WgslType
}

export interface WgslFn {
  name: string
  params: WgslParam[]
  returnType: WgslReturnType
  body: Stmt[]
}

/** A function outside the subset, kept only so a reference to it can explain itself. */
export interface WgslRefusal {
  name: string
  reason: string
}

export interface WgslModule {
  fns: WgslFn[]
  refused: WgslRefusal[]
}

const STAGE_ATTRS = new Set(['compute', 'vertex', 'fragment'])

// Scalar types only. A vector type is a real gap, not a bug — it reports itself,
// so the emitter's coverage is always explicit rather than assumed.
const SCALAR_TYPES = new Set<string>(['f32', 'u32', 'i32', 'bool'])

// Spelled out so a constructor for any of them is recognized as a construction
// and refused as one, rather than being parsed as an identifier followed by two
// comparisons. Only `vec2<f32>` gets past the refusal, and only in a `return`.
const VECTOR_TYPE_NAMES = new Set<string>(['vec2', 'vec3', 'vec4'])

const tsTypeOf = (t: WgslReturnType) =>
  t === 'bool'
    ? 'boolean'
    : t === 'void'
      ? 'void'
      : t === 'vec2f'
        ? // A tuple, not an object: WGSL names these lanes `.x`/`.y`, which mean
          // nothing to a Canvas2D consumer, and the call sites destructure.
          '[number, number]'
        : 'number'

// Every WGSL builtin this emitter knows it does *not* handle. Listing them
// explicitly is what stops an unsupported builtin from being mistaken for a
// call to a module function and emitted as a dangling reference.
const UNSUPPORTED_BUILTINS = new Set([
  'dot',
  'cross',
  'length',
  'normalize',
  'distance',
  'reflect',
  'refract',
  'faceForward',
  'determinant',
  'transpose',
  'dpdx',
  'dpdy',
  'fwidth',
  'textureSample',
  'textureSampleLevel',
  'textureLoad',
  'atan2',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'inverseSqrt',
  'countOneBits',
  'reverseBits',
  'pack4x8unorm',
  'unpack4x8unorm',
])

// Builtins that LOOK like they have an exact JS equivalent and do not. Each one
// gets its own reason, because the generic "add it to MATH_BUILTINS" advice is
// actively wrong here — `round` was in that table, mapped to `Math.round`, and
// the two disagree on every tie.
const MISLEADING_BUILTINS: Record<string, string> = {
  round:
    `WGSL rounds ties to EVEN and 'Math.round' rounds them up, so ` +
    `round(0.5) is 0 on WebGPU and 1 in the twin, round(2.5) is 2 vs 3. ` +
    `GLSL ES leaves ties implementation-defined on top of that, so a shader ` +
    `using round() does not have one answer to transliterate. Write ` +
    `floor(x + 0.5) in the .slang — that is what every existing pixel snap ` +
    `in the tree does (snapBoxHeightPx, crispSquareTopLeftPx, snapCellEdgePx).`,
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0
  // Explicit field, not a parameter property: `gen:shaders` runs under bare
  // `node` (strip-only TS), which rejects those.
  private toks: Token[]

  constructor(toks: Token[]) {
    this.toks = toks
  }

  private peek(offset = 0) {
    return this.toks[this.pos + offset]
  }

  private next() {
    const t = this.toks[this.pos]
    if (!t) {
      throw new Error('wgslToJs: unexpected end of input')
    }
    this.pos++
    return t
  }

  private at(text: string, offset = 0) {
    return this.peek(offset)?.text === text
  }

  private eat(text: string) {
    if (this.at(text)) {
      this.pos++
      return true
    }
    return false
  }

  private expect(text: string) {
    const t = this.next()
    if (t.text !== text) {
      throw new Error(
        `wgslToJs: expected ${JSON.stringify(text)} but found ` +
          `${JSON.stringify(t.text)} at line ${t.line}`,
      )
    }
    return t
  }

  private unsupported(t: Token, what: string): never {
    throw new Error(
      `wgslToJs: ${what} is outside the supported scalar subset ` +
        `(line ${t.line}, near ${JSON.stringify(t.text)}). Either narrow the ` +
        `//! js-export set or extend wgslToJs.ts — do not hand-write the twin.`,
    )
  }

  /** Skip a balanced group, assuming the cursor is on the opener. */
  private skipBalanced(open: string, close: string) {
    this.expect(open)
    let depth = 1
    while (depth > 0) {
      const t = this.next()
      if (t.text === open) {
        depth++
      } else if (t.text === close) {
        depth--
      }
    }
  }

  /** Consume `@name(...)` attributes, returning the names seen. */
  private skipAttributes() {
    const names: string[] = []
    while (this.at('@')) {
      this.next()
      names.push(this.next().text)
      if (this.at('(')) {
        this.skipBalanced('(', ')')
      }
    }
    return names
  }

  /**
   * Skip an entry point whole, without parsing it. Entry points take stage
   * builtins (`@builtin(global_invocation_id) tid : vec3<u32>`) that are
   * outside the scalar subset by construction, and their bodies are the
   * synthesized wrapper's — never something we emit. Parsing them would reject
   * the module for a type nothing downstream reads.
   */
  private skipFn() {
    this.expect('fn')
    this.next()
    this.skipBalanced('(', ')')
    if (this.eat('->')) {
      this.skipAttributes()
      while (!this.at('{')) {
        this.next()
      }
    }
    this.skipBalanced('{', '}')
  }

  private parseType(): WgslType {
    const t = this.next()
    if (t.kind !== 'ident' || !SCALAR_TYPES.has(t.text)) {
      this.unsupported(t, `type '${t.text}'`)
    }
    return t.text as WgslType
  }

  /**
   * A return type, which may additionally be `vec2<f32>` — see WgslReturnType.
   * Params and locals go through `parseType` and stay scalar.
   */
  private parseReturnType(): WgslReturnType {
    if (this.at('vec2') && this.at('<', 1)) {
      this.next()
      this.next()
      const elem = this.next()
      if (elem.text !== 'f32') {
        this.unsupported(elem, `vec2 element type '${elem.text}'`)
      }
      this.expect('>')
      return 'vec2f'
    }
    return this.parseType()
  }

  parseModule(): WgslModule {
    const fns: WgslFn[] = []
    const refused: WgslRefusal[] = []
    while (this.pos < this.toks.length) {
      const attrs = this.skipAttributes()
      if (this.pos >= this.toks.length) {
        break
      }
      if (this.at('fn')) {
        if (attrs.some(a => STAGE_ATTRS.has(a))) {
          this.skipFn()
        } else {
          // Park a function we can't read rather than rejecting the file. Only
          // what an export *reaches* has to be in the subset, and a whole
          // shader's WGSL is mostly stage support code no export ever calls;
          // `emitJsTwins` re-throws this reason if one turns out to be reached.
          const start = this.pos
          try {
            fns.push(this.parseFn())
          } catch (e) {
            this.pos = start
            const name = this.peek(1)?.text ?? '<anonymous>'
            this.skipFn()
            refused.push({
              name,
              reason: e instanceof Error ? e.message : String(e),
            })
          }
        }
      } else if (this.at('struct')) {
        this.next()
        this.next()
        this.skipBalanced('{', '}')
        this.eat(';')
      } else if (this.at('var') || this.at('const') || this.at('alias')) {
        // Module-scope storage/bindings are not part of the exported surface.
        while (!this.at(';')) {
          this.next()
        }
        this.expect(';')
      } else {
        const t = this.next()
        this.unsupported(t, `module-scope declaration '${t.text}'`)
      }
    }
    return { fns, refused }
  }

  private parseFn(): WgslFn {
    this.expect('fn')
    const name = this.next().text
    this.expect('(')
    const params: WgslParam[] = []
    while (!this.at(')')) {
      this.skipAttributes()
      const pname = this.next().text
      this.expect(':')
      params.push({ name: pname, type: this.parseType() })
      if (!this.eat(',')) {
        break
      }
    }
    this.expect(')')
    let returnType: WgslReturnType = 'void'
    if (this.eat('->')) {
      this.skipAttributes()
      returnType = this.parseReturnType()
    }
    return { name, params, returnType, body: this.parseBlock() }
  }

  private parseBlock(): Stmt[] {
    this.expect('{')
    const out: Stmt[] = []
    while (!this.at('}')) {
      out.push(this.parseStmt())
    }
    this.expect('}')
    return out
  }

  private parseStmt(): Stmt {
    const t = this.peek()!
    if (t.text === 'var' || t.text === 'let') {
      this.next()
      const name = this.next().text
      // An un-annotated `let` is left UNTYPED here for the emitter to infer
      // from its initializer, which is what WGSL itself does. It used to
      // default to `f32` on the reasoning that slangc always annotates a `var`
      // and only ever leaves float temporaries un-annotated — but that default
      // is a fabricated type, not an unknown one, and the emitter's refusals
      // are all phrased as "I could not infer". `let t = a + 1u; t / 2u` was
      // therefore emitted as a FLOAT division: 1 on the GPU, 1.5 in the twin,
      // silently, for ordinary inputs. Nothing exported today reaches it,
      // which is exactly why it survived.
      const type = this.eat(':') ? this.parseType() : undefined
      const init = this.eat('=') ? this.parseExpr() : undefined
      this.expect(';')
      if (type === undefined && init === undefined) {
        this.unsupported(
          t,
          `'${t.text}' with neither a type nor an initializer`,
        )
      }
      return { k: 'var', name, type, init }
    }
    if (t.text === 'if') {
      this.next()
      // WGSL allows `if cond {` and `if (cond) {`; slangc emits the latter.
      const cond = this.parseExpr()
      const thenBody = this.parseBlock()
      const els = this.eat('else')
        ? this.at('if')
          ? [this.parseStmt()]
          : this.parseBlock()
        : undefined
      return { k: 'if', cond, thenBody, else: els }
    }
    if (t.text === 'return') {
      this.next()
      if (this.eat(';')) {
        return { k: 'return' }
      }
      const value = this.parseExpr()
      this.expect(';')
      return { k: 'return', value }
    }
    if (
      [
        'loop',
        'for',
        'while',
        'switch',
        'break',
        'continue',
        'discard',
      ].includes(t.text)
    ) {
      this.unsupported(t, `'${t.text}'`)
    }
    if (t.kind === 'ident' && this.at('=', 1)) {
      const name = this.next().text
      this.expect('=')
      const value = this.parseExpr()
      this.expect(';')
      return { k: 'assign', name, value }
    }
    const e = this.parseExpr()
    this.expect(';')
    return { k: 'expr', e }
  }

  // Precedence climbing, lowest binding first. C's ordering, which is WGSL's
  // and JS's — and moot for the output anyway, since every binary node is
  // emitted fully parenthesized. It has to be right for *reading* slangc's
  // WGSL, which is not fully parenthesized.
  private static readonly LEVELS = [
    ['||'],
    ['&&'],
    ['|'],
    ['^'],
    ['&'],
    ['==', '!='],
    ['<', '>', '<=', '>='],
    ['<<', '>>'],
    ['+', '-'],
    ['*', '/', '%'],
  ]

  parseExpr(level = 0): Expr {
    if (level >= Parser.LEVELS.length) {
      return this.parseUnary()
    }
    let left = this.parseExpr(level + 1)
    for (;;) {
      const t = this.peek()
      if (!t || t.kind !== 'punct' || !Parser.LEVELS[level]!.includes(t.text)) {
        return left
      }
      this.next()
      left = { k: 'bin', op: t.text, l: left, r: this.parseExpr(level + 1) }
    }
  }

  private parseUnary(): Expr {
    const t = this.peek()!
    if (t.text === '-' || t.text === '!' || t.text === '~') {
      this.next()
      return { k: 'unary', op: t.text, e: this.parseUnary() }
    }
    if (t.text === '&' || t.text === '*') {
      // Pointer take/deref — slangc emits these for uniform / `inout` params,
      // and a struct behind one is outside the subset anyway. A real gap, not
      // something to guess at.
      this.unsupported(t, `unary '${t.text}'`)
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expr {
    const t = this.next()
    if (t.kind === 'number') {
      return { k: 'num', text: t.text }
    }
    if (t.text === '(') {
      const e = this.parseExpr()
      this.expect(')')
      return this.rejectPostfix(e)
    }
    if (t.kind === 'ident') {
      if (t.text === 'true' || t.text === 'false') {
        return { k: 'ident', name: t.text }
      }
      // A vector constructor is `vecN<T>(...)`, so the type arguments sit
      // between the name and the parens. Caught by name rather than left to the
      // expression parser: `vec3<f32>(a, b, c)` otherwise tokenizes into
      // something the precedence climber reads as two comparisons, and the
      // failure it eventually produces names a stray `,` several tokens away.
      if (VECTOR_TYPE_NAMES.has(t.text) && this.at('<')) {
        return this.rejectPostfix(this.parseVectorCtor(t))
      }
      if (this.at('(')) {
        return this.rejectPostfix({
          k: 'call',
          name: t.text,
          args: this.parseArgs(),
          line: t.line,
        })
      }
      return this.rejectPostfix({ k: 'ident', name: t.text })
    }
    this.unsupported(t, `token '${t.text}'`)
  }

  /** A parenthesized, comma-separated argument list, cursor on the `(`. */
  private parseArgs(): Expr[] {
    this.expect('(')
    const args: Expr[] = []
    while (!this.at(')')) {
      args.push(this.parseExpr())
      if (!this.eat(',')) {
        break
      }
    }
    this.expect(')')
    return args
  }

  /**
   * `vec2<f32>(a, b)` — the one vector construction in the subset. Every other
   * width and element type is refused here, by name and with its own line.
   */
  private parseVectorCtor(name: Token): Expr {
    this.expect('<')
    const elem = this.next()
    this.expect('>')
    if (name.text !== 'vec2' || elem.text !== 'f32') {
      this.unsupported(name, `'${name.text}<${elem.text}>' construction`)
    }
    const args = this.parseArgs()
    if (args.length !== 2) {
      this.unsupported(
        name,
        `vec2<f32> built from ${args.length} component(s) (only the ` +
          `two-scalar form is supported, not a splat or a copy)`,
      )
    }
    return { k: 'vec2', args, line: name.line }
  }

  /** Swizzles, struct fields and indexing all mean we left the scalar subset. */
  private rejectPostfix(e: Expr): Expr {
    const t = this.peek()
    if (t?.text === '.') {
      this.unsupported(t, 'member access (vector swizzle or struct field)')
    }
    if (t?.text === '[') {
      this.unsupported(t, 'indexing')
    }
    return e
  }
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// WGSL builtins that map 1:1 onto a `Math.*` of the same semantics.
const MATH_BUILTINS: Record<string, string> = {
  abs: 'Math.abs',
  ceil: 'Math.ceil',
  exp: 'Math.exp',
  floor: 'Math.floor',
  log: 'Math.log',
  log2: 'Math.log2',
  pow: 'Math.pow',
  sign: 'Math.sign',
  sqrt: 'Math.sqrt',
  trunc: 'Math.trunc',
}

// Builtins needing a helper. Emitted only when referenced, so the generated
// file stays readable.
const HELPERS: Record<string, string> = {
  // `max`/`min` are helpers rather than `Math.max`/`Math.min` for the same
  // reason `_clamp` is, and leaving them out of that fix was an incomplete job:
  // the clamping helpers were made NaN-faithful while every DIRECT `max(...)` in
  // a shader kept diverging. `perpCoverage`'s `max(0.5 - 0.5 * perpW, 0.0)` on
  // a degenerate ribbon is 0 on the shader and NaN here.
  //
  // The readability cost is real and paid deliberately. A twin the emitter got
  // wrong is supposed to be reviewable, and `_max(a, b)` reads worse than
  // `Math.max(a, b)` — but an emitter that is faithful *except for two builtins
  // on one input class* is a carve-out nobody will remember, and a check with an
  // accepted failure in it decays into a check nobody runs.
  // C99 `fmaxf`/`fminf`, which is what slangc's C++ prelude reaches for on a
  // host compiler (`F32_max` → `::fmaxf`; the `a > b ? a : b` spelling beside it
  // in slang-cpp-scalar-intrinsics.h is the `SLANG_LLVM` branch, which the
  // oracle's build does not take). Those return the NON-NaN operand whichever
  // side it is on.
  //
  // The ternary spelling used to be here and was faithful on ONE side only:
  // `a > b ? a : b` drops a NaN in first position and returns it in second, so
  // `_max(0, NaN)` was NaN where the compiler generating the GPU path says 0.
  // Caught by the oracle on `chevronFirstVisible(7.5, 0, 7.5)` — a zero spacing
  // makes the division 0/0 — after the ternary had already been chosen
  // deliberately, for this exact NaN behaviour, on the half of it that was right.
  _max: [
    'function _max(a: number, b: number) {',
    '  return b > a || Number.isNaN(a) ? b : a',
    '}',
  ].join('\n'),
  _min: [
    'function _min(a: number, b: number) {',
    '  return b < a || Number.isNaN(a) ? b : a',
    '}',
  ].join('\n'),
  // `_min`/`_max`, not `Math.min`/`Math.max`, and the difference is NaN.
  //
  // WGSL's `clamp` is `min(max(x, lo), hi)`, and slangc's C++ prelude drops a
  // NaN through both of those (see `_max` above). JS's `Math.max(NaN, 0)` is
  // NaN, and it propagates from there.
  //
  // So on a NaN the shader clamps to a bound and the twin returned NaN, which
  // is the exact split this codebase already guards by hand elsewhere:
  // `ldGenotypeCorrelation`'s comment says a NaN reaching the color ramp
  // "would paint an unfilled cell on one backend and a clamped one on the
  // other". The emitter was reintroducing that generically, in every twin that
  // clamps.
  //
  // Found by the differential oracle once it swept unexported functions:
  // `vertCoverage(20, 20, 0)` is 1 in slangc's C++ and was NaN here. WGSL calls
  // min/max on a NaN indeterminate, so neither is *wrong* — but agreeing with
  // the compiler that also generates the GPU path is the only useful choice.
  _clamp: [
    'function _clamp(x: number, lo: number, hi: number) {',
    '  return _min(_max(x, lo), hi)',
    '}',
  ].join('\n'),
  // WGSL defines mix as `a*(1-t) + b*t`, not the lerp form `a + (b-a)*t`. The
  // two are equal in exact arithmetic and not in floating point: the lerp form
  // does not return `b` exactly at t=1, which matters to a consumer quantizing
  // the result into byte space.
  //
  // **`check-shader-oracle` cannot referee this one, and not because of its
  // tolerance.** slangc lowers `lerp` to `x + (y - x) * s` for `-target cpp`
  // while emitting `mix()` for `-target wgsl`, so the oracle's reference
  // implementation is the form this deliberately does not use. Tightening
  // `REL_TOLERANCE` would fail a *correct* `_mix` rather than catch a wrong one.
  // The guard is `wgslToJs.test.ts`'s 'mix returns b exactly at t=1', and the
  // inputs there were chosen by checking that they discriminate — the pair it
  // used before (0.1, 0.3) is exact in BOTH forms, so the test passed against
  // the lerp form for as long as it existed.
  _mix: [
    'function _mix(a: number, b: number, t: number) {',
    '  return a * (1 - t) + b * t',
    '}',
  ].join('\n'),
  _step: [
    'function _step(edge: number, x: number) {',
    '  return x < edge ? 0 : 1',
    '}',
  ].join('\n'),
  _fract: [
    'function _fract(x: number) {',
    '  return x - Math.floor(x)',
    '}',
  ].join('\n'),
  // The clamp is `_clamp`'s, for `_clamp`'s reason: a degenerate edge pair
  // (`e0 == e1`, which WGSL leaves indeterminate) makes the ratio 0/0, and
  // whether that comes back NaN or clamped decides the whole result.
  _smoothstep: [
    'function _smoothstep(e0: number, e1: number, x: number) {',
    '  const r = (x - e0) / (e1 - e0)',
    '  const above = r > 0 ? r : 0',
    '  const t = above < 1 ? above : 1',
    '  return t * t * (3 - 2 * t)',
    '}',
  ].join('\n'),
}
const HELPER_BUILTINS = new Set([
  'clamp',
  'mix',
  'step',
  'fract',
  'smoothstep',
  'max',
  'min',
])

/**
 * Every WGSL builtin this file claims to translate — the union of the two tables
 * above, named as a shader author writes them.
 *
 * Exported so `wgslToJs.test.ts` can assert it has a semantics case for each,
 * and that is the whole reason it exists. `pnpm check-shader-oracle` sweeps only
 * what the tree's shaders happen to call, which as of this writing exercises
 * **eight** of these seventeen: `abs`, `clamp`, `floor`, `log2`, `max`, `min`,
 * `smoothstep`, `sqrt`. The other nine are translated by rules nothing
 * differential has ever run — `mix` and `step` cannot even in principle be
 * covered by the oracle, because slangc's `-target cpp` lowers them to different
 * expressions than the WGSL it hands the GPU (see `_mix` above).
 *
 * So the coverage has to come from the unit tests, and a new entry in either
 * table has to arrive with one. Making that a list the test compares against,
 * rather than a rule someone remembers, is what keeps the tenth unchecked rule
 * from being added silently.
 */
export const TRANSLATION_RULES: readonly string[] = [
  ...Object.keys(MATH_BUILTINS),
  ...HELPER_BUILTINS,
].sort()

// Helpers that call other helpers. Emission is by reference, so a helper reached
// only through another one is otherwise left out and the module throws
// `_min is not defined` at import — which is what happened the moment `_clamp`
// stopped restating the comparisons and called `_min`/`_max` instead. Stating
// the rule once is worth four lines of closure over duplicating it.
const HELPER_DEPS: Record<string, readonly string[]> = {
  _clamp: ['_min', '_max'],
}

function withHelperDeps(used: Iterable<string>) {
  const out = new Set<string>()
  const add = (h: string) => {
    if (out.has(h)) {
      return
    }
    out.add(h)
    for (const dep of HELPER_DEPS[h] ?? []) {
      add(dep)
    }
  }
  for (const h of used) {
    add(h)
  }
  return out
}

// Operators where WGSL's semantics and JS's diverge on integers. JS coerces
// both operands to *signed* int32 and returns a signed int32, so on a `u32`
// every one of these needs re-normalizing with `>>> 0`, and `>>` has to become
// `>>>` or it shifts in sign bits. On an `i32` the JS behavior is already right.
const BITWISE_OPS = new Set(['&', '|', '^', '<<', '>>'])

const COMPARISON_OPS = new Set(['==', '!=', '<', '>', '<=', '>=', '&&', '||'])

// Builtins returning their operand's type rather than a fixed one, so an
// integer stays an integer through them.
const VALUE_PRESERVING_BUILTINS = new Set([
  'abs',
  'ceil',
  'clamp',
  'floor',
  'max',
  'min',
  'round',
  'sign',
  'trunc',
])

// ...and the ones that are float-valued whatever they are handed.
const FLOAT_BUILTINS = new Set([
  'exp',
  'fract',
  'log',
  'log2',
  'mix',
  'pow',
  'smoothstep',
  'sqrt',
  'step',
])

const isHexLiteral = (text: string) => /^0[xX]/.test(text)

/**
 * WGSL's type suffix on a numeric literal (`0.5f` -> `f`, `1u` -> `u`), or
 * undefined if it carries none.
 *
 * **Base-aware, and it has to be.** A hex literal's *digits* can end in `f`, so
 * a blind `/[fhuil]$/` turns `0xff` into `0xf` — 255 silently becomes 15 — and
 * `0xf` into the unparseable `0x`. Only the integer suffixes can follow a hex
 * literal; `f` and `h` are float suffixes and cannot appear on one. (Same blind
 * spot the constant evaluator in parseDirectives.ts had, and hex is how a u32
 * sentinel gets spelled.) Both the strip and the type inference read this, so
 * they cannot disagree about where the digits end.
 */
function literalSuffix(text: string) {
  const re = isHexLiteral(text) ? /[uil]$/ : /[fhuil]$/
  return re.exec(text)?.[0]
}

class Emitter {
  readonly usedHelpers = new Set<string>()

  private renames: Map<string, string>
  private moduleFns: ReadonlySet<string>
  private returnTypes: ReadonlyMap<string, WgslReturnType>
  // Mutable, and filled in as the body is emitted: an un-annotated `let` gets
  // its type from its initializer, which can only be evaluated in the scope the
  // statements before it built. Statements are emitted in source order, so a
  // name is always typed before anything can read it.
  private scopeTypes = new Map<string, WgslType>()

  constructor(
    renames: Map<string, string>,
    moduleFns: ReadonlySet<string>,
    returnTypes: ReadonlyMap<string, WgslReturnType>,
  ) {
    this.renames = renames
    this.moduleFns = moduleFns
    this.returnTypes = returnTypes
  }

  /** Swap in the current function's local scope before emitting its body. */
  setScope(renames: Map<string, string>, types: ReadonlyMap<string, WgslType>) {
    this.renames = renames
    this.scopeTypes = new Map(types)
  }

  /**
   * The WGSL type of an expression, where the emitter can tell. `undefined`
   * means "don't know", and every caller that needs to know refuses instead of
   * assuming — a wrong guess about signedness is a silent wrong answer for
   * exactly the packed-flag values this exists to read.
   */
  private typeOf(e: Expr): WgslType | undefined {
    switch (e.k) {
      case 'num': {
        // slangc suffixes its integer literals; a bare DECIMAL one is a float.
        // A bare HEX one is not — and reading its trailing digit as a suffix is
        // the same base-blindness `num()` documents below, with a worse failure
        // here: typing `0xff` as f32 sends `0xff / 2u` down the float-division
        // path, which WGSL truncates and JS does not.
        const suffix = literalSuffix(e.text)
        if (suffix === 'u') {
          return 'u32'
        }
        if (suffix === 'i' || suffix === 'l') {
          return 'i32'
        }
        return isHexLiteral(e.text) ? 'i32' : 'f32'
      }
      case 'ident': {
        return e.name === 'true' || e.name === 'false'
          ? 'bool'
          : this.scopeTypes.get(e.name)
      }
      case 'unary': {
        return e.op === '!' ? 'bool' : this.typeOf(e.e)
      }
      case 'bin': {
        if (COMPARISON_OPS.has(e.op)) {
          return 'bool'
        }
        return this.typeOf(e.l) ?? this.typeOf(e.r)
      }
      case 'call': {
        if (SCALAR_TYPES.has(e.name)) {
          return e.name as WgslType
        }
        if (FLOAT_BUILTINS.has(e.name)) {
          return 'f32'
        }
        // min/max/abs/clamp and friends return their operand type; `select`
        // returns the type of the values it chooses between, not the condition.
        if (VALUE_PRESERVING_BUILTINS.has(e.name)) {
          return e.args.map(a => this.typeOf(a)).find(t => t !== undefined)
        }
        if (e.name === 'select') {
          return this.typeOf(e.args[0]!) ?? this.typeOf(e.args[1]!)
        }
        const ret = this.returnTypes.get(e.name)
        return ret === 'void' || ret === 'vec2f' ? undefined : ret
      }
      case 'vec2': {
        // Not a scalar, so it has no answer here. Every caller treats
        // `undefined` as "refuse rather than guess", and `expr` refuses a vec2
        // outright anywhere but a return, so this is unreachable in practice.
        return undefined
      }
    }
  }

  /**
   * WGSL's `/` is integer division on integer operands and JS's never is, so
   * the emitter has to know which one it is looking at. `vid / 6u` is 1 on the
   * GPU and 1.1666… in JS — a silently wrong answer for ordinary in-range
   * inputs, not just at the type's edges, which is why this refuses rather than
   * assuming float when it cannot tell.
   */
  private divideIsIntegral(e: Expr & { k: 'bin' }) {
    const t = this.typeOf(e.l) ?? this.typeOf(e.r)
    if (t === undefined) {
      throw new Error(
        `wgslToJs: cannot tell whether the operands of '/' are integers ` +
          `(inferred nothing). WGSL divides integers with truncation and JS ` +
          `does not, so emitting one without knowing would silently change ` +
          `the result. Annotate the shader-side local, or extend the ` +
          `inference in wgslToJs.ts.`,
      )
    }
    return t === 'u32' || t === 'i32'
  }

  /**
   * `'u32'` / `'i32'` when `+ - *` is integer arithmetic here, `undefined` when
   * it is float or the emitter cannot tell.
   *
   * Not a refusal, unlike `/` and the bitwise operators: those diverge for
   * ordinary in-range inputs, so guessing is a wrong answer, while these two
   * agree everywhere except at the wrap. Emitting the plain form when the type
   * is unknown is the behavior every twin generated so far already has.
   */
  private intArithType(e: Expr & { k: 'bin' }) {
    const t = this.typeOf(e.l) ?? this.typeOf(e.r)
    return t === 'u32' || t === 'i32' ? t : undefined
  }

  /**
   * WGSL wraps integer arithmetic modulo the type's width; JS grows the number
   * instead. `-` is the case that matters and the one previously left alone:
   * unsigned SUBTRACTION underflows at ordinary values, not at 2^32-scale ones
   * — `1u - 2u` is 4294967295 on the GPU and -1 in an unwrapped twin — so the
   * old note about needing enormous inputs held only for `+` and `*`.
   *
   * `+` and `-` re-wrap exactly through the JS coercions, since a sum or
   * difference of two 32-bit values is far inside float64's exact range.
   * `*` is not: the true product reaches 2^64 and loses low bits before any
   * mask could see them, which is why the plain form cannot be fixed by a
   * trailing `>>> 0`. `Math.imul` is the exact 32-bit multiply and settles it.
   */
  private intArith(op: string, type: 'u32' | 'i32', l: string, r: string) {
    const raw = op === '*' ? `Math.imul(${l}, ${r})` : `${l} ${op} ${r}`
    if (type === 'u32') {
      return `((${raw}) >>> 0)`
    }
    // Math.imul already yields a wrapped signed int32.
    return op === '*' ? `(${raw})` : `((${raw}) | 0)`
  }

  /** The operand type a bitwise operator acts on, or a refusal naming why. */
  private intTypeFor(e: Expr & { k: 'bin' }): 'u32' | 'i32' {
    // The shift count may legitimately be a different type from the value, so
    // the left operand decides; only fall back to the right for `a & b` shapes
    // where the left is an opaque call.
    const t =
      this.typeOf(e.l) ??
      (e.op === '<<' || e.op === '>>' ? undefined : this.typeOf(e.r))
    if (t !== 'u32' && t !== 'i32') {
      throw new Error(
        `wgslToJs: cannot tell whether the left operand of '${e.op}' is signed ` +
          `(inferred ${t ?? 'nothing'}). JS bitwise operators coerce to signed ` +
          `int32, so emitting one without knowing would silently change any ` +
          `value at or above 2^31. Annotate the shader-side local, or extend ` +
          `the inference in wgslToJs.ts.`,
      )
    }
    return t
  }

  /**
   * The identifier to emit for a Slang name — its demangled spelling where
   * `buildRenames`/`stabilizeTemps` found one injective, otherwise the mangled
   * name unchanged. One method: a private `id()` that only forwarded here read
   * as a second concept and was not one.
   */
  rename(name: string) {
    return this.renames.get(name) ?? name
  }

  /**
   * Drop WGSL's literal type suffix: `0.5f` -> `0.5`, `1u` -> `1`. See
   * `literalSuffix` for why the strip has to know the base.
   */
  private num(text: string) {
    const suffix = literalSuffix(text)
    return suffix === undefined ? text : text.slice(0, -1)
  }

  /**
   * `u32(10)` -> `10`. slangc spells every integer literal as a constructor
   * call, so without this the output is a thicket of `((10) >>> 0)` — and
   * readability is load-bearing here: the fallback safety property when the
   * generator is wrong is that a human can review the twin. Folds only where
   * the conversion provably cannot change the literal.
   */
  private foldConstructor(name: string, arg: Expr | undefined) {
    if (arg?.k !== 'num') {
      return undefined
    }
    const text = this.num(arg.text)
    const v = Number(text)
    if (!Number.isFinite(v)) {
      return undefined
    }
    if (name === 'f32') {
      return text
    }
    if (!Number.isInteger(v)) {
      return undefined
    }
    return name === 'u32'
      ? v >= 0 && v <= 0xffffffff
        ? text
        : undefined
      : v >= -0x80000000 && v <= 0x7fffffff
        ? text
        : undefined
  }

  expr(e: Expr): string {
    switch (e.k) {
      case 'num': {
        return this.num(e.text)
      }
      case 'ident': {
        return this.rename(e.name)
      }
      case 'unary': {
        if (e.op === '~') {
          // Same signedness story as the binary operators below.
          const t = this.typeOf(e.e)
          if (t !== 'u32' && t !== 'i32') {
            throw new Error(
              `wgslToJs: cannot tell whether the operand of '~' is signed ` +
                `(inferred ${t ?? 'nothing'}).`,
            )
          }
          return t === 'u32'
            ? `((~${this.expr(e.e)}) >>> 0)`
            : `(~${this.expr(e.e)})`
        }
        const inner = this.expr(e.e)
        // `-` against a leading `-` would read as a decrement operator.
        return e.op === '-' && inner.startsWith('-')
          ? `- ${inner}`
          : `${e.op}${inner}`
      }
      case 'bin': {
        // Parenthesized unconditionally: slangc's output is already fully
        // parenthesized where it matters, and re-deriving precedence here is a
        // silent-wrongness risk for no readability gain.
        if (BITWISE_OPS.has(e.op)) {
          const t = this.intTypeFor(e)
          const op = e.op === '>>' && t === 'u32' ? '>>>' : e.op
          const raw = `${this.expr(e.l)} ${op} ${this.expr(e.r)}`
          // `>>>` already yields an unsigned result; the rest need coercing
          // back, or a color at or above 2^31 comes out negative.
          return op === '>>>'
            ? `(${raw})`
            : t === 'u32'
              ? `((${raw}) >>> 0)`
              : `(${raw})`
        }
        // Integer `/` truncates in WGSL and does not in JS. (`%` needs no such
        // treatment: both languages take the sign of the dividend and truncate
        // toward zero, so the operators already agree.)
        if (e.op === '/' && this.divideIsIntegral(e)) {
          return `Math.trunc(${this.expr(e.l)} / ${this.expr(e.r)})`
        }
        if (e.op === '+' || e.op === '-' || e.op === '*') {
          const int = this.intArithType(e)
          if (int) {
            return this.intArith(e.op, int, this.expr(e.l), this.expr(e.r))
          }
        }
        // WGSL and JS agree on the remaining arithmetic and comparison
        // operators, up to the float64-vs-float32 width the ADR accepts.
        return `(${this.expr(e.l)} ${e.op} ${this.expr(e.r)})`
      }
      case 'call': {
        return this.call(e)
      }
      case 'vec2': {
        // `stmts` emits the tuple directly for a `return`, which is the only
        // position a vec2 is allowed in. Reaching here means one turned up
        // inside an expression — assigned to a local, passed to a function,
        // added to something — and none of those are modeled: the emitter has
        // no vector locals, no vector params, and no vector arithmetic. Refuse
        // rather than emit a JS array into an expression that will silently
        // stringify or NaN.
        throw new Error(
          `wgslToJs: vec2<f32> at line ${e.line} is used somewhere other than ` +
            `as the whole of a 'return'. Only a returned pair is supported ` +
            `(see WgslReturnType) — assign the components to scalar locals in ` +
            `the .slang, or narrow the //! js-export set.`,
        )
      }
    }
  }

  private call(e: Expr & { k: 'call' }): string {
    const name = e.name
    const misleading = MISLEADING_BUILTINS[name]
    if (misleading) {
      throw new Error(
        `wgslToJs: '${name}' at line ${e.line} has no exact JS equivalent. ${
          misleading
        }`,
      )
    }
    // Whether the callee is one this emitter can produce AT ALL, checked before
    // the arguments are emitted. Order matters for the message, not the
    // outcome: `length(vec2<f32>(ddx(c), ddy(c)))` is refused either way, but
    // evaluating the arguments first refuses it for the *vec2*, sending the
    // reader after a supported-looking construct instead of the three
    // derivative builtins that are the actual reason.
    if (!this.isKnownCallee(name)) {
      throw new Error(
        `wgslToJs: call to '${name}' at line ${e.line} is neither a supported ` +
          `builtin nor a function in this module. ${
            UNSUPPORTED_BUILTINS.has(name)
              ? `'${name}' is a WGSL builtin this emitter does not implement — ` +
                `add it to MATH_BUILTINS/HELPERS if it has exact JS semantics.`
              : `If it is a builtin, add it explicitly; do not let it through.`
          }`,
      )
    }
    const a = e.args.map(x => this.expr(x))
    // Scalar constructors. `f32(x)` is identity on a JS number; the integer
    // ones truncate the way the shader does. A literal argument folds away.
    if (name === 'f32' || name === 'i32' || name === 'u32') {
      const folded = this.foldConstructor(name, e.args[0])
      if (folded !== undefined) {
        return folded
      }
    }
    if (name === 'f32') {
      return `(${a[0]})`
    }
    if (name === 'i32') {
      return `((${a[0]}) | 0)`
    }
    if (name === 'u32') {
      return `((${a[0]}) >>> 0)`
    }
    if (name === 'bool') {
      return `Boolean(${a[0]})`
    }
    const math = MATH_BUILTINS[name]
    if (math) {
      return `${math}(${a.join(', ')})`
    }
    if (HELPER_BUILTINS.has(name)) {
      this.usedHelpers.add(`_${name}`)
      return `_${name}(${a.join(', ')})`
    }
    if (name === 'select') {
      // WGSL argument order is select(falseValue, trueValue, condition).
      return `(${a[2]} ? ${a[1]} : ${a[0]})`
    }
    return `${this.rename(name)}(${a.join(', ')})`
  }

  /** Every callee spelling `call` above knows how to emit. */
  private isKnownCallee(name: string) {
    return (
      SCALAR_TYPES.has(name) ||
      name in MATH_BUILTINS ||
      HELPER_BUILTINS.has(name) ||
      name === 'select' ||
      this.moduleFns.has(name)
    )
  }

  stmts(list: Stmt[], indent: string): string[] {
    const out: string[] = []
    for (const s of list) {
      switch (s.k) {
        case 'var': {
          if (s.init === undefined) {
            // The parser refuses a declaration with neither, so this one is
            // annotated.
            out.push(
              `${indent}let ${this.rename(s.name)}: ${tsTypeOf(s.type!)}`,
            )
            break
          }
          // Emit first, then type: the initializer is read in the scope as it
          // stood before this statement, and `x` is not in scope in its own
          // initializer.
          const value = this.expr(s.init)
          const type = s.type ?? this.typeOf(s.init)
          if (type !== undefined) {
            this.scopeTypes.set(s.name, type)
          }
          out.push(`${indent}let ${this.rename(s.name)} = ${value}`)
          break
        }
        case 'assign': {
          out.push(`${indent}${this.rename(s.name)} = ${this.expr(s.value)}`)
          break
        }
        case 'return': {
          if (s.value === undefined) {
            out.push(`${indent}return`)
          } else if (s.value.k === 'vec2') {
            // The one place a vec2 is legal, and the only place it is spelled:
            // a tuple literal over the two component expressions, each of which
            // is ordinary scalar code.
            const [x, y] = s.value.args
            out.push(`${indent}return [${this.expr(x!)}, ${this.expr(y!)}]`)
          } else {
            out.push(`${indent}return ${this.expr(s.value)}`)
          }
          break
        }
        case 'expr': {
          out.push(`${indent}${this.expr(s.e)}`)
          break
        }
        case 'if': {
          out.push(`${indent}if (${this.expr(s.cond)}) {`)
          out.push(...this.stmts(s.thenBody, `${indent}  `))
          if (s.else) {
            out.push(`${indent}} else {`)
            out.push(...this.stmts(s.else, `${indent}  `))
          }
          out.push(`${indent}}`)
          break
        }
      }
    }
    return out
  }
}

/**
 * slangc suffixes every identifier with a disambiguating index
 * (`snapBoxHeightPx_0`, `hPx_0`). Strip it where that is injective, so the
 * generated JS reads like the Slang source; keep every mangled name otherwise,
 * rather than silently aliasing two distinct values onto one identifier.
 *
 * Scope matters: two functions each having a `heightPx_N` parameter is normal
 * and harmless, so locals are resolved per function and only function names are
 * resolved module-wide. A module-wide check would see that pair as a collision
 * and give up on the whole file.
 */
function buildRenames(names: Iterable<string>, reserved?: ReadonlySet<string>) {
  const taken = new Map<string, string>()
  const all = [...names]
  for (const n of all) {
    const stripped = demangle(n)
    const prior = taken.get(stripped)
    if ((prior !== undefined && prior !== n) || reserved?.has(stripped)) {
      return new Map<string, string>()
    }
    taken.set(stripped, n)
  }
  return new Map(all.map(n => [n, demangle(n)]))
}

// Globals the emitted JS reads: `Math.*` for MATH_BUILTINS, `Boolean` for a
// `bool(x)` conversion. A binding of the same name shadows the thing its own
// body calls.
const EMITTER_GLOBALS = new Set(['Math', 'Boolean'])

// Words JS will not let a `let`/`function` bind, minus the ones Slang reserves
// too (`if`, `for`, `return`, `static`, `class`, `this`, …) — those cannot
// reach here because they were never legal Slang identifiers either. What is
// left is the genuine gap between the two languages.
const JS_RESERVED = new Set([
  'arguments',
  'await',
  'debugger',
  'delete',
  'eval',
  'finally',
  'function',
  'instanceof',
  'new',
  'null',
  'super',
  'throw',
  'try',
  'typeof',
  'undefined',
  'var',
  'with',
  'yield',
])

// slangc's own scratch locals: `_S1`, `_S2`, … numbered from a counter it keeps
// across the WHOLE module, not per function.
const SLANGC_TEMP_RE = /^_S\d+$/

/**
 * Renumber slangc's scratch locals per function, so `continuation.js.generated`
 * stops opening with `_S4` and `mismatch` with `_S7`.
 *
 * The numbers are not the shader author's and carry no meaning, but they DO
 * churn: the counter is module-wide, so adding an unrelated function to a
 * `.slang` — or to a module it imports — renumbers the temporaries in every
 * twin lifted from it, and the generated diff then shows changes in functions
 * nobody touched. First-declaration order within the function is stable under
 * exactly the edits that were shifting the slangc counter.
 *
 * All-or-nothing, like `buildRenames`: if a target name is already spoken for,
 * every temp keeps its mangled spelling rather than one aliasing another.
 */
function stabilizeTemps(
  renames: Map<string, string>,
  declared: Iterable<string>,
  reserved: ReadonlySet<string>,
) {
  const temps = [...declared].filter(n => SLANGC_TEMP_RE.test(n))
  if (temps.length === 0) {
    return renames
  }
  const taken = new Set([...reserved, ...renames.values()])
  const stable = temps.map((n, i) => [n, `_t${i}`] as const)
  if (stable.some(([, to]) => taken.has(to))) {
    return renames
  }
  return new Map([...renames, ...stable])
}

/**
 * Every name this function declares — parameters and locals — in declaration
 * order, carrying the type where the source states one. An un-annotated `let`
 * maps to `undefined`: the emitter infers it from the initializer when it gets
 * there, and until then nothing may assume a type for it.
 *
 * The map is flat, where WGSL scopes are nested, so two branches declaring the
 * same name would collapse onto whichever came last — and a type silently
 * changed from `u32` to `f32` that way is a wrong `/` or a wrong shift, not a
 * compile error. slangc's SSA-ish naming makes it very unlikely; say so anyway,
 * because the alternative is silent.
 */
function collectDeclared(fn: WgslFn) {
  const into = new Map<string, WgslType | undefined>()
  const declare = (name: string, type: WgslType | undefined) => {
    if (into.has(name) && into.get(name) !== type) {
      throw new Error(
        `wgslToJs: '${fn.name}' declares '${name}' twice with different types ` +
          `(${into.get(name) ?? 'inferred'} and ${type ?? 'inferred'}). The ` +
          `emitter's scope is flat, so it cannot tell which one a later ` +
          `reference means.`,
      )
    }
    into.set(name, type)
  }
  for (const p of fn.params) {
    declare(p.name, p.type)
  }
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === 'var') {
        declare(s.name, s.type)
      } else if (s.k === 'if') {
        walk(s.thenBody)
        if (s.else) {
          walk(s.else)
        }
      }
    }
  }
  walk(fn.body)
  return into
}

/** Every name this function calls — builtins included; the caller sorts them out. */
function collectCalls(fn: WgslFn, into: Set<string>) {
  const walkExpr = (e: Expr) => {
    if (e.k === 'unary') {
      walkExpr(e.e)
    } else if (e.k === 'bin') {
      walkExpr(e.l)
      walkExpr(e.r)
    } else if (e.k === 'call') {
      into.add(e.name)
      for (const a of e.args) {
        walkExpr(a)
      }
    } else if (e.k === 'vec2') {
      // A vec2 is not itself a call, but its components can be — miss these and
      // a helper reached only from inside a returned pair is left out of the
      // emitted module, or its refusal goes unreported.
      for (const a of e.args) {
        walkExpr(a)
      }
    }
  }
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === 'var') {
        if (s.init) {
          walkExpr(s.init)
        }
      } else if (s.k === 'assign') {
        walkExpr(s.value)
      } else if (s.k === 'if') {
        walkExpr(s.cond)
        walk(s.thenBody)
        if (s.else) {
          walk(s.else)
        }
      } else if (s.k === 'return' && s.value) {
        walkExpr(s.value)
      } else if (s.k === 'expr') {
        walkExpr(s.e)
      }
    }
  }
  walk(fn.body)
}

export function parseWgsl(wgsl: string): WgslModule {
  return new Parser(tokenize(wgsl)).parseModule()
}

/**
 * Resolve one `//! js-export` name to the mangled name slangc gave it. The exact
 * name wins over the demangled one, so a base name two overloads share can still
 * be exported by picking one explicitly.
 */
function resolveExport(
  want: string,
  fns: readonly WgslFn[],
  refused: readonly WgslRefusal[],
) {
  if (fns.some(f => f.name === want)) {
    return want
  }
  const hits = fns.filter(f => demangle(f.name) === want)
  if (hits.length === 1) {
    return hits[0]!.name
  }
  if (hits.length > 1) {
    throw new Error(
      `//! js-export: '${want}' is ambiguous — slangc emitted ` +
        `${hits.map(f => f.name).join(' and ')}. Name one of those instead.`,
    )
  }
  const blocked = refused.find(
    r => r.name === want || demangle(r.name) === want,
  )
  if (blocked) {
    throw new Error(
      `//! js-export: '${want}' is outside the supported scalar subset. ${
        blocked.reason
      }`,
    )
  }
  throw new Error(
    `//! js-export names a function absent from the compiled WGSL: ` +
      `${want}. Present: ${[...new Set(fns.map(f => demangle(f.name)))]
        .sort()
        .join(
          ', ',
        )}. (In a shader with entry points, slangc drops any function no entry ` +
      `point reaches — an export must be called from the draw path.)`,
  )
}

/**
 * Emit a TS module exposing `exported` (named by their Slang identifiers).
 * Transitively-reachable helpers come along as module-private functions;
 * everything else in the WGSL — including the stage support code a whole
 * shader carries — is left out entirely.
 */
export function emitJsTwins(
  baseName: string,
  wgsl: string,
  exported: readonly string[],
  headerLines: readonly string[],
): string {
  return emitFromModule(baseName, parseWgsl(wgsl), exported, headerLines)
}

/**
 * Why `name` cannot be emitted, or `undefined` if it can.
 *
 * Parsing a function and emitting it are two different bars, and the gap
 * between them is where the liftability inventory was lying. The parser accepts
 * any call syntactically, so a body full of `ddx`/`dot`/`textureSample` reads
 * fine and lands in `fns`; the refusal happens in the emitter, which knows those
 * builtins have no JS equivalent. An inventory built on the parser alone
 * therefore advertised functions that `//! js-export` would reject — and the
 * FIRST real candidate it produced, `glyphEdgeAlpha`, was one of them.
 *
 * Actually attempting the emission is the only honest test, and it is cheap:
 * the module is already parsed, and this is pure string work.
 */
export function emitRefusal(mod: WgslModule, name: string) {
  try {
    emitFromModule('probe', mod, [name], [])
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function emitFromModule(
  baseName: string,
  mod: WgslModule,
  exported: readonly string[],
  headerLines: readonly string[],
): string {
  const { fns, refused } = mod
  const byName = new Map(fns.map(f => [f.name, f]))

  // Exported functions keep the name the directive asked for — a consumer
  // imports that spelling — so they are resolved first and the rest of the
  // naming works around them.
  const roots = exported.map(n => resolveExport(n, fns, refused))
  const exportNames = new Map(roots.map((n, i) => [n, exported[i]!]))

  const needed = new Set<string>()
  const visit = (name: string, root: string) => {
    if (needed.has(name)) {
      return
    }
    needed.add(name)
    const calls = new Set<string>()
    collectCalls(byName.get(name)!, calls)
    for (const callee of calls) {
      const blocked = refused.find(r => r.name === callee)
      if (blocked) {
        throw new Error(
          `//! js-export: '${root}' reaches ${demangle(callee)}(), which is ` +
            `outside the supported scalar subset. ${blocked.reason}`,
        )
      }
      if (byName.has(callee)) {
        visit(callee, root)
      }
    }
  }
  for (const r of roots) {
    visit(r, exportNames.get(r)!)
  }

  // Private helpers demangle only where that stays injective *and* clear of
  // every exported name; otherwise the whole set keeps its mangled spelling
  // rather than one silently aliasing another.
  const privateRenames = buildRenames(
    [...needed].filter(n => !exportNames.has(n)),
    new Set(exported),
  )
  const fnRenames = new Map([...privateRenames, ...exportNames])
  const fnName = (n: string) => fnRenames.get(n) ?? n
  const reserved = new Set([...needed].map(fnName))

  const em = new Emitter(
    fnRenames,
    needed,
    new Map(fns.map(f => [f.name, f.returnType])),
  )
  // Every identifier the module ends up binding, so the helper check below can
  // see a local that would shadow one.
  const emittedNames = new Set(reserved)
  const bodies = fns
    .filter(f => needed.has(f.name))
    .map(f => {
      // Locals resolve per function, and never onto a name a module function
      // already holds — that would turn a call into a reference to the local.
      const declared = collectDeclared(f)
      const localRenames = stabilizeTemps(
        buildRenames(declared.keys(), reserved),
        declared.keys(),
        reserved,
      )
      // setScope takes only the names the source annotates; an un-annotated
      // `let` is typed by `stmts` when it reaches the declaration.
      const annotated = new Map<string, WgslType>()
      for (const [name, type] of declared) {
        if (type !== undefined) {
          annotated.set(name, type)
        }
      }
      em.setScope(new Map([...fnRenames, ...localRenames]), annotated)
      const short = (n: string) => em.rename(n)
      for (const n of declared.keys()) {
        emittedNames.add(short(n))
      }
      const exp = exportNames.has(f.name) ? 'export ' : ''
      const params = f.params
        .map(p => `${short(p.name)}: ${tsTypeOf(p.type)}`)
        .join(', ')
      return [
        `${exp}function ${fnName(f.name)}(${params}): ${tsTypeOf(f.returnType)} {`,
        ...em.stmts(f.body, '  '),
        '}',
      ].join('\n')
    })

  // The builtin helpers are emitted at module scope under fixed names, so a
  // shader-side identifier spelled `_clamp` would shadow the one its own body
  // calls — `let _clamp = _clamp(x, 0, 1)`, which is a TDZ throw at best and a
  // wrong answer at worst. Nothing in the tree does it and nothing should, so
  // say so rather than renaming around it.
  //
  // The same hazard reaches past the helpers, and used to go unmentioned. The
  // emitter also reads `Math` and `Boolean` off the global scope, so a Slang
  // local named `Math` emitted `let Math = Math.floor(a)` — a TDZ error on the
  // very line that declares it. And JS reserves words Slang does not, so a
  // local named `new` or `delete` emitted a module that does not parse. Both
  // are caught by `pnpm typecheck` today, several steps downstream, as an error
  // about a generated file the reader is told never to edit; the point of
  // naming them here is that the message can say which .slang identifier to
  // rename.
  const shadowed = [
    ...[...withHelperDeps(em.usedHelpers)].filter(h => emittedNames.has(h)),
    ...[...EMITTER_GLOBALS, ...JS_RESERVED].filter(n => emittedNames.has(n)),
  ]
  if (shadowed.length > 0) {
    throw new Error(
      `wgslToJs: ${[...new Set(shadowed)].join(', ')} is both a name this ` +
        `module binds and a name the emitted JS needs for something else — a ` +
        `helper or global it calls, or a word JS reserves. Rename it in the ` +
        `.slang.`,
    )
  }

  const helpers = [...withHelperDeps(em.usedHelpers)]
    .sort()
    .map(h => HELPERS[h]!)
  return [
    ...headerLines,
    `// Scalar twins of ${baseName}.slang, transliterated from slangc's WGSL so`,
    `// the Canvas2D and SVG paths run the shader's own math. See adr-051.`,
    '',
    ...(helpers.length > 0 ? [helpers.join('\n\n'), ''] : []),
    bodies.join('\n\n'),
    '',
  ].join('\n')
}
