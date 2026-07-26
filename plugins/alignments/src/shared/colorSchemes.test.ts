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

  test('canonical values pass through unchanged', () => {
    const colorBy = { type: 'tag', tag: 'HP' } as const
    expect(normalizeColorBy(colorBy)).toBe(colorBy)
  })

  test('every normalized type names a registered scheme', () => {
    for (const legacy of ['methylation', 'stranded'] as const) {
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
  })

  test('rejects anything the lookups would throw on', () => {
    expect(isRegisteredColorScheme({ type: 'notAScheme' })).toBe(false)
    expect(isRegisteredColorScheme({})).toBe(false)
    expect(isRegisteredColorScheme(undefined)).toBe(false)
    expect(isRegisteredColorScheme('strand')).toBe(false)
  })
})
