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

// `dataFill` used to be a set of three shader indices, so a scheme riding one of
// those paths inherited it — `mateRefName` and `bisulfite` declared nothing and
// got it free. Per-scheme is the right granularity, and it is what fixed the two
// per-base schemes that ride `normal`, but it means those two now carry a
// hand-written flag with nothing checking it: deleting both leaves the whole
// plugin green, including the test that gates on it, because that test reads the
// same flag on both sides.
//
// So this asserts the half the projection really did guarantee. A scheme on one
// of these paths resolves one colour per read on the CPU — `shared/types.ts`
// invites new ones onto `tag` — and without the flag the chain-strand framing
// repaints its whole body forward-red / reverse-blue on every unpaired split
// read in chain mode, which is the bug this flag exists to prevent.
test('a scheme on a per-read-colour shader path declares dataFill', () => {
  const dataFillPaths = new Set(['mappingQuality', 'tag', 'modifications'])
  expect(
    Object.values(COLOR_SCHEMES)
      .filter(s => dataFillPaths.has(s.shaderScheme) && !s.dataFill)
      .map(s => s.type),
  ).toEqual([])
})
