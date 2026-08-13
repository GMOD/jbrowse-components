import {
  assertOutPathsUnique,
  parseBlend,
  parseExportedConsts,
  parseJsExports,
  parseOutPath,
  OUT_DIRECTIVES,
  parseTargets,
  parseTopology,
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

  // These files carry long block comments explaining superseded math, and a
  // `static const` inside one reads exactly like a live declaration to a regex.
  // The line-comment form defends itself (the pattern anchors at `^\s*`), which
  // is why only the block form was a hole.
  test('ignores a declaration that only exists inside a comment', () => {
    const src = [
      '/*',
      'static const uint VERTS_PER_INSTANCE = 99u;',
      '*/',
      'static const uint VERTS_PER_INSTANCE = 6u;',
    ].join('\n')
    expect(parseVertsPerInstance(src)).toBe(6)
    expect(
      parseVertsPerInstance('/* static const uint VERTS_PER_INSTANCE = 4u; */'),
    ).toBeUndefined()
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

  test('rejects a non-positive count', () => {
    expect(() =>
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = 6 - 6;'),
    ).toThrow(/positive integer/)
  })

  // A fractional count is caught one step earlier now, by the integer-division
  // refusal — the count is `uint`, so `7 / 2` never gets as far as being a
  // non-integer. Still a build failure, with the more specific message.
  test('rejects a divided count as an integer division', () => {
    expect(() =>
      parseVertsPerInstance('static const uint VERTS_PER_INSTANCE = 7 / 2;'),
    ).toThrow(/truncates an integer quotient/)
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

  // The declared type used to be dropped in a non-capturing group, so every
  // constant was evaluated and emitted as a float64. JS's bitwise operators are
  // signed int32, so a `uint` whose value reaches bit 31 came out NEGATIVE —
  // silently, in exactly the flag/mask/sentinel constants that reach it. The
  // shader-side spelling `(1 << CS_A) | (1 << CS_B)` is the one the file's own
  // comment anticipates.
  describe('applies the declared Slang type', () => {
    const evalConst = (decl: string) =>
      parseExportedConsts(`//! export-consts: X\n${decl}`)!.X

    test('a uint reaching bit 31 stays unsigned', () => {
      expect(evalConst('static const uint X = 1u << 31;')).toBe(2147483648)
      expect(evalConst('static const uint X = ~0u;')).toBe(4294967295)
      expect(
        evalConst(
          'static const uint A = 30u;\n' +
            'static const uint B = 31u;\n' +
            'static const uint X = (1u << A) | (1u << B);',
        ),
      ).toBe(3221225472)
    })

    test('uint arithmetic wraps the way Slang wraps', () => {
      expect(evalConst('static const uint X = 0u - 1u;')).toBe(4294967295)
      expect(evalConst('static const uint X = 65536u * 65536u;')).toBe(0)
    })

    test('an int stays signed', () => {
      expect(evalConst('static const int X = 0 - 1;')).toBe(-1)
    })

    test('a float is left alone', () => {
      expect(evalConst('static const float X = 1.0 - 3.0;')).toBe(-2)
    })

    // A negative intermediate that has been divided cannot be reinterpreted
    // back, so this is refused rather than narrowed after the fact.
    test('refuses integer division instead of doing float division', () => {
      expect(() => evalConst('static const uint X = 7u / 2u;')).toThrow(
        /truncates an integer quotient/,
      )
      expect(() => evalConst('static const int X = -7 % 2;')).toThrow(
        /truncates an integer quotient/,
      )
    })

    // A `uint` referenced from a `float` expression is narrowed at the point of
    // substitution, not at the end — otherwise the reference would arrive
    // signed and poison an expression whose own type can't fix it.
    test('narrows a referenced const to its own declared type', () => {
      expect(
        evalConst(
          'static const uint MASK = ~0u;\n' +
            'static const float X = MASK + 0.0;',
        ),
      ).toBe(4294967295)
    })
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

  // Third literal form the evaluator could not read, after hex. Both letters
  // reached the identifier pass as unresolvable names — `0.5f` reported
  // "references unknown identifier f", and the arithmetic allow-list already
  // permitted an `e` it could never actually be handed.
  test('evaluates float suffixes and scientific notation', () => {
    const src = [
      '//! export-consts: HALF, EPS, SCALED, HUGE_SPAN',
      'static const float HALF = 0.5f;',
      'static const float EPS = 1e-6;',
      'static const float SCALED = EPS * 2.0f;',
      'static const float HUGE_SPAN = 1.5E+3;',
    ].join('\n')
    expect(parseExportedConsts(src)).toEqual({
      HALF: 0.5,
      EPS: 1e-6,
      SCALED: 2e-6,
      HUGE_SPAN: 1500,
    })
  })

  // The suffix strip anchors at the start of a number, so it cannot reach into
  // an identifier that merely ends in one.
  test('does not clip a constant whose name ends in a digit-plus-suffix', () => {
    const src = [
      '//! export-consts: DOUBLED',
      'static const uint X1 = 4u;',
      'static const uint DOUBLED = X1 * 2u;',
    ].join('\n')
    expect(parseExportedConsts(src)).toEqual({ DOUBLED: 8 })
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

describe('parseTopology / parseBlend', () => {
  // Absent is not 'the default spelled out' — it means the shader declines to
  // say, and the pass falls through to whatever the HAL defaults to. Emitting a
  // TOPOLOGY for every shader would make every pass inherit one, which is wrong
  // for the shaders drawn two ways.
  test('undefined when the shader declares neither', () => {
    expect(parseTopology('// no directive')).toBeUndefined()
    expect(parseBlend('// no directive')).toBeUndefined()
  })

  test('reads a declared value', () => {
    expect(parseTopology('//! topology: triangle-strip')).toBe('triangle-strip')
    expect(parseTopology('//! topology: line-list')).toBe('line-list')
    expect(parseBlend('//! blend: premultiplied')).toBe('premultiplied')
    expect(parseBlend('//! blend: max')).toBe('max')
  })

  // The whole point of a closed set: a typo that fell through as `undefined`
  // would draw with the default silently, which for `triangle-strip` is a
  // completely different picture rather than an error.
  test('throws on an unrecognized value, naming the alternatives', () => {
    expect(() => parseTopology('//! topology: triangle_strip')).toThrow(
      /triangle_strip.*triangle-list, triangle-strip, line-list/s,
    )
    expect(() => parseBlend('//! blend: one, one-minus-src-alpha')).toThrow(
      /straight, premultiplied, max/,
    )
  })

  // `none` is deliberately not a mode — see the comment on BLEND_MODES.
  test('rejects blend: none rather than emitting an unconsumed disable', () => {
    expect(() => parseBlend('//! blend: none')).toThrow(/none/)
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

  // A commented-out function is not compiled, so slangc emits no body for it
  // and the twin emitter would have nothing to lift — but the name would sit in
  // the "Declared:" list a typo prints, pointing at a function that isn't there.
  // Worse for an import: the module's copy is scanned first, so a stale one
  // inside a block comment would be shadowed only by luck of ordering.
  test('does not see a function declared inside a block comment', () => {
    const src = [
      '//! js-export: ownFn',
      '/*',
      'float ownFn(float x) {',
      '  return x * 2.0;',
      '}',
      '*/',
    ].join('\n')
    expect(() => parseJsExports(src)).toThrow(/no such 'public' function/)
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

describe('parseOutPath', () => {
  test.each(OUT_DIRECTIVES)('reads the repo-relative %s-out path', kind => {
    expect(
      parseOutPath(`//! ${kind}-out: packages/x/src/y.generated.ts`, kind),
    ).toBe('packages/x/src/y.generated.ts')
  })

  test('undefined when absent', () => {
    expect(parseOutPath('//! targets: wgsl', 'layout')).toBeUndefined()
  })

  // The kinds are one list because `assertOutPathsUnique` has to enumerate
  // them: a fourth directive added as its own parser would work and silently
  // not be collision-checked.
  test('one directive does not answer for another', () => {
    expect(parseOutPath('//! layout-out: a.ts', 'consts')).toBeUndefined()
    // `js-export-out` vs `export-consts` share the word `export`; the kind is
    // anchored, so neither reads the other's line.
    expect(parseOutPath('//! js-export-out: a.ts', 'consts')).toBeUndefined()
  })
})

// Every `*-out` directive redirects a generated artifact to a path outside the
// shader's own directory, and nothing about the path says which shader owns it.
// Two shaders claiming one path used to be last-writer-wins in scan order —
// wrong, but repeatably wrong; with the files compiling concurrently it becomes
// a race, so it has to be refused rather than merely deplored.
describe('assertOutPathsUnique', () => {
  const file = (path: string, source: string) => ({ path, source })

  test('accepts distinct out paths, including several from one shader', () => {
    expect(() => {
      assertOutPathsUnique([
        file(
          'a.slang',
          [
            '//! layout-out: pkg/a.layout.generated.ts',
            '//! consts-out: pkg/a.consts.generated.ts',
          ].join('\n'),
        ),
        file('b.slang', '//! layout-out: pkg/b.layout.generated.ts'),
        file('c.slang', '// no directives here'),
      ])
    }).not.toThrow()
  })

  test('refuses two shaders writing one path, naming both', () => {
    expect(() => {
      assertOutPathsUnique([
        file('a.slang', '//! consts-out: pkg/shared.generated.ts'),
        file('b.slang', '//! consts-out: pkg/shared.generated.ts'),
      ])
    }).toThrow(
      /pkg\/shared\.generated\.ts is written by two shaders: a\.slang and b\.slang/,
    )
  })

  // The three directives write the same kind of artifact to the same kind of
  // place, so the collision is across all of them, not per-directive.
  test('refuses a collision between two different directives', () => {
    expect(() => {
      assertOutPathsUnique([
        file('a.slang', '//! layout-out: pkg/shared.generated.ts'),
        file('b.slang', '//! js-export-out: pkg/shared.generated.ts'),
      ])
    }).toThrow(/written by two shaders/)
  })
})
