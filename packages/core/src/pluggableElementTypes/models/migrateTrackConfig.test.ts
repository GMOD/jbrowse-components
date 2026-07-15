import { liftLegacyRendererConfig } from './migrateTrackConfig.ts'

test('lifts removed-renderer props onto the display', () => {
  const result = liftLegacyRendererConfig(
    {
      type: 'LinearBasicDisplay',
      renderer: { type: 'SvgFeatureRenderer', color1: 'red', height: 20 },
    },
    'trackA',
  )
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    color1: 'red',
    featureHeight: 20,
    displayId: 'trackA-LinearBasicDisplay',
  })
  expect(result).not.toHaveProperty('renderer')
})

test('display-level props win over lifted renderer props', () => {
  const result = liftLegacyRendererConfig(
    {
      type: 'LinearBasicDisplay',
      color1: 'blue',
      renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
    },
    'trackA',
  )
  expect(result).toMatchObject({ color1: 'blue' })
})

test('lifts any renderer sub-config now that no renderers are registered', () => {
  const result = liftLegacyRendererConfig(
    {
      type: 'LinearBasicDisplay',
      renderer: { type: 'PileupRenderer', color: 'green' },
    },
    'trackA',
  )
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    color: 'green',
    displayId: 'trackA-LinearBasicDisplay',
  })
  expect(result).not.toHaveProperty('renderer')
})

test('preserves an explicit displayId', () => {
  const result = liftLegacyRendererConfig(
    { type: 'LinearBasicDisplay', displayId: 'custom' },
    'trackA',
  )
  expect(result.displayId).toBe('custom')
})

test('injects displayId fallback when absent', () => {
  const result = liftLegacyRendererConfig(
    { type: 'LinearWiggleDisplay' },
    'trackB',
  )
  expect(result.displayId).toBe('trackB-LinearWiggleDisplay')
})
