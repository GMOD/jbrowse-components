import {
  generateLDColorRamp,
  ldMetricLabel,
  ldValueText,
  mapLDValue,
} from './ldColorRamp.ts'

// The pixels themselves, at five points across each metric. The stop tables and
// the shared interpolation (`@jbrowse/core/util/colorRamp`, which the hic ramp
// builds through too) can both be edited without any other test here noticing:
// these entries are what says the matrix still paints the colors it painted,
// byte for byte.
test.each([
  [
    'r2',
    [
      [255, 255, 255, 255],
      [255, 200, 200, 255],
      [255, 95, 95, 255],
      [242, 0, 0, 255],
      [160, 0, 0, 255],
    ],
  ],
  [
    'dprime',
    [
      [255, 255, 255, 255],
      [200, 200, 255, 255],
      [95, 95, 255, 255],
      [0, 0, 242, 255],
      [0, 0, 160, 255],
    ],
  ],
])('%s paints these bytes', (metric, expected) => {
  const ramp = generateLDColorRamp(metric)
  expect(ramp).toHaveLength(256 * 4)
  expect(
    [0, 64, 128, 192, 255].map(i => [...ramp.slice(i * 4, i * 4 + 4)]),
  ).toEqual(expected)
})

// Every LD ramp is opaque, unlike hic's juicebox fade: the shared builder
// interpolates alpha, and these tables hand it 255 at every stop.
test('every entry of every ramp is opaque', () => {
  for (const metric of ['r2', 'dprime']) {
    const ramp = generateLDColorRamp(metric)
    for (let i = 0; i < 256; i++) {
      expect(ramp[i * 4 + 3]).toBe(255)
    }
  }
})

// Pre-computed LD files state magnitudes — plink2's signed DPRIME is read
// through `Math.abs` — so the ramp position is the value, clamped for float
// noise at the ends.
test('mapLDValue is the value, clamped to the ramp', () => {
  expect(mapLDValue(0)).toBe(0)
  expect(mapLDValue(0.5)).toBe(0.5)
  expect(mapLDValue(2)).toBe(1)
  expect(mapLDValue(-1)).toBe(0)
})

test('the label says what the number is', () => {
  expect(ldMetricLabel('r2')).toBe('R²')
  expect(ldMetricLabel('dprime')).toBe("D'")
})

test('a value prints to three places', () => {
  expect(ldValueText(1)).toBe('1.000')
  expect(ldValueText(0.123456)).toBe('0.123')
  expect(ldValueText(0)).toBe('0.000')
})
