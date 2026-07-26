import {
  parseExportedConsts,
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
