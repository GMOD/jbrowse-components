import {
  LEGEND_CHIP_ALPHA_FLOOR,
  attributeColorBy,
  blendOverWhite,
  coerceColorBy,
  colorByAttributeName,
  legendChipColor,
} from './colorUtils.ts'

test('coerceColorBy passes through valid modes', () => {
  expect(coerceColorBy('strand')).toBe('strand')
  expect(coerceColorBy('meanQueryIdentity')).toBe('meanQueryIdentity')
})

test('coerceColorBy maps retired identityDiverging to identity', () => {
  expect(coerceColorBy('identityDiverging')).toBe('identity')
})

test('coerceColorBy falls back to default for unknown/undefined', () => {
  expect(coerceColorBy(undefined)).toBe('default')
  expect(coerceColorBy('bogus')).toBe('default')
})

// The chip is a key, not a pixel sample. Matching the composited ribbon exactly
// stops working at the linear-synteny default alpha of 0.2, where every hue
// washes to near-white and the key identifies nothing.
describe('legendChipColor', () => {
  test('passes moderate and full alpha straight through to blendOverWhite', () => {
    expect(legendChipColor('#4e79a7', 1)).toBe(blendOverWhite('#4e79a7', 1))
    expect(legendChipColor('#4e79a7', 0.8)).toBe(blendOverWhite('#4e79a7', 0.8))
  })

  test('floors a washed-out alpha so the chip still shows its hue', () => {
    expect(legendChipColor('#4e79a7', 0.2)).toBe(
      blendOverWhite('#4e79a7', LEGEND_CHIP_ALPHA_FLOOR),
    )
    // without the floor the chip is within a few percent of white
    const [r, g, b] = blendOverWhite('#4e79a7', 0.2)
      .match(/\d+/g)!
      .map(Number) as [number, number, number]
    expect(Math.min(r, g, b)).toBeGreaterThan(210)
  })

  test('two distinct track colors stay distinguishable at the default alpha', () => {
    const a = legendChipColor('#4e79a7', 0.2)
    const b = legendChipColor('#f28e2c', 0.2)
    expect(a).not.toBe(b)
  })
})

// The open arm of the mode union: stored in the same plain string the model
// already holds, so per-track overrides and saved sessions need no new property.
test('an attribute mode round-trips through the persisted string', () => {
  expect(coerceColorBy(attributeColorBy('goc_score'))).toBe(
    'attribute:goc_score',
  )
  expect(colorByAttributeName('attribute:goc_score')).toBe('goc_score')
  expect(colorByAttributeName('identity')).toBeUndefined()
})

// `attribute:` naming nothing would resolve to a channel with no name, so it is
// not a mode; falling back to 'default' is what every other unknown value does.
test('an attribute mode with no attribute is not a mode', () => {
  expect(coerceColorBy('attribute:')).toBe('default')
})
