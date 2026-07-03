import { getColorBySwatch } from './colorLegend.ts'

test('continuous modes get a gradient swatch with bounded domain labels', () => {
  const identity = getColorBySwatch('identity')
  expect(identity?.minLabel).toBe('0%')
  expect(identity?.maxLabel).toBe('100%')
  expect(identity?.background).toMatch(/^linear-gradient/)

  expect(getColorBySwatch('mappingQuality')?.maxLabel).toBe('60')
  expect(getColorBySwatch('meanQueryMappingQuality')?.minLabel).toBe('weak')
  expect(getColorBySwatch('identityDiverging')?.minLabel).toBe('divergent')
})

test('strand shows a two-color swatch, default a solid chip', () => {
  expect(getColorBySwatch('strand')?.background).toMatch(/linear-gradient/)
  expect(getColorBySwatch('default')?.background).toBe('#f00')
})

test('per-name categorical modes have no fixed legend', () => {
  expect(getColorBySwatch('query')).toBeUndefined()
  expect(getColorBySwatch('target')).toBeUndefined()
})
