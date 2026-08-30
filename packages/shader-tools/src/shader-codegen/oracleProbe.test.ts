import {
  agrees,
  buildOracleMain,
  buildProbeEntry,
  resolveCppName,
  stripEntryPoints,
} from './oracleProbe.ts'

import type { JsExportFn } from './parseDirectives.ts'

// The oracle's whole value is that it is a SECOND implementation, generated
// rather than written. These tests cover the places that could quietly make it
// stop being one — comparing the wrong function, or reporting arguments the
// call never received.

const fn = (
  name: string,
  paramTypes: string[],
  returnType = 'float',
): JsExportFn => ({ name, paramTypes, returnType })

describe('stripEntryPoints', () => {
  test('removes a stage function whole, braces and all', () => {
    // `-target cpp` segfaults on a vertex entry, so this cut is what makes the
    // oracle work on a shader rather than only on a module.
    const out = stripEntryPoints(
      'float keep(float x) { return x; }\n' +
        '[shader("vertex")]\n' +
        'VsOut vs_main(uint vid) {\n' +
        '  if (vid > 0u) { return a(); }\n' +
        '  return b();\n' +
        '}\n' +
        'float alsoKeep(float y) { return y; }\n',
    )
    expect(out).toContain('float keep(')
    expect(out).toContain('float alsoKeep(')
    expect(out).not.toContain('vs_main')
    // A nested block must not end the cut early — a stray `}` would be reported
    // by slangc as an error in the appended probe, pointing at the wrong thing.
    expect(out).not.toContain('return b();')
  })

  test('removes several stages', () => {
    const out = stripEntryPoints(
      '[shader("vertex")]\nvoid v() { {} }\n' +
        'float keep(float x) { return x; }\n' +
        '[shader("fragment")]\nvoid f() { {} }\n',
    )
    expect(out).toContain('float keep(')
    expect(out).not.toContain('void v(')
    expect(out).not.toContain('void f(')
  })

  test('drops the module declaration, since a module may not host an entry', () => {
    expect(
      stripEntryPoints('module hpmath;\nfloat f() { return 1.0; }'),
    ).not.toContain('module hpmath')
  })
})

describe('resolveCppName', () => {
  const cpp = [
    'float snapBoxHeightPx_0(float heightPx_0)',
    '{',
    '    return heightPx_0;',
    '}',
    'Vector<float, 2>  rectSpanPx_3(float a_0, float b_0, bool c_0)',
    '{',
    '}',
  ].join('\n')

  test('finds a scalar and a vector-returning function', () => {
    expect(resolveCppName(cpp, 'snapBoxHeightPx')).toBe('snapBoxHeightPx_0')
    expect(resolveCppName(cpp, 'rectSpanPx')).toBe('rectSpanPx_3')
  })

  // Resolved from the C++ rather than reused from the WGSL resolution: the
  // suffix is a counter over everything slangc declared for that target, and
  // the two targets do not declare the same set. Guessing would compare a
  // function against a different function and call it agreement.
  test('refuses a name it cannot find', () => {
    expect(() => resolveCppName(cpp, 'notThere')).toThrow(
      /not in the emitted C\+\+/,
    )
  })

  test('refuses an ambiguous name rather than picking one', () => {
    expect(() =>
      resolveCppName(
        `${cpp}\nfloat rectSpanPx_9(float q_0)\n{\n}`,
        'rectSpanPx',
      ),
    ).toThrow(/ambiguous/)
  })
})

describe('buildProbeEntry', () => {
  test('references every export, so Slang keeps them all', () => {
    const src = buildProbeEntry([
      fn('a', ['float']),
      fn('b', ['uint', 'bool'], 'bool'),
      fn('c', ['float', 'float', 'bool'], 'float2'),
    ])
    expect(src).toContain('a(float(tid.x))')
    expect(src).toContain('b(tid.x, tid.x != 0u)')
    // A float2 has to be narrowed to reach the float sink; any lane will do,
    // since the probe's own value is discarded.
    expect(src).toContain('(c(float(tid.x), float(tid.x), tid.x != 0u)).x')
    expect(src).toContain('[shader("compute")]')
  })
})

describe('buildOracleMain', () => {
  const names = new Map([['f', 'f_0']])

  test('binds each argument once, then prints and passes the same value', () => {
    // Drawing inline at both the print and the call would advance the generator
    // in between, so every row would describe inputs the call never saw — and
    // the check would fail everywhere for a reason that looks like a codegen
    // bug.
    const src = buildOracleMain([fn('f', ['float', 'float'])], names, 3)
    expect(src).toContain('float a0 = pool_f_0[')
    expect(src).toContain('float a1 = pool_f_1[')
    expect(src).toContain('emit(double(a0));')
    expect(src).toContain('f_0(a0, a1)')
    // Two draw sites for two parameters — not three, which is what an inline
    // redraw at the call would give. (`oracleNext() %` rather than the bare
    // call, so the generator's own definition is not counted.)
    expect(src.match(/oracleNext\(\) %/g)).toHaveLength(2)
  })

  test('emits float pool literals C++ will accept', () => {
    // `0f` and `255f` are not valid C++ — a float suffix needs a fractional
    // part. The pools are mostly whole numbers, so this was every literal.
    const src = buildOracleMain([fn('f', ['float'])], names, 1)
    expect(src).toContain('0.0f')
    expect(src).not.toMatch(/[^.\d]\d+f/)
  })

  test('avoids the int literal that does not fit an int', () => {
    // `-2147483648` parses as unary minus applied to 2147483648, which is not
    // representable as an int, so the compiler widens it and warns.
    const src = buildOracleMain([fn('f', ['int'])], names, 1)
    expect(src).toContain('(-2147483647 - 1)')
  })

  test('prints both lanes of a float2 rather than a summary', () => {
    const src = buildOracleMain([fn('f', ['float'], 'float2')], names, 1)
    expect(src).toContain('emit(v.x); emit(v.y);')
  })

  test('prints a bool as 0/1 on both sides of the call', () => {
    const src = buildOracleMain([fn('f', ['bool'], 'bool')], names, 1)
    expect(src).toContain('bool a0 = pool_f_0[')
    expect(src).toContain('emit(a0 ? 1 : 0);')
    expect(src).toContain('emit(double(f_0(a0) ? 1 : 0));')
  })
})

// The float32 oracle and the float64 twin start from inputs both represent
// exactly, but nothing keeps their INTERMEDIATES exact, and an operation that
// drops the magnitude leaves the difference sitting on a small result. These
// are `hueRampLane(65536, lane)`'s real numbers, which failed the sweep while
// the shader and the emitter were both correct.
describe('agrees admits the rounding an input magnitude carries', () => {
  const CPP = 0.38336181640625
  const JS = 0.38333333333332575

  test('a large float argument widens the slack onto a small result', () => {
    expect(agrees(JS, CPP, [65536])).toBe(true)
  })

  test('and the result alone does not — this is what the sweep was reading', () => {
    expect(agrees(JS, CPP)).toBe(false)
  })

  test('the widening tracks the magnitude rather than switching on at one', () => {
    // 1024 is the pool's next magnitude down and needs none of it: the same
    // arithmetic there lands 64x closer, inside the plain relative tolerance.
    const hp = (1024 / 360) * 6
    const f32 = Math.fround(Math.fround(Math.fround(1024 / 360) * 6))
    const near = (h: number) => 0.5 * (1 - Math.abs((h % 2) - 1)) + 0.25
    expect(Math.abs(near(hp) - near(f32))).toBeLessThan(1e-5)
    expect(agrees(near(hp), near(f32))).toBe(true)
  })

  test('a whole-unit mistranslation still fails at the widest input', () => {
    // The sabotage the tolerance exists to catch, at the magnitude that buys
    // the most slack: 65536 * 2^-24 is 3.9e-3, still 250x under one unit.
    expect(agrees(JS, CPP + 1, [65536])).toBe(false)
    expect(agrees(0, 1, [65536])).toBe(false)
    expect(agrees(0.5, 0.51, [65536])).toBe(false)
  })

  test('no float argument is the plain relative tolerance', () => {
    // Which is how an integer parameter buys no slack: `check-oracle.ts` passes
    // the float-typed arguments and drops the rest, so a function of `uint`
    // alone arrives here with an empty list. That filter is the call site's,
    // not this function's — UINT_POOL reaches 4294967295, and folding one in
    // would put the slack at 256 and referee nothing.
    expect(agrees(JS, CPP, [])).toBe(false)
    expect(agrees(0, 1)).toBe(false)
  })

  test('exact equality and NaN agreement are unchanged', () => {
    expect(agrees(0, -0, [65536])).toBe(true)
    expect(agrees(Number.NaN, Number.NaN)).toBe(true)
    expect(agrees(Number.NaN, 0, [65536])).toBe(false)
    expect(agrees(Infinity, Infinity)).toBe(true)
  })

  test('a non-finite float argument does not widen the slack to everything', () => {
    expect(agrees(0, 1, [Infinity])).toBe(false)
    expect(agrees(0, 1, [Number.NaN])).toBe(false)
  })
})
