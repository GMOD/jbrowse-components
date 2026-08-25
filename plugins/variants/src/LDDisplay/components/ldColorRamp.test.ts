import {
  generateLDColorRamp,
  ldMetricLabel,
  ldValueText,
  mapLDValue,
} from './ldColorRamp.ts'

// The pixels themselves, at five points across each metric+sign combination.
// The stop tables and the shared interpolation
// (`@jbrowse/core/util/colorRamp`, which the hic ramp builds through too) can
// both be edited without any other test here noticing: these entries are what
// says the matrix still paints the colors it painted, byte for byte.
test.each([
  [
    'r2',
    false,
    [
      [255, 255, 255, 255],
      [255, 200, 200, 255],
      [255, 95, 95, 255],
      [242, 0, 0, 255],
      [160, 0, 0, 255],
    ],
  ],
  [
    'r2',
    true,
    [
      [0, 0, 160, 255],
      [97, 97, 255, 255],
      [255, 254, 254, 255],
      [255, 93, 93, 255],
      [160, 0, 0, 255],
    ],
  ],
  [
    'dprime',
    false,
    [
      [255, 255, 255, 255],
      [200, 200, 255, 255],
      [95, 95, 255, 255],
      [0, 0, 242, 255],
      [0, 0, 160, 255],
    ],
  ],
  [
    'dprime',
    true,
    [
      [0, 100, 0, 255],
      [97, 208, 97, 255],
      [254, 254, 255, 255],
      [93, 93, 255, 255],
      [0, 0, 160, 255],
    ],
  ],
])('%s signed=%s paints these bytes', (metric, signedLD, expected) => {
  const ramp = generateLDColorRamp(metric, signedLD)
  expect(ramp).toHaveLength(256 * 4)
  expect(
    [0, 64, 128, 192, 255].map(i => [...ramp.slice(i * 4, i * 4 + 4)]),
  ).toEqual(expected)
})

// Every LD ramp is opaque, unlike hic's juicebox fade: the shared builder
// interpolates alpha, and these tables hand it 255 at every stop.
test('every entry of every ramp is opaque', () => {
  for (const metric of ['r2', 'dprime']) {
    for (const signedLD of [false, true]) {
      const ramp = generateLDColorRamp(metric, signedLD)
      for (let i = 0; i < 256; i++) {
        expect(ramp[i * 4 + 3]).toBe(255)
      }
    }
  }
})

// A signed metric puts 0 in the middle of the ramp, which is what makes the
// white band the sign change rather than the low end.
test('mapLDValue centers a signed value and clamps both forms', () => {
  expect(mapLDValue(0, true)).toBe(0.5)
  expect(mapLDValue(-1, true)).toBe(0)
  expect(mapLDValue(1, true)).toBe(1)
  expect(mapLDValue(0, false)).toBe(0)
  expect(mapLDValue(2, false)).toBe(1)
})

test('the label says what the number is', () => {
  expect(ldMetricLabel('r2', false)).toBe('R²')
  expect(ldMetricLabel('r2', true)).toBe('R')
  expect(ldMetricLabel('dprime', false)).toBe("D'")
  expect(ldMetricLabel('dprime', true)).toBe("D'")
})

// A composite D' of exactly ±1 is the clamp, not a measurement: the raw ratio
// reaches 1.6053 where the phased estimator reads 0.8385 on the same pair
// (`packages/ld-core/src/compositeDprimeClamp.test.ts`), so what the cell holds
// is a bound rather than a value. Nothing else printed here is a bound.
describe('ldValueText', () => {
  test('marks a saturated composite D-prime as a bound', () => {
    expect(ldValueText(1, 'dprime', 'composite')).toBe(
      '≥ 1 (composite estimate saturated)',
    )
    expect(ldValueText(-1, 'dprime', 'composite')).toBe(
      '≤ -1 (composite estimate saturated)',
    )
  })

  test('prints every other value plainly', () => {
    // haplotypic D cannot exceed Dmax, so there a 1 is a 1
    expect(ldValueText(1, 'dprime', 'phased')).toBe('1.000')
    expect(ldValueText(1, 'dprime', 'precomputed')).toBe('1.000')
    // and r²'s clamp catches float noise, not a saturating estimator
    expect(ldValueText(1, 'r2', 'composite')).toBe('1.000')
    expect(ldValueText(0.9999, 'dprime', 'composite')).toBe('1.000')
    expect(ldValueText(0.123456, 'r2', 'composite')).toBe('0.123')
    expect(ldValueText(0, 'dprime', 'composite')).toBe('0.000')
  })
})
