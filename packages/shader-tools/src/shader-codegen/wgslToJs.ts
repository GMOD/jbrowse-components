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

type Stmt =
  | { k: 'var'; name: string; type: WgslType; init?: Expr }
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

export interface WgslParam {
  name: string
  type: WgslType
}

export interface WgslFn {
  name: string
  params: WgslParam[]
  returnType: WgslType | 'void'
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

const tsTypeOf = (t: WgslType | 'void') =>
  t === 'bool' ? 'boolean' : t === 'void' ? 'void' : 'number'

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
    let returnType: WgslType | 'void' = 'void'
    if (this.eat('->')) {
      this.skipAttributes()
      returnType = this.parseType()
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
      // A `let` with an inferred type: slangc always annotates `var`, and an
      // un-annotated binding is only ever an f32 temporary in the output seen
      // so far. Anything relying on its being an integer would have to be
      // written by slangc as an explicit `u32(...)`, which types itself.
      const type = this.eat(':') ? this.parseType() : 'f32'
      const init = this.eat('=') ? this.parseExpr() : undefined
      this.expect(';')
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
      if (this.at('(')) {
        this.next()
        const args: Expr[] = []
        while (!this.at(')')) {
          args.push(this.parseExpr())
          if (!this.eat(',')) {
            break
          }
        }
        this.expect(')')
        return this.rejectPostfix({
          k: 'call',
          name: t.text,
          args,
          line: t.line,
        })
      }
      return this.rejectPostfix({ k: 'ident', name: t.text })
    }
    this.unsupported(t, `token '${t.text}'`)
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
  max: 'Math.max',
  min: 'Math.min',
  pow: 'Math.pow',
  sign: 'Math.sign',
  sqrt: 'Math.sqrt',
  trunc: 'Math.trunc',
}

// Builtins needing a helper. Emitted only when referenced, so the generated
// file stays readable.
const HELPERS: Record<string, string> = {
  _clamp: [
    'function _clamp(x: number, lo: number, hi: number) {',
    '  return Math.min(Math.max(x, lo), hi)',
    '}',
  ].join('\n'),
  // WGSL defines mix as `a*(1-t) + b*t`, not the lerp form `a + (b-a)*t`. The
  // two are equal in exact arithmetic and not in floating point: the lerp form
  // does not return `b` exactly at t=1, which matters to a consumer quantizing
  // the result into byte space.
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
  _smoothstep: [
    'function _smoothstep(e0: number, e1: number, x: number) {',
    '  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)',
    '  return t * t * (3 - 2 * t)',
    '}',
  ].join('\n'),
}
const HELPER_BUILTINS = new Set(['clamp', 'mix', 'step', 'fract', 'smoothstep'])

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
  private returnTypes: ReadonlyMap<string, WgslType | 'void'>
  private scopeTypes: ReadonlyMap<string, WgslType> = new Map()

  constructor(
    renames: Map<string, string>,
    moduleFns: ReadonlySet<string>,
    returnTypes: ReadonlyMap<string, WgslType | 'void'>,
  ) {
    this.renames = renames
    this.moduleFns = moduleFns
    this.returnTypes = returnTypes
  }

  /** Swap in the current function's local scope before emitting its body. */
  setScope(renames: Map<string, string>, types: ReadonlyMap<string, WgslType>) {
    this.renames = renames
    this.scopeTypes = types
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
        return ret === 'void' ? undefined : ret
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

  rename(name: string) {
    return this.renames.get(name) ?? name
  }

  private id(name: string) {
    return this.rename(name)
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
        return this.id(e.name)
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
        // WGSL and JS agree on the remaining arithmetic and comparison
        // operators, up to the float64-vs-float32 width the ADR accepts. They
        // do NOT agree on integer overflow — a u32 `+`/`*` wraps on the GPU and
        // grows in JS — but that needs 2^32-scale inputs, which no exported
        // decision goes anywhere near, and float64 cannot model the wrap
        // faithfully anyway (the product loses bits before it could be masked).
        return `(${this.expr(e.l)} ${e.op} ${this.expr(e.r)})`
      }
      case 'call': {
        return this.call(e)
      }
    }
  }

  private call(e: Expr & { k: 'call' }): string {
    const name = e.name
    const misleading = MISLEADING_BUILTINS[name]
    if (misleading) {
      throw new Error(
        `wgslToJs: '${name}' at line ${e.line} has no exact JS equivalent. ` +
          misleading,
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
    if (this.moduleFns.has(name)) {
      return `${this.id(name)}(${a.join(', ')})`
    }
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

  stmts(list: Stmt[], indent: string): string[] {
    const out: string[] = []
    for (const s of list) {
      switch (s.k) {
        case 'var': {
          out.push(
            s.init === undefined
              ? `${indent}let ${this.id(s.name)}: ${tsTypeOf(s.type)}`
              : `${indent}let ${this.id(s.name)} = ${this.expr(s.init)}`,
          )
          break
        }
        case 'assign': {
          out.push(`${indent}${this.id(s.name)} = ${this.expr(s.value)}`)
          break
        }
        case 'return': {
          out.push(
            s.value === undefined
              ? `${indent}return`
              : `${indent}return ${this.expr(s.value)}`,
          )
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

/** Every name this function declares — parameters and locals — with its type. */
function collectDeclared(fn: WgslFn) {
  const into = new Map<string, WgslType>()
  for (const p of fn.params) {
    into.set(p.name, p.type)
  }
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === 'var') {
        into.set(s.name, s.type)
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
      `//! js-export: '${want}' is outside the supported scalar subset. ` +
        blocked.reason,
    )
  }
  throw new Error(
    `//! js-export names a function absent from the compiled WGSL: ` +
      `${want}. Present: ` +
      [...new Set(fns.map(f => demangle(f.name)))].sort().join(', ') +
      `. (In a shader with entry points, slangc drops any function no entry ` +
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
  const { fns, refused } = parseWgsl(wgsl)
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
  const bodies = fns
    .filter(f => needed.has(f.name))
    .map(f => {
      // Locals resolve per function, and never onto a name a module function
      // already holds — that would turn a call into a reference to the local.
      const declared = collectDeclared(f)
      em.setScope(
        new Map([...fnRenames, ...buildRenames(declared.keys(), reserved)]),
        declared,
      )
      const short = (n: string) => em.rename(n)
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

  const helpers = [...em.usedHelpers].sort().map(h => HELPERS[h]!)
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
