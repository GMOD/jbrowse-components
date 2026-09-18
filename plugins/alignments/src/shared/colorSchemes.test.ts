import {
  COLOR_SCHEMES,
  isDataFillScheme,
  normalizeColorBy,
  workerColorBy,
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

test('an unknown colorBy falls back to plain coloring rather than reaching a lookup that throws', () => {
  for (const value of [
    { type: 'perBaseLettering' },
    { type: 'toString' },
    {},
    undefined,
    'strand',
  ]) {
    const colorBy = normalizeColorBy(value)
    expect(colorBy).toEqual({ type: 'normal' })
    expect(() => workerColorBy(colorBy)).not.toThrow()
  }
})

// Spelled out rather than re-derived, because the derivation is what is under
// test: without it the chain-strand framing repaints one of these schemes' whole
// read body forward-red / reverse-blue on every unpaired split read in chain
// mode. A scheme added to the `tag` shader path (`shared/types.ts` invites them)
// joins the list for free; one riding `normal` has to earn it with `perBase`.
test('the schemes whose fill is the datum hold off chain-strand framing', () => {
  expect(
    Object.values(COLOR_SCHEMES)
      .filter(s => isDataFillScheme(s.type))
      .map(s => s.type),
  ).toEqual([
    'mappingQuality',
    'perBaseQuality',
    'perBaseLetter',
    'tag',
    'mateRefName',
    'modifications',
    'bisulfite',
  ])
})
