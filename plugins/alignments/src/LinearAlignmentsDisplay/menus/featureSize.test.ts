import {
  COMPACTNESS_PRESETS,
  NORMAL_PITCH,
  featureSpacingForHeight,
} from './featureSize.ts'

test('featureSpacingForHeight: 1px gap only once the body clears 3px', () => {
  expect(featureSpacingForHeight(1)).toBe(0)
  expect(featureSpacingForHeight(3)).toBe(0)
  expect(featureSpacingForHeight(3.5)).toBe(1)
  expect(featureSpacingForHeight(7)).toBe(1)
})

test('featureSpacingForHeight reproduces the fixed-mode preset pitches', () => {
  const pitch = (h: number) => h + featureSpacingForHeight(h)
  expect(pitch(COMPACTNESS_PRESETS.normal.featureHeight)).toBe(8)
  expect(pitch(COMPACTNESS_PRESETS.compact.featureHeight)).toBe(3)
  expect(pitch(COMPACTNESS_PRESETS['super-compact'].featureHeight)).toBe(1)
})

test('NORMAL_PITCH is the Normal body plus its derived gap (the fit cap)', () => {
  const { featureHeight } = COMPACTNESS_PRESETS.normal
  expect(NORMAL_PITCH).toBe(
    featureHeight + featureSpacingForHeight(featureHeight),
  )
  expect(NORMAL_PITCH).toBe(8)
})
