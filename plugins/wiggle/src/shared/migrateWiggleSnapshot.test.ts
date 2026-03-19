import { migrateWiggleSnapshot } from './migrateWiggleSnapshot.ts'

describe('migrateWiggleSnapshot', () => {
  test('returns snapshot unchanged when no old properties present', () => {
    const snap = {
      type: 'LinearWiggleDisplay',
      scaleTypeSetting: 'log',
      autoscaleSetting: 'local',
    }
    expect(migrateWiggleSnapshot(snap)).toBe(snap)
  })

  test('migrates scale → scaleTypeSetting', () => {
    const result = migrateWiggleSnapshot({ scale: 'log' })
    expect(result).toEqual({ scaleTypeSetting: 'log' })
  })

  test('migrates autoscale → autoscaleSetting', () => {
    const result = migrateWiggleSnapshot({ autoscale: 'local' })
    expect(result).toEqual({ autoscaleSetting: 'local' })
  })

  test('migrates summaryScoreMode → summaryScoreModeSetting', () => {
    const result = migrateWiggleSnapshot({ summaryScoreMode: 'whiskers' })
    expect(result).toEqual({ summaryScoreModeSetting: 'whiskers' })
  })

  test('migrates color properties', () => {
    const result = migrateWiggleSnapshot({
      color: '#ff0000',
      posColor: '#0000ff',
      negColor: '#00ff00',
    })
    expect(result).toEqual({
      colorSetting: '#ff0000',
      posColorSetting: '#0000ff',
      negColorSetting: '#00ff00',
    })
  })

  test('migrates constraints.{min,max} → minScoreSetting/maxScoreSetting', () => {
    const result = migrateWiggleSnapshot({
      constraints: { min: -10, max: 100 },
    })
    expect(result).toEqual({ minScoreSetting: -10, maxScoreSetting: 100 })
  })

  test('handles constraints with only min', () => {
    const result = migrateWiggleSnapshot({ constraints: { min: 0 } })
    expect(result).toEqual({ minScoreSetting: 0 })
  })

  test('handles constraints with only max', () => {
    const result = migrateWiggleSnapshot({ constraints: { max: 50 } })
    expect(result).toEqual({ maxScoreSetting: 50 })
  })

  test('migrates rendererTypeNameState → renderingTypeSetting', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'density',
    })
    expect(result).toEqual({ renderingTypeSetting: 'density' })
  })

  test('migrates selectedRendering as fallback', () => {
    const result = migrateWiggleSnapshot({ selectedRendering: 'line' })
    expect(result).toEqual({ renderingTypeSetting: 'line' })
  })

  test('rendererTypeNameState takes precedence over selectedRendering', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'density',
      selectedRendering: 'xyplot',
    })
    expect(result).toEqual({ renderingTypeSetting: 'density' })
  })

  test('multiWiggle mode remaps xyplot → multixyplot', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'xyplot' },
      { multiWiggle: true },
    )
    expect(result).toEqual({ renderingTypeSetting: 'multixyplot' })
  })

  test('multiWiggle mode passes through non-xyplot types unchanged', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'multirowxy' },
      { multiWiggle: true },
    )
    expect(result).toEqual({ renderingTypeSetting: 'multirowxy' })
  })

  test('migrates showSidebar → showTreeSetting', () => {
    const result = migrateWiggleSnapshot({ showSidebar: false })
    expect(result).toEqual({ showTreeSetting: false })
  })

  test('strips fill and minSize', () => {
    const result = migrateWiggleSnapshot({
      scale: 'linear',
      fill: true,
      minSize: 2,
    })
    expect(result).toEqual({ scaleTypeSetting: 'linear' })
    expect(result).not.toHaveProperty('fill')
    expect(result).not.toHaveProperty('minSize')
  })

  test('preserves unrelated properties', () => {
    const result = migrateWiggleSnapshot({
      type: 'LinearWiggleDisplay',
      configuration: 'track-123',
      layout: [],
      scale: 'log',
    })
    expect(result).toEqual({
      type: 'LinearWiggleDisplay',
      configuration: 'track-123',
      layout: [],
      scaleTypeSetting: 'log',
    })
  })

  test('full old snapshot migration', () => {
    const oldSnap = {
      type: 'MultiLinearWiggleDisplay',
      configuration: 'encode-multi',
      layout: [{ name: 'track1' }],
      rendererTypeNameState: 'xyplot',
      scale: 'log',
      autoscale: 'local',
      summaryScoreMode: 'whiskers',
      constraints: { min: 0, max: 200 },
      showSidebar: true,
      fill: true,
      minSize: 1,
    }
    const result = migrateWiggleSnapshot(oldSnap, { multiWiggle: true })
    expect(result).toEqual({
      type: 'MultiLinearWiggleDisplay',
      configuration: 'encode-multi',
      layout: [{ name: 'track1' }],
      renderingTypeSetting: 'multixyplot',
      scaleTypeSetting: 'log',
      autoscaleSetting: 'local',
      summaryScoreModeSetting: 'whiskers',
      minScoreSetting: 0,
      maxScoreSetting: 200,
      showTreeSetting: true,
    })
  })
})
