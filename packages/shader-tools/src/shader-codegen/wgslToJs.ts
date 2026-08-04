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
  | { k: 'var'; name: string; tsType: string; init?: Expr }
  | { k: 'assign'; name: string; value: Expr }
  | { k: 'if'; cond: Expr; thenBody: Stmt[]; else?: Stmt[] }
  | { k: 'return'; value?: Expr }
  | { k: 'expr'; e: Expr }

export interface WgslParam {
  name: string
  tsType: string
}

export interface WgslFn {
  name: string
  params: WgslParam[]
  returnType: string
  body: Stmt[]
  /** entry points (`@compute` / `@vertex` / `@fragment`) are parsed then dropped */
  isEntry: boolean
}

const STAGE_ATTRS = new Set(['compute', 'vertex', 'fragment'])

// Scalar types only. A vector type is a real gap, not a bug — it reports itself,
// so the emitter's coverage is always explicit rather than assumed.
const SCALAR_TYPES: Record<string, string> = {
  f32: 'number',
  u32: 'number',
  i32: 'number',
  bool: 'boolean',
}

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

  private parseType() {
    const t = this.next()
    const ts = t.kind === 'ident' ? SCALAR_TYPES[t.text] : undefined
    if (ts === undefined) {
      this.unsupported(t, `type '${t.text}'`)
    }
    return ts
  }

  parseModule(): WgslFn[] {
    const fns: WgslFn[] = []
    while (this.pos < this.toks.length) {
      const attrs = this.skipAttributes()
      if (this.pos >= this.toks.length) {
        break
      }
      if (this.at('fn')) {
        if (attrs.some(a => STAGE_ATTRS.has(a))) {
          this.skipFn()
        } else {
          fns.push(this.parseFn(false))
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
    return fns
  }

  private parseFn(isEntry: boolean): WgslFn {
    this.expect('fn')
    const name = this.next().text
    this.expect('(')
    const params: WgslParam[] = []
    while (!this.at(')')) {
      this.skipAttributes()
      const pname = this.next().text
      this.expect(':')
      params.push({ name: pname, tsType: this.parseType() })
      if (!this.eat(',')) {
        break
      }
    }
    this.expect(')')
    let returnType = 'void'
    if (this.eat('->')) {
      this.skipAttributes()
      returnType = this.parseType()
    }
    return { name, params, returnType, body: this.parseBlock(), isEntry }
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
      const tsType = this.eat(':') ? this.parseType() : 'number'
      const init = this.eat('=') ? this.parseExpr() : undefined
      this.expect(';')
      return { k: 'var', name, tsType, init }
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

  // Precedence climbing, lowest binding first.
  private static readonly LEVELS = [
    ['||'],
    ['&&'],
    ['==', '!='],
    ['<', '>', '<=', '>='],
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
    if (t.text === '-' || t.text === '!') {
      this.next()
      return { k: 'unary', op: t.text, e: this.parseUnary() }
    }
    if (t.text === '&' || t.text === '*' || t.text === '~') {
      // Pointer take/deref (slangc emits these for uniform/`inout` params) and
      // bitwise-not. Real gaps, not things to guess at.
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
  round: 'Math.round',
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
  _mix: [
    'function _mix(a: number, b: number, t: number) {',
    '  return a + (b - a) * t',
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

class Emitter {
  readonly usedHelpers = new Set<string>()

  private renames: Map<string, string>
  private moduleFns: ReadonlySet<string>

  constructor(renames: Map<string, string>, moduleFns: ReadonlySet<string>) {
    this.renames = renames
    this.moduleFns = moduleFns
  }

  /** Swap in the current function's local scope before emitting its body. */
  setScope(renames: Map<string, string>) {
    this.renames = renames
  }

  rename(name: string) {
    return this.renames.get(name) ?? name
  }

  private id(name: string) {
    return this.rename(name)
  }

  /** Drop WGSL's literal type suffix: `0.5f` -> `0.5`, `1u` -> `1`. */
  private num(text: string) {
    return text.replace(/[fhuil]$/, '')
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
        return `${e.op}${this.expr(e.e)}`
      }
      case 'bin': {
        // WGSL and JS agree on every operator in this subset for f32 operands.
        // Parenthesized unconditionally: slangc's output is already fully
        // parenthesized where it matters, and re-deriving precedence here is a
        // silent-wrongness risk for no readability gain.
        return `(${this.expr(e.l)} ${e.op} ${this.expr(e.r)})`
      }
      case 'call': {
        return this.call(e)
      }
    }
  }

  private call(e: Expr & { k: 'call' }): string {
    const a = e.args.map(x => this.expr(x))
    const name = e.name
    // Scalar constructors. `f32(x)` is identity on a JS number; the integer
    // ones truncate the way the shader does.
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
              ? `${indent}let ${this.id(s.name)}: ${s.tsType}`
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
    const stripped = n.replace(/_\d+$/, '')
    const prior = taken.get(stripped)
    if ((prior !== undefined && prior !== n) || reserved?.has(stripped)) {
      return new Map<string, string>()
    }
    taken.set(stripped, n)
  }
  return new Map(all.map(n => [n, n.replace(/_\d+$/, '')]))
}

function collectIdents(fn: WgslFn, into: Set<string>) {
  for (const p of fn.params) {
    into.add(p.name)
  }
  const walkExpr = (e: Expr) => {
    if (e.k === 'unary') {
      walkExpr(e.e)
    } else if (e.k === 'bin') {
      walkExpr(e.l)
      walkExpr(e.r)
    } else if (e.k === 'call') {
      for (const a of e.args) {
        walkExpr(a)
      }
    }
  }
  const walk = (list: Stmt[]) => {
    for (const s of list) {
      if (s.k === 'var') {
        into.add(s.name)
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

export function parseWgsl(wgsl: string): WgslFn[] {
  return new Parser(tokenize(wgsl)).parseModule()
}

/**
 * Emit a TS module exposing `exported` (named by their Slang identifiers).
 * Transitively-reachable helpers come along as module-private functions.
 */
export function emitJsTwins(
  baseName: string,
  wgsl: string,
  exported: readonly string[],
  headerLines: readonly string[],
): string {
  const fns = parseWgsl(wgsl).filter(f => !f.isEntry)

  const moduleFns = new Set(fns.map(f => f.name))
  const fnRenames = buildRenames(moduleFns)
  const fnShort = (n: string) => fnRenames.get(n) ?? n
  const reserved = new Set([...moduleFns].map(fnShort))

  const byShortName = new Map(fns.map(f => [fnShort(f.name), f]))
  const missing = exported.filter(n => !byShortName.has(n))
  if (missing.length > 0) {
    throw new Error(
      `//! js-export names function(s) absent from the compiled WGSL: ` +
        `${missing.join(', ')}. Present: ` +
        [...byShortName.keys()].sort().join(', '),
    )
  }

  const em = new Emitter(fnRenames, moduleFns)
  const bodies = fns.map(f => {
    // Locals resolve per function, and never onto a name a module function
    // already holds — that would turn a call into a reference to the local.
    const locals = new Set<string>()
    collectIdents(f, locals)
    em.setScope(new Map([...fnRenames, ...buildRenames(locals, reserved)]))
    const short = (n: string) => em.rename(n)
    const exp = exported.includes(fnShort(f.name)) ? 'export ' : ''
    const params = f.params.map(p => `${short(p.name)}: ${p.tsType}`).join(', ')
    return [
      `${exp}function ${fnShort(f.name)}(${params}): ${f.returnType} {`,
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
