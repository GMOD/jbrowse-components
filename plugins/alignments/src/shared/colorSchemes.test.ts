import {
  COLOR_SCHEMES,
  isRegisteredColorScheme,
  normalizeColorBy,
} from './colorSchemes.ts'

// The retired names never reach live code: normalizeColorBy upgrades them in
// the model's colorBy getter, and every lookup keyed on ColorSchemeType
// (colorSchemeLabel, colorSchemeIndexFor) is total over the registry.
describe('normalizeColorBy', () => {
  test('the retired methylation scheme becomes modifications + fillUnmarked', () => {
    expect(
      normalizeColorBy({
        type: 'methylation',
        modifications: { cytosineContext: 'CHG' },
      }),
    ).toEqual({
      type: 'modifications',
      modifications: { cytosineContext: 'CHG', fillUnmarked: true },
    })
  })

  test('the retired stranded alias becomes firstOfPairStrand', () => {
    expect(normalizeColorBy({ type: 'stranded' })).toEqual({
      type: 'firstOfPairStrand',
    })
  })

  // Retired because it made the distinction it existed to draw harder to see: it
  // bucketed exactly as insertSize and only lerped the fill, and the two
  // endpoints were one hue apart, so two half-ramped reads on OPPOSITE sides of
  // the band both came out faintly-tinted grey.
  test('the retired insertSizeGradient becomes plain insertSize', () => {
    expect(normalizeColorBy({ type: 'insertSizeGradient' })).toEqual({
      type: 'insertSize',
    })
  })

  test('canonical values pass through unchanged', () => {
    const colorBy = { type: 'tag', tag: 'HP' } as const
    expect(normalizeColorBy(colorBy)).toBe(colorBy)
  })

  test('every normalized type names a registered scheme', () => {
    for (const legacy of [
      'methylation',
      'stranded',
      'insertSizeGradient',
    ] as const) {
      expect(Object.keys(COLOR_SCHEMES)).toContain(
        normalizeColorBy({ type: legacy }).type,
      )
    }
  })
})

describe('isRegisteredColorScheme', () => {
  test('accepts registered schemes and the retired names a session may hold', () => {
    expect(isRegisteredColorScheme({ type: 'insertSize' })).toBe(true)
    expect(isRegisteredColorScheme({ type: 'methylation' })).toBe(true)
    expect(isRegisteredColorScheme({ type: 'stranded' })).toBe(true)
    expect(isRegisteredColorScheme({ type: 'insertSizeGradient' })).toBe(true)
  })

  test('rejects anything the lookups would throw on', () => {
    expect(isRegisteredColorScheme({ type: 'notAScheme' })).toBe(false)
    expect(isRegisteredColorScheme({})).toBe(false)
    expect(isRegisteredColorScheme(undefined)).toBe(false)
    expect(isRegisteredColorScheme('strand')).toBe(false)
  })
})
