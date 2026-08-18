import { TRANSLATION_RULES, emitJsTwins, parseWgsl } from './wgslToJs.ts'

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

// WGSL's min/max on a NaN are indeterminate, and slangc's C++ prelude resolves
// them as `::fmaxf` / `::fminf` — which DROP the NaN and return the other
// operand, whichever side it is on. JS's Math.min/Math.max propagate it. The
// emitter's helpers therefore have to be written to match, or every twin that
// clamps disagrees with the shader on exactly the input this codebase already
// guards by hand elsewhere.
describe('NaN through the clamping helpers', () => {
  test('clamp returns a bound, as the shader does, not NaN', () => {
    const clamp = evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return clamp(x_0, 0.0f, 1.0f); }`, [
        'f',
      ]),
      'f',
    )
    expect(clamp(Number.NaN)).toBe(0)
    // …and is unchanged everywhere else.
    expect(clamp(-5)).toBe(0)
    expect(clamp(0.25)).toBe(0.25)
    expect(clamp(5)).toBe(1)
  })

  test('a direct max/min returns the bound, as the shader does', () => {
    // The gap the clamp fix left behind: the HELPERS were made NaN-faithful
    // while every direct `max(...)` in a shader body still went through
    // `Math.max`. `perpCoverage`'s `max(0.5 - 0.5 * perpW, 0.0)` on a
    // degenerate ribbon is 0 on the shader and was NaN here.
    const mx = evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return max(x_0, 0.0f); }`, ['f']),
      'f',
    )
    expect(mx(Number.NaN)).toBe(0)
    expect(mx(-3)).toBe(0)
    expect(mx(3)).toBe(3)

    const mn = evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return min(x_0, 1.0f); }`, ['f']),
      'f',
    )
    expect(mn(Number.NaN)).toBe(1)
    expect(mn(5)).toBe(1)
    expect(mn(0.5)).toBe(0.5)
  })

  test('and returns it from the SECOND argument too', () => {
    // The gap the gap-closing left behind, and the reason both tests above are
    // written with the NaN on the left: `a > b ? a : b` drops a NaN in first
    // position and RETURNS it in second, so it was faithful on exactly the half
    // anyone thought to check. `chevronFirstVisible(7.5, 0, 7.5)` — a zero
    // spacing making the division 0/0 — is 0 in slangc's C++ and was NaN here,
    // and the differential oracle is what noticed.
    const mx = evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return max(0.0f, x_0); }`, ['f']),
      'f',
    )
    expect(mx(Number.NaN)).toBe(0)
    expect(mx(-3)).toBe(0)
    expect(mx(3)).toBe(3)

    const mn = evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return min(1.0f, x_0); }`, ['f']),
      'f',
    )
    expect(mn(Number.NaN)).toBe(1)
    expect(mn(5)).toBe(1)
    expect(mn(0.5)).toBe(0.5)
  })

  test('two NaNs stay NaN, as fmax/fmin do', () => {
    const mx = evaluate(
      emit(`fn f_0( a_0 : f32, b_0 : f32) -> f32 { return max(a_0, b_0); }`, [
        'f',
      ]),
      'f',
    )
    expect(Number.isNaN(mx(Number.NaN, Number.NaN))).toBe(true)
  })

  test('a helper reached only through another helper is still emitted', () => {
    // `_clamp` calls `_min`/`_max` rather than restating the comparisons, and
    // helpers are emitted by reference — so without dependency closure the
    // module throws `_min is not defined` at import, which is exactly what the
    // first version of this did.
    const out = emit(
      `fn f_0( x_0 : f32) -> f32 { return clamp(x_0, 0.0f, 1.0f); }`,
      ['f'],
    )
    expect(out).toContain('function _clamp')
    expect(out).toContain('function _min')
    expect(out).toContain('function _max')
    expect(evaluate(out, 'f')(Number.NaN)).toBe(0)
  })

  test('smoothstep on a degenerate edge pair does not go NaN', () => {
    // `e0 == e1` makes the ratio 0/0. Reachable: `vertCoverage(20, 20, 0)`,
    // which is what the differential oracle failed on.
    const ss = evaluate(
      emit(
        `fn f_0( e_0 : f32,  x_0 : f32) -> f32 { return smoothstep(e_0, e_0, x_0); }`,
        ['f'],
      ),
      'f',
    )
    expect(ss(20, 20)).toBe(0)
    expect(Number.isNaN(ss(20, 20))).toBe(false)
    // The non-degenerate curve is untouched.
    expect(ss(0, -1)).toBe(0)
  })
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

// slangc annotates a `var` and leaves a `let` bare. The bare one used to be
// TYPED as f32 rather than left unknown, which is a fabricated answer, not a
// missing one — so every refusal phrased as "I could not infer" was satisfied
// by it and the integer paths below silently took the float branch.
describe('an un-annotated let takes its type from its initializer', () => {
  test('a u32 sum stays a u32, so dividing by it truncates', () => {
    const out = emit(
      `fn f_0( a_0 : u32) -> u32 { let t_0 = a_0 + 1u; return t_0 / 2u; }`,
      ['f'],
    )
    expect(out).toContain('Math.trunc')
    // Was 2.5 while the GPU said 2.
    expect(evaluate(out, 'f')(4)).toBe(2)
  })

  test('a u32 sum can still be shifted, which needs its signedness', () => {
    const out = emit(
      `fn f_0( a_0 : u32) -> u32 { let t_0 = a_0 | 2147483648u; return t_0 >> 4u; }`,
      ['f'],
    )
    expect(evaluate(out, 'f')(0)).toBe(0x8000000)
  })

  test('a float initializer still reads as a float', () => {
    const out = emit(
      `fn f_0( a_0 : f32) -> f32 { let t_0 = a_0 * 2.0f; return t_0 / 4.0f; }`,
      ['f'],
    )
    expect(out).not.toContain('Math.trunc')
    expect(evaluate(out, 'f')(3)).toBe(1.5)
  })

  test('an uninferable initializer refuses rather than assuming float', () => {
    // A module-scope `const` is skipped rather than parsed, so a local seeded
    // from one has no type the emitter can see. Guessing f32 would have made
    // the mask below a "bitwise op on a float" refusal — right answer, wrong
    // reason — and the divide case above emit silently.
    expect(() =>
      emit(
        `const K_0 : u32 = 4u;
         fn f_0( a_0 : u32) -> u32 { let t_0 = K_0; return t_0 >> 1u; }`,
        ['f'],
      ),
    ).toThrow(/signed/)
  })
})

// WGSL wraps integer arithmetic at the type's width and JS grows the number
// instead. Subtraction is the one that matters: it underflows at ordinary
// values, not at 2^32-scale ones.
describe('integer wraparound', () => {
  test('an unsigned difference wraps instead of going negative', () => {
    const out = emit(
      `fn f_0( a_0 : u32, b_0 : u32) -> u32 { return a_0 - b_0; }`,
      ['f'],
    )
    expect(evaluate(out, 'f')(1, 2)).toBe(4294967295)
    expect(evaluate(out, 'f')(7, 2)).toBe(5)
  })

  test('an unsigned sum stays in range', () => {
    const out = emit(`fn f_0( a_0 : u32) -> u32 { return a_0 + 1u; }`, ['f'])
    expect(evaluate(out, 'f')(0xffffffff)).toBe(0)
  })

  test('an integer product uses Math.imul, which a trailing mask cannot fix', () => {
    // The true product reaches 2^64 and loses its low bits in float64 before
    // any `>>> 0` could see them: 0x10001 * 0x10001 is 0x20001 as a u32, and
    // 4295098369 unwrapped.
    const out = emit(
      `fn f_0( a_0 : u32, b_0 : u32) -> u32 { return a_0 * b_0; }`,
      ['f'],
    )
    expect(out).toContain('Math.imul')
    expect(evaluate(out, 'f')(0x10001, 0x10001)).toBe(0x20001)
  })

  test('float arithmetic is untouched', () => {
    const out = emit(
      `fn f_0( a_0 : f32, b_0 : f32) -> f32 { return (a_0 - b_0) * 0.5f; }`,
      ['f'],
    )
    expect(out).not.toContain('>>>')
    expect(out).not.toContain('Math.imul')
    expect(evaluate(out, 'f')(1, 2)).toBe(-0.5)
  })
})

test('slangc’s scratch locals are renumbered per function', () => {
  // Their numbering comes from a counter slangc keeps across the whole module,
  // so an unrelated edit renumbers them in every twin lifted from it and the
  // generated diff shows churn in functions nobody touched.
  const out = emit(
    `fn f_0( a_0 : f32) -> f32 {
       var _S7 : f32;
       if((a_0 > 0.0f)) { _S7 = a_0; } else { _S7 = 0.0f; }
       return _S7;
     }`,
    ['f'],
  )
  expect(out).toContain('_t0')
  expect(out).not.toContain('_S7')
  expect(evaluate(out, 'f')(-2)).toBe(0)
})

test('refuses a local that would shadow an emitted helper', () => {
  // `let _clamp = _clamp(x, 0, 1)` is a TDZ throw, and renaming around it would
  // be the emitter guessing at a name the shader author chose.
  expect(() =>
    emit(
      `fn f_0( x_0 : f32) -> f32 { let _clamp = clamp(x_0, 0.0f, 1.0f); return _clamp; }`,
      ['f'],
    ),
  ).toThrow(/_clamp.*helper/s)
})

test('refuses one name declared twice with different types', () => {
  // The emitter's scope is flat where WGSL's is nested, so the second
  // declaration used to win and silently retype every earlier reference.
  expect(() =>
    emit(
      `fn f_0( c_0 : bool) -> f32 {
         var r_0 : f32;
         if(c_0) { var t_0 : u32; t_0 = 7u; r_0 = f32(t_0 / 2u); }
         else { var t_0 : f32; t_0 = 7.0f; r_0 = t_0 / 2.0f; }
         return r_0;
       }`,
      ['f'],
    ),
  ).toThrow(/declares 't_0' twice/)
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

// A builtin whose JS namesake is *nearly* right is the worst case: it emits,
// it reads correctly, and it disagrees only on inputs a test is unlikely to
// pick. `round` was in MATH_BUILTINS mapped to `Math.round` until this landed.
test('refuses round(), which JS and WGSL break ties on differently', () => {
  expect(() =>
    emit(`fn f_0( x_0 : f32) -> f32 { return round(x_0); }`, ['f']),
  ).toThrow(/round.*ties to EVEN.*floor\(x \+ 0\.5\)/s)
})

// The oracle cannot referee this one, and not because of its tolerance: slangc's
// C++ lowers `lerp` to `x + (y - x) * s` — the OTHER form — while the WGSL it
// hands the GPU is `mix()`, which is `a * (1 - t) + b * t`. So the differential
// check's reference implementation is on the wrong side of the question, and
// tightening `REL_TOLERANCE` would make a *correct* `_mix` fail rather than
// catch a wrong one. Nothing but a direct test can hold this.
test('mix returns b exactly at t=1, which the lerp form does not', () => {
  const out = emit(
    `fn f_0( a_0 : f32,  b_0 : f32,  t_0 : f32) -> f32 { return mix(a_0, b_0, t_0); }`,
    ['f'],
  )
  const mix = evaluate(out, 'f')
  // These two are the whole test. `a + (b - a) * t` returns 0.8999999999999999
  // and 0.09999999999999998 here — an ulp off b, which is what a consumer
  // quantizing into byte space rounds the wrong way.
  //
  // Pick a replacement pair by *checking* it discriminates, rather than by
  // eye: this test previously used (0.1, 0.3, 1), where both forms return 0.3
  // exactly, so it passed against the lerp form it exists to reject.
  expect(mix(0.2, 0.9, 1)).toBe(0.9)
  expect(mix(0.4, 0.1, 1)).toBe(0.1)
  // t=0 is exact in both forms (`a + anything * 0`), so this is a sanity check
  // on the endpoint, not a second discriminator.
  expect(mix(0.2, 0.9, 0)).toBe(0.2)
  // Ordinary interior blend, unchanged by the choice of form.
  expect(mix(0, 10, 0.25)).toBe(2.5)
})

// `pnpm check-shader-oracle` covers a translation rule only if some shader in
// the tree happens to call that builtin from a liftable function. Measured
// against the current tree, it reaches eight of the seventeen — `abs`, `clamp`,
// `floor`, `log2`, `max`, `min`, `smoothstep`, `sqrt` — and the other nine are
// translated by rules no differential check has ever run.
//
// That is not a fixable gap in the oracle: two of the nine (`mix`, `step`) are
// ones it *cannot* referee, because slangc's C++ target lowers them to different
// expressions than the WGSL it hands the GPU. So the floor has to be here, and
// the completeness assertion below is what keeps a tenth from being added
// silently — the failure mode this whole subset exists to rule out is a builtin
// whose JS namesake is nearly right, which is exactly what `round` was.
describe('every translated builtin, at inputs where a near-miss differs', () => {
  const call1 = (builtin: string) =>
    evaluate(
      emit(`fn f_0( x_0 : f32) -> f32 { return ${builtin}(x_0); }`, ['f']),
      'f',
    )
  const call2 = (builtin: string) =>
    evaluate(
      emit(
        `fn f_0( a_0 : f32,  b_0 : f32) -> f32 { return ${builtin}(a_0, b_0); }`,
        ['f'],
      ),
      'f',
    )
  const call3 = (builtin: string) =>
    evaluate(
      emit(
        `fn f_0( a_0 : f32,  b_0 : f32,  c_0 : f32) -> f32 { return ${builtin}(a_0, b_0, c_0); }`,
        ['f'],
      ),
      'f',
    )

  const CASES: { rule: string; check: () => void }[] = [
    {
      rule: 'abs',
      check: () => {
        const abs = call1('abs')
        expect(abs(-3.5)).toBe(3.5)
        expect(abs(3.5)).toBe(3.5)
      },
    },
    {
      rule: 'ceil',
      check: () => {
        const ceil = call1('ceil')
        // Negative is the half that separates ceil from "round away from zero".
        expect(ceil(-2.1)).toBe(-2)
        expect(ceil(2.1)).toBe(3)
        expect(ceil(2)).toBe(2)
      },
    },
    {
      rule: 'clamp',
      check: () => {
        const clamp = call3('clamp')
        expect(clamp(5, 0, 1)).toBe(1)
        expect(clamp(-5, 0, 1)).toBe(0)
        expect(clamp(0.25, 0, 1)).toBe(0.25)
      },
    },
    {
      rule: 'exp',
      check: () => {
        const exp = call1('exp')
        expect(exp(0)).toBe(1)
        expect(exp(1)).toBeCloseTo(Math.E, 12)
      },
    },
    {
      rule: 'floor',
      check: () => {
        const floor = call1('floor')
        // The pair that separates floor from trunc.
        expect(floor(-2.7)).toBe(-3)
        expect(floor(2.7)).toBe(2)
      },
    },
    {
      rule: 'fract',
      check: () => {
        const fract = call1('fract')
        expect(fract(2.25)).toBe(0.25)
        // WGSL's fract is `x - floor(x)`, so a negative input gives a POSITIVE
        // fraction. A `%`-based reading would answer -0.25 here.
        expect(fract(-0.25)).toBe(0.75)
        expect(fract(3)).toBe(0)
      },
    },
    {
      rule: 'log',
      check: () => {
        const log = call1('log')
        // 8 tells the three logarithms apart: 2.079 natural, 3 base-2,
        // 0.903 base-10.
        expect(log(8)).toBeCloseTo(Math.LN2 * 3, 12)
        expect(log(1)).toBe(0)
      },
    },
    {
      rule: 'log2',
      check: () => {
        const log2 = call1('log2')
        expect(log2(8)).toBe(3)
        expect(log2(1)).toBe(0)
      },
    },
    {
      rule: 'max',
      check: () => {
        const max = call2('max')
        expect(max(-3, 2)).toBe(2)
        expect(max(2, -3)).toBe(2)
      },
    },
    {
      rule: 'min',
      check: () => {
        const min = call2('min')
        expect(min(-3, 2)).toBe(-3)
        expect(min(2, -3)).toBe(-3)
      },
    },
    {
      rule: 'mix',
      check: () => {
        // The endpoint exactness that separates the two formulations has its
        // own test above; this is the ordinary blend.
        expect(call3('mix')(0, 10, 0.25)).toBe(2.5)
      },
    },
    {
      rule: 'pow',
      check: () => {
        const pow = call2('pow')
        expect(pow(2, 10)).toBe(1024)
        expect(pow(9, 0.5)).toBe(3)
      },
    },
    {
      rule: 'sign',
      check: () => {
        const sign = call1('sign')
        expect(sign(-3)).toBe(-1)
        expect(sign(3)).toBe(1)
        expect(sign(0)).toBe(0)
      },
    },
    {
      rule: 'smoothstep',
      check: () => {
        const ss = call3('smoothstep')
        // The Hermite curve, not the linear ramp: halfway is 0.5, but a
        // quarter of the way is 0.15625 rather than 0.25.
        expect(ss(0, 1, 0.5)).toBe(0.5)
        expect(ss(0, 1, 0.25)).toBe(0.15625)
        expect(ss(0, 1, -1)).toBe(0)
        expect(ss(0, 1, 2)).toBe(1)
      },
    },
    {
      rule: 'sqrt',
      check: () => {
        const sqrt = call1('sqrt')
        expect(sqrt(9)).toBe(3)
        expect(Number.isNaN(sqrt(-1))).toBe(true)
      },
    },
    {
      rule: 'step',
      check: () => {
        const step = call2('step')
        // Argument order is (edge, x), and the edge itself is inclusive.
        expect(step(1, 0)).toBe(0)
        expect(step(1, 1)).toBe(1)
        expect(step(1, 2)).toBe(1)
        // NaN is pinned rather than argued. The helper is `x < edge ? 0 : 1`,
        // which matches what slangc's `-target cpp` emits for `step`; the WGSL
        // spec has been published with both "1.0 if edge <= x" (NaN -> 0) and
        // "0.0 if x < edge" (NaN -> 1) phrasings, and gpuweb#4527 is about
        // exactly this class of under-specification. Nothing in the tree calls
        // `step`, so no shader depends on the answer — but a silent flip is
        // still worth catching.
        expect(step(1, Number.NaN)).toBe(1)
      },
    },
    {
      rule: 'trunc',
      check: () => {
        const trunc = call1('trunc')
        // The other half of the floor/trunc pair.
        expect(trunc(-2.7)).toBe(-2)
        expect(trunc(2.7)).toBe(2)
      },
    },
  ]

  test('the table above covers every rule the emitter has', () => {
    expect(CASES.map(c => c.rule).sort()).toStrictEqual([...TRANSLATION_RULES])
  })

  test.each(CASES.map(c => [c.rule, c.check] as const))(
    '%s',
    (_rule, check) => {
      check()
    },
  )
})

test('a bare hex literal is an integer, so it takes the truncating divide', () => {
  // Typing `0xff` off its trailing `f` made it an f32 and sent this down the
  // float path — WGSL truncates an integer quotient and JS does not.
  const out = emit(`fn f_0( n_0 : u32) -> u32 { return 0xff / u32(2); }`, ['f'])
  expect(out).toContain('Math.trunc')
  expect(evaluate(out, 'f')(0)).toBe(127)
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

// The emitter reads `Math` and `Boolean` off the global scope and binds every
// shader local by name, so a Slang identifier spelled like one of them shadows
// the thing the emitted body calls. JS also reserves words Slang does not.
// Both were caught only by `pnpm typecheck`, several steps downstream, as an
// error about a generated file the reader is told never to edit.
describe('names the emitted JS needs for something else', () => {
  const twin = (wgsl: string, name: string) =>
    emitJsTwins('t', wgsl, [name], [])

  test('refuses a local that shadows a global the body calls', () => {
    expect(() => {
      twin(
        'fn f_0(a_0 : f32) -> f32 { let Math : f32 = floor(a_0); return Math; }',
        'f_0',
      )
    }).toThrow(/Math is both a name this module binds/)
  })

  test('refuses a local JS will not let a binding use', () => {
    expect(() => {
      twin(
        'fn f_0(a_0 : f32) -> f32 { let new : f32 = a_0 * 2.0; return new; }',
        'f_0',
      )
    }).toThrow(/new is both a name this module binds/)
  })

  // A Slang name that merely resembles one is fine — the check is exact.
  test('leaves an ordinary name alone', () => {
    expect(
      twin(
        'fn f_0(a_0 : f32) -> f32 { let mathScale_0 : f32 = a_0 * 2.0; return mathScale_0; }',
        'f_0',
      ),
    ).toContain('let mathScale = (a * 2.0)')
  })
})

// The one non-scalar type in the subset, and it is return-only. A decision
// whose answer is a PAIR — the two screen-x edges a rect paints — is still
// scalar in every other respect, and the pair is what a Canvas2D rect fill is
// built from. Everything wider, and every other use of a vec2, stays refused:
// the value of the refusals is that they are exhaustive, so widening the subset
// by one shape means pinning the shapes next to it.
describe('a returned float2', () => {
  const PAIR =
    'fn span_0( a_0 : f32,  b_0 : f32) -> vec2<f32> {' +
    ' var lo_0 : f32 = floor(a_0 + 0.5f);' +
    ' return vec2<f32>(lo_0, floor(b_0 + 0.5f)); }'

  test('becomes a TS tuple', () => {
    const out = emit(PAIR, ['span'])
    expect(out).toContain(
      'export function span(a: number, b: number): [number, number]',
    )
    expect(out).toContain('return [lo, Math.floor((b + 0.5))]')
  })

  test('runs', () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const span = new Function(
      `${emit(PAIR, ['span'])
        .replaceAll(/^export function/gm, 'function')
        .replaceAll(/: \[number, number\]|: number/g, '')}\nreturn span`,
    )() as (a: number, b: number) => [number, number]
    expect(span(1.4, 9.6)).toStrictEqual([1, 10])
  })

  test('pulls a helper reached only from inside the pair', () => {
    const out = emit(
      'fn dbl_0( x_0 : f32) -> f32 { return x_0 * 2.0f; }' +
        'fn p_0( a_0 : f32) -> vec2<f32> { return vec2<f32>(a_0, dbl_0(a_0)); }',
      ['p'],
    )
    expect(out).toContain('function dbl(')
  })

  test('refuses a vec2 anywhere but a return', () => {
    expect(() => {
      emit(
        'fn p_0( a_0 : f32) -> f32 { var v_0 : f32 = vec2<f32>(a_0, a_0); return v_0; }',
        ['p'],
      )
    }).toThrow(/used somewhere other than as the whole of a 'return'/)
  })

  test('refuses a wider vector, by name', () => {
    expect(() => {
      emit(
        'fn p_0( a_0 : f32) -> vec3<f32> { return vec3<f32>(a_0, a_0, a_0); }',
        ['p'],
      )
    }).toThrow(/type 'vec3' is outside the supported scalar subset/)
  })

  test('refuses a vec2 of the wrong element type', () => {
    expect(() => {
      emit('fn p_0( a_0 : u32) -> vec2<u32> { return vec2<u32>(a_0, a_0); }', [
        'p',
      ])
    }).toThrow(/vec2 element type 'u32'/)
  })

  // Constructed from one scalar (a splat) or from another vector (a copy) —
  // both legal WGSL, neither modeled. Refused rather than assumed to be a pair.
  test('refuses a vec2 that is not two scalars', () => {
    expect(() => {
      emit('fn p_0( a_0 : f32) -> vec2<f32> { return vec2<f32>(a_0); }', ['p'])
    }).toThrow(/built from 1 component/)
  })

  // A vec2 PARAMETER stays out: it would need vector locals and swizzles to be
  // useful, which is the general vector support adr-051 leaves unproven.
  test('refuses a vec2 parameter', () => {
    expect(() => {
      emit('fn p_0( v_0 : vec2<f32>) -> f32 { return 1.0f; }', ['p'])
    }).toThrow(/type 'vec2' is outside the supported scalar subset/)
  })

  // The refusal has to name the builtin, not the vec2 that happens to be its
  // argument. `glyphEdgeAlpha` in pointGlyph.slang is exactly this shape —
  // `length(vec2<f32>(ddx(c), ddy(c)))` — and reporting it as a vec2 problem
  // sends the reader after a construct the emitter does support.
  test('blames the unsupported builtin, not its vec2 argument', () => {
    expect(() => {
      emit(
        'fn p_0( c_0 : f32) -> f32 { return length(vec2<f32>(dpdx(c_0), dpdy(c_0))); }',
        ['p'],
      )
    }).toThrow(/call to 'length'/)
  })
})
