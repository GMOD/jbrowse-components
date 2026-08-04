import { emitJsTwins, parseWgsl } from './wgslToJs.ts'

// The emitter's contract is narrow on purpose (adr-051): transliterate the
// scalar subset exactly, and refuse everything else *loudly*. These tests weight
// the refusals as heavily as the translations — a silent mistranslation is worse
// than the hand-written twin this replaces, because the twin is reviewable.

const HEADER = ['// generated', '']

function emit(wgsl: string, exported: string[]) {
  return emitJsTwins('probe', wgsl, exported, HEADER)
}

/** Evaluate a generated module and hand back one of its exports. */
function evaluate(src: string, name: string) {
  const js = src
    .replaceAll(/^export function/gm, 'function')
    .replaceAll(/: (number|boolean)/g, '')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${js}\nreturn ${name}`)() as (
    ...args: number[]
  ) => number
}

test('translates a function with if/else and a call into runnable JS', () => {
  const out = emit(
    `fn double_0( x_0 : f32) -> f32 { return x_0 * 2.0f; }
     fn pick_0( a_0 : f32) -> f32 {
       var _S1 : f32;
       if((a_0 < 0.0f)) { _S1 = double_0(a_0); } else { _S1 = a_0; }
       return _S1;
     }`,
    ['pick'],
  )
  const pick = evaluate(out, 'pick')
  expect(pick(-3)).toBe(-6)
  expect(pick(4)).toBe(4)
})

test('strips slangc name mangling but keeps it when ambiguous', () => {
  const clean = emit(`fn f_0( x_0 : f32) -> f32 { return x_0; }`, ['f'])
  expect(clean).toContain('export function f(x: number)')

  // Two functions colliding on the same base name: nobody gets the short form,
  // rather than one silently shadowing the other.
  const ambiguous = parseWgsl(
    `fn f_0( x_0 : f32) -> f32 { return x_0; }
     fn f_1( x_0 : f32) -> f32 { return x_0 + 1.0f; }`,
  ).fns
  expect(ambiguous.map(f => f.name)).toStrictEqual(['f_0', 'f_1'])
  expect(
    emit(
      `fn f_0( x_0 : f32) -> f32 { return x_0; }
     fn f_1( x_0 : f32) -> f32 { return x_0 + 1.0f; }`,
      ['f_0'],
    ),
  ).toContain('export function f_0(')
})

test('a local reusing another function’s parameter name is not a collision', () => {
  // Regression: a module-wide injectivity check saw `heightPx_0` in one function
  // and `heightPx_1` in another as ambiguous and gave up on the entire file.
  const out = emit(
    `fn a_0( heightPx_0 : f32) -> f32 { return heightPx_0; }
     fn b_0( heightPx_1 : f32) -> f32 { return a_0(heightPx_1) + 1.0f; }`,
    ['a', 'b'],
  )
  expect(out).toContain('export function a(heightPx: number)')
  expect(out).toContain('export function b(heightPx: number)')
  expect(evaluate(out, 'b')(2)).toBe(3)
})

test('only the named functions are exported; dependencies stay private', () => {
  const out = emit(
    `fn helper_0( x_0 : f32) -> f32 { return x_0 * 3.0f; }
     fn top_0( x_0 : f32) -> f32 { return helper_0(x_0); }`,
    ['top'],
  )
  expect(out).toContain('export function top(')
  expect(out).toContain('function helper(')
  expect(out).not.toContain('export function helper(')
})

test('drops literal type suffixes and emits helpers only when used', () => {
  const plain = emit(`fn f_0( x_0 : f32) -> f32 { return x_0 + 0.5f; }`, ['f'])
  expect(plain).toContain('0.5')
  expect(plain).not.toContain('0.5f')
  expect(plain).not.toContain('_clamp')

  const clamped = emit(
    `fn f_0( x_0 : f32) -> f32 { return clamp(x_0, 0.0f, 1.0f); }`,
    ['f'],
  )
  expect(clamped).toContain('function _clamp')
  expect(evaluate(clamped, 'f')(5)).toBe(1)
})

test('entry points are skipped, not parsed', () => {
  // Their stage builtins (`vec3<u32>`) are outside the scalar subset by
  // construction; parsing them would reject a module for a type nothing reads.
  const { fns, refused } = parseWgsl(
    `fn keep_0( x_0 : f32) -> f32 { return x_0; }
     @compute @workgroup_size(1, 1, 1)
     fn probe(@builtin(global_invocation_id) tid_0 : vec3<u32>) { return; }`,
  )
  expect(fns.map(f => f.name)).toStrictEqual(['keep_0'])
  expect(refused).toStrictEqual([])
})

// A whole shader's WGSL (as opposed to a module's) arrives with its vertex and
// fragment support code attached. That code is outside the subset by
// construction and no export reaches it, so it must not veto the file — but it
// must still veto an export that turns out to call it.
describe('lifting from a shader with entry points', () => {
  const SHADER = `
    struct Uniforms_std140_0 { @align(16) zero_0 : f32, };
    @binding(1) @group(0) var<uniform> u_0 : Uniforms_std140_0;
    fn unpackRGBA_0( packed_0 : u32) -> vec4<f32> {
      return vec4<f32>(f32(packed_0), 0.0f, 0.0f, 1.0f);
    }
    fn bpToClipX_0( bp_0 : u32,  u_1 : ptr<function, Uniforms_std140_0>) -> f32 {
      return f32(bp_0) * (*u_1).zero_0;
    }
    fn mapCount_0( count_0 : f32,  maxScore_0 : f32) -> f32 {
      return clamp(count_0 / max(maxScore_0, 0.001f), 0.0f, 1.0f);
    }
    @vertex
    fn vs_main(@location(0) pos_0 : vec2<f32>) -> @builtin(position) vec4<f32> {
      return vec4<f32>(pos_0, 0.0f, 1.0f);
    }`

  test('parks the unreadable stage code instead of rejecting the file', () => {
    const { fns, refused } = parseWgsl(SHADER)
    expect(fns.map(f => f.name)).toStrictEqual(['mapCount_0'])
    expect(refused.map(r => r.name)).toStrictEqual([
      'unpackRGBA_0',
      'bpToClipX_0',
    ])
  })

  test('emits only what the export reaches', () => {
    const out = emit(SHADER, ['mapCount'])
    expect(out).toContain('export function mapCount(')
    expect(out).not.toContain('unpackRGBA')
    expect(out).not.toContain('bpToClipX')
    expect(evaluate(out, 'mapCount')(5, 10)).toBe(0.5)
  })

  test('re-throws the refusal when an export names a parked function', () => {
    expect(() => emit(SHADER, ['unpackRGBA'])).toThrow(/vec4/)
  })

  test('re-throws the refusal when an export *calls* a parked function', () => {
    expect(() =>
      emit(
        `${SHADER}
         fn wrap_0( bp_0 : u32) -> f32 { return bpToClipX_0(bp_0, x_0); }`,
        ['wrap'],
      ),
    ).toThrow(/wrap.*bpToClipX.*ptr/s)
  })

  test('tells you a dead function was eliminated before WGSL existed', () => {
    expect(() => emit(SHADER, ['neverCalled'])).toThrow(
      /no entry point reaches/,
    )
  })
})

// JS bitwise operators coerce to *signed* int32, so a `u32` at or above 2^31
// comes back negative and `>>` shifts in sign bits. These are the cases where a
// transliteration that ignored signedness would be silently wrong — packed ABGR
// colors and flag words live right in that range.
describe('bit operations', () => {
  test('masks a flag word and renormalizes to unsigned', () => {
    const out = emit(
      `fn f_0( flags_0 : u32) -> bool { return (flags_0 & 8u) != 0u; }`,
      ['f'],
    )
    const f = evaluate(out, 'f')
    expect(f(8)).toBe(true)
    expect(f(9)).toBe(true)
    expect(f(1)).toBe(false)
    // The top bit set: a signed result would be negative, and `!= 0` still
    // happens to work — but the value must be right for anything that uses it.
    expect(f(0xffffffff)).toBe(true)
  })

  test('a u32 shift-right is >>>, not >>', () => {
    const out = emit(
      `fn f_0( packed_0 : u32) -> u32 { return (packed_0 >> 24u) & 255u; }`,
      ['f'],
    )
    // 0xff000000 >> 24 is -1 in JS; >>> 24 is 255. This is the alpha byte of
    // every packed color in the tree.
    expect(evaluate(out, 'f')(0xff000000)).toBe(255)
    expect(evaluate(out, 'f')(0x7f123456)).toBe(0x7f)
  })

  test('an i32 shift-right keeps its sign', () => {
    const out = emit(`fn f_0( v_0 : i32) -> i32 { return v_0 >> 1i; }`, ['f'])
    expect(out).toContain('>> 1')
    expect(out).not.toContain('>>>')
    expect(evaluate(out, 'f')(-8)).toBe(-4)
  })

  test('a u32 OR above 2^31 stays positive', () => {
    const out = emit(
      `fn f_0( a_0 : u32) -> u32 { return a_0 | 2147483648u; }`,
      ['f'],
    )
    expect(evaluate(out, 'f')(1)).toBe(2147483649)
  })

  test('refuses a shift whose operand type it cannot infer', () => {
    // `textureLoad` is unknown to the emitter, so the left operand's signedness
    // is unknown — emitting either `>>` or `>>>` would be a guess.
    expect(() =>
      emit(`fn f_0( a_0 : f32) -> f32 { return textureLoad(a_0) >> 1u; }`, [
        'f',
      ]),
    ).toThrow(/signed/)
  })

  test('refuses a bitwise op on a float', () => {
    expect(() =>
      emit(`fn f_0( a_0 : f32) -> f32 { return a_0 & 1u; }`, ['f']),
    ).toThrow(/signed/)
  })

  test('a hex literal keeps every digit', () => {
    // The suffix strip has to know the base: `0xff` blind-stripped of a
    // trailing `f` is `0xf`, so 255 becomes 15 with nothing thrown, and `0xf`
    // becomes the unparseable `0x`.
    const out = emit(
      `fn f_0( v_0 : u32) -> u32 { return (v_0 & 0xff) + 0xf; }`,
      ['f'],
    )
    expect(out).toContain('0xff')
    expect(evaluate(out, 'f')(0x1234)).toBe(0x34 + 0xf)
  })
})

describe('integer division', () => {
  // WGSL divides integers with truncation; JS never does. Unlike the overflow
  // cases, this is wrong for ordinary in-range inputs, so it has to be handled
  // rather than documented.
  test('a u32 quotient truncates', () => {
    const out = emit(
      `fn f_0( idx_0 : u32, per_0 : u32) -> u32 { return idx_0 / per_0; }`,
      ['f'],
    )
    expect(evaluate(out, 'f')(7, 2)).toBe(3)
    expect(evaluate(out, 'f')(5, 6)).toBe(0)
  })

  test('an i32 quotient truncates toward zero, as WGSL does', () => {
    const out = emit(
      `fn f_0( a_0 : i32, b_0 : i32) -> i32 { return a_0 / b_0; }`,
      ['f'],
    )
    // Not Math.floor: -7/2 is -3 in WGSL and -4 under floor.
    expect(evaluate(out, 'f')(-7, 2)).toBe(-3)
  })

  test('a float quotient is left alone', () => {
    const out = emit(
      `fn f_0( a_0 : f32, b_0 : f32) -> f32 { return a_0 / b_0; }`,
      ['f'],
    )
    expect(out).not.toContain('Math.trunc')
    expect(evaluate(out, 'f')(7, 2)).toBe(3.5)
  })

  test('a remainder needs no adjustment in either signedness', () => {
    // Both languages take the sign of the dividend and truncate toward zero.
    const out = emit(
      `fn f_0( a_0 : i32, b_0 : i32) -> i32 { return a_0 % b_0; }`,
      ['f'],
    )
    expect(evaluate(out, 'f')(-7, 2)).toBe(-1)
  })
})

test('folds a literal scalar constructor instead of wrapping it', () => {
  // slangc spells every integer literal as a constructor call, so leaving these
  // alone buries the code in `((10) >>> 0)` — and a reviewable twin is the
  // fallback safety property when the generator is wrong.
  const out = emit(
    `fn f_0( n_0 : u32) -> f32 { if(n_0 < u32(10)) { return 1.0f; } return f32(u32(2)); }`,
    ['f'],
  )
  expect(out).toContain('< 10')
  expect(out).not.toContain('>>> 0')
  expect(evaluate(out, 'f')(3)).toBe(1)
  expect(evaluate(out, 'f')(30)).toBe(2)
})

test('a nested negation does not emit a decrement', () => {
  const out = emit(`fn f_0( a_0 : f32) -> f32 { return -(-a_0); }`, ['f'])
  expect(out).not.toContain('--')
  expect(evaluate(out, 'f')(3)).toBe(3)
})

test.each([
  ['vector types', `fn f_0( v_0 : vec2<f32>) -> f32 { return 1.0f; }`, 'vec2'],
  ['swizzles', `fn f_0( x_0 : f32) -> f32 { return x_0.y; }`, 'member access'],
  [
    'loops',
    `fn f_0( x_0 : f32) -> f32 { loop { break; } return x_0; }`,
    'loop',
  ],
  ['indexing', `fn f_0( x_0 : f32) -> f32 { return x_0[0]; }`, 'indexing'],
])('refuses %s rather than guessing', (_label, wgsl, needle) => {
  expect(() => emit(wgsl, ['f'])).toThrow(needle)
})

test('refuses an unimplemented builtin instead of emitting a dangling call', () => {
  // `dot` would otherwise look exactly like a call to a module function and be
  // emitted as `dot(...)`, resolving to nothing at runtime.
  expect(() =>
    emit(`fn f_0( x_0 : f32) -> f32 { return dot(x_0, x_0); }`, ['f']),
  ).toThrow(/dot/)
})

test('names the candidates when js-export asks for a missing function', () => {
  expect(() =>
    emit(`fn present_0( x_0 : f32) -> f32 { return x_0; }`, ['absent']),
  ).toThrow(/absent.*present/s)
})
