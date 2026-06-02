import { liftLegacyRendererConfig } from './migrateTrackConfig.ts'

const noRenderers = new Set<string>()

test('lifts removed-renderer props onto the display', () => {
  const result = liftLegacyRendererConfig(
    {
      type: 'LinearBasicDisplay',
      renderer: { type: 'SvgFeatureRenderer', color1: 'red', height: 20 },
    },
    'trackA',
    noRenderers,
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
    noRenderers,
  )
  expect(result).toMatchObject({ color1: 'blue' })
})

test('keeps a still-registered renderer but drops its sub-config on read', () => {
  const result = liftLegacyRendererConfig(
    {
      type: 'LinearBasicDisplay',
      renderer: { type: 'PileupRenderer', color: 'green' },
    },
    'trackA',
    new Set(['PileupRenderer']),
  )
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    renderer: { type: 'PileupRenderer', color: 'green' },
    displayId: 'trackA-LinearBasicDisplay',
  })
})

test('preserves an explicit displayId', () => {
  const result = liftLegacyRendererConfig(
    { type: 'LinearBasicDisplay', displayId: 'custom' },
    'trackA',
    noRenderers,
  )
  expect(result.displayId).toBe('custom')
})

test('injects displayId fallback when absent', () => {
  const result = liftLegacyRendererConfig(
    { type: 'LinearWiggleDisplay' },
    'trackB',
    noRenderers,
  )
  expect(result.displayId).toBe('trackB-LinearWiggleDisplay')
})
