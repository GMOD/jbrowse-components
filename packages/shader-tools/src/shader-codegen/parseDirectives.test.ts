import {
  parseExportedConsts,
  parseJsExports,
  parseLayoutOut,
  parseTargets,
  parseVertsPerInstance,
} from './parseDirectives.ts'

describe('parseVertsPerInstance', () => {
  test('reads a bare literal, with or without the u suffix', () => {
    expect(
      parseVertsPerInstance(
        'public static const uint VERTS_PER_INSTANCE = 6u;',
      ),
    ).toBe(6)
    expect(
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = 12;'),
    ).toBe(12)
  })

  test('resolves arithmetic over other static consts', () => {
    const src = [
      'public static const uint ARC_CURVE_SEGMENTS = 128u;',
      'public static const uint VERTS_PER_INSTANCE = (ARC_CURVE_SEGMENTS + 1u) * 2u;',
    ].join('\n')
    expect(parseVertsPerInstance(src)).toBe(258)
  })

  test('resolves a constant declared in an imported module', () => {
    // Before this, a pass wanting `CURVE_SEGMENTS * 6u` had to spell `48u` and
    // carry a SYNC comment, because only the shader's own text was searched.
    const module = 'public static const uint CURVE_SEGMENTS = 8u;'
    const shader =
      'public static const uint VERTS_PER_INSTANCE = CURVE_SEGMENTS * 6u;'
    expect(parseVertsPerInstance(shader, [module])).toBe(48)
    expect(() => parseVertsPerInstance(shader)).toThrow(
      /unknown identifier CURVE_SEGMENTS/,
    )
  })

  test('the shader’s own declaration shadows the imported one', () => {
    const module = 'public static const uint N = 8u;'
    const shader = [
      'static const uint N = 3u;',
      'static const uint VERTS_PER_INSTANCE = N * 2u;',
    ].join('\n')
    expect(parseVertsPerInstance(shader, [module])).toBe(6)
  })

  test('undefined when the shader declares none', () => {
    expect(parseVertsPerInstance('static const float X = 1.0;')).toBeUndefined()
  })

  test('throws on an unknown identifier rather than emitting a bad count', () => {
    expect(() =>
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = N * 2u;'),
    ).toThrow(/unknown identifier N/)
  })

  test('throws on a circular reference', () => {
    const src = [
      'static const uint A = B;',
      'static const uint B = A;',
      'static const uint VERTS_PER_INSTANCE = A;',
    ].join('\n')
    expect(() => parseVertsPerInstance(src)).toThrow(/circular/)
  })

  test('rejects a non-positive or fractional count', () => {
    expect(() =>
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = 6 - 6;'),
    ).toThrow(/positive integer/)
    expect(() =>
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = 7 / 2;'),
    ).toThrow(/positive integer/)
  })
})

describe('parseExportedConsts', () => {
  const src = [
    '//! export-consts: CHEVRON_PX, CS_NORMAL, HALF',
    'static const float CHEVRON_PX = 8.0;',
    'static const int CS_NORMAL = 0;',
    'static const float FULL = 1.0;',
    'static const float HALF = FULL * 0.5;',
    'static const float UNEXPORTED = 3.0;',
  ].join('\n')

  test('emits only the named consts', () => {
    expect(parseExportedConsts(src)).toEqual({
      CHEVRON_PX: 8,
      CS_NORMAL: 0,
      HALF: 0.5,
    })
  })

  test('undefined when there is no directive', () => {
    expect(
      parseExportedConsts('static const float CHEVRON_PX = 8.0;'),
    ).toBeUndefined()
  })

  // Regression: these used to run through parseFloat, so a computed const
  // silently exported NaN and a misspelled name silently exported nothing.
  test('resolves a computed const instead of exporting NaN', () => {
    const computed = [
      '//! export-consts: TOTAL',
      'static const float PART = 4.0;',
      'static const float TOTAL = PART * 2.0;',
    ].join('\n')
    expect(parseExportedConsts(computed)).toEqual({ TOTAL: 8 })
  })

  // A scheme bitmask (`(1 << CS_A) | (1 << CS_B)`) is a real shape here; JS and
  // Slang agree on 32-bit bitwise ops, and parseFloat used to make it NaN.
  test('evaluates a bitmask built from other consts', () => {
    const mask = [
      '//! export-consts: MASK',
      'static const int A = 3;',
      'static const int B = 5;',
      'static const int MASK = (1 << A) | (1 << B);',
    ].join('\n')
    expect(parseExportedConsts(mask)).toEqual({ MASK: 0b101000 })
  })

  // A u32 sentinel is spelled in hex, and the evaluator used to see `0` as the
  // number and `xffffffffu` as an unresolvable identifier — so the one constant
  // form a "larger than any real value" marker needs was the one form that
  // could not be exported.
  test('evaluates a hex literal, with or without the u suffix', () => {
    const hex = [
      '//! export-consts: SENTINEL, MASK, HALF_MASK',
      'static const uint SENTINEL = 0xffffffffu;',
      'static const uint MASK = 0xFF;',
      'static const uint HALF_MASK = 0x0Fu | 0xF0u;',
    ].join('\n')
    expect(parseExportedConsts(hex)).toEqual({
      SENTINEL: 4294967295,
      MASK: 255,
      HALF_MASK: 255,
    })
  })

  test('throws when a named const does not exist', () => {
    expect(() =>
      parseExportedConsts(
        '//! export-consts: TYPOED\nstatic const float A = 1.0;',
      ),
    ).toThrow(/no such 'static const'.*TYPOED/)
  })
})

describe('parseTargets', () => {
  test('defaults to both backends', () => {
    expect(parseTargets('// no directive')).toEqual(['wgsl', 'glsl'])
  })

  test('reads an explicit list', () => {
    expect(parseTargets('//! targets: wgsl')).toEqual(['wgsl'])
    expect(parseTargets('//! targets: wgsl, glsl')).toEqual(['wgsl', 'glsl'])
  })

  // Previously an unrecognized name was filtered out silently, so `//! targets:
  // wgsl, metal` looked accepted and `//! targets: wsgl` emitted nothing at all.
  test('throws on an unrecognized target', () => {
    expect(() => parseTargets('//! targets: wgsl, metal')).toThrow(/metal/)
    expect(() => parseTargets('//! targets: wsgl')).toThrow(/wsgl/)
  })
})

describe('parseJsExports', () => {
  const OWN = [
    '//! js-export: ownFn',
    'float ownFn(float x) {',
    '  return x;',
    '}',
  ].join('\n')

  test('reads a function declared in the shader itself', () => {
    expect(parseJsExports(OWN)).toEqual([
      { name: 'ownFn', returnType: 'float', paramTypes: ['float'] },
    ])
  })

  test('resolves a function declared in an imported module', () => {
    // A decision authored in a shared module, lifted by the pass that draws
    // with it — which is how it reaches a package the module's own plugin
    // cannot write into (adr-051). Only offered to shaders with entry points:
    // a module's export goes through a synthesized wrapper that imports one
    // module, and Slang does not re-export a grandparent's symbols.
    const module =
      'public float bandPx(float h, float inset) {\n  return h - inset;\n}'
    const shader =
      '//! js-export: bandPx\n[shader("vertex")] float4 vs_main() { return bandPx(1.0, 2.0); }'
    expect(parseJsExports(shader, [module])).toEqual([
      { name: 'bandPx', returnType: 'float', paramTypes: ['float', 'float'] },
    ])
  })

  test('without the imported sources it reports why the name is out of scope', () => {
    const shader =
      '//! js-export: bandPx\nfloat other(float x) {\n  return x;\n}'
    expect(() => parseJsExports(shader)).toThrow(/synthesized wrapper/)
    expect(() => parseJsExports(shader)).toThrow(/Declared: other/)
  })

  test('the shader’s own declaration shadows the imported one', () => {
    const module = 'public float f(float a, float b) {\n  return a;\n}'
    const shader = '//! js-export: f\nfloat f(float a) {\n  return a;\n}'
    expect(parseJsExports(shader, [module])![0]!.paramTypes).toEqual(['float'])
  })

  test('a non-scalar signature is refused by name and type', () => {
    const module = 'public float3 shade(float4 c) {\n  return c.xyz;\n}'
    const shader = '//! js-export: shade\nfloat4 vs_main() { return shade(c); }'
    expect(() => parseJsExports(shader, [module])).toThrow(/shade/)
    expect(() => parseJsExports(shader, [module])).toThrow(/float3|float4/)
  })
})

describe('parseLayoutOut', () => {
  test('reads the repo-relative path', () => {
    expect(
      parseLayoutOut('//! layout-out: packages/x/src/y.generated.ts'),
    ).toBe('packages/x/src/y.generated.ts')
  })

  test('undefined when absent', () => {
    expect(parseLayoutOut('//! targets: wgsl')).toBeUndefined()
  })
})
