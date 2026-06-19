import { migrateWiggleSnapshot } from './migrateWiggleSnapshot.ts'

describe('migrateWiggleSnapshot', () => {
  test('returns snapshot unchanged when no old properties present', () => {
    const snap = { type: 'LinearWiggleDisplay', scaleType: 'log' }
    const result = migrateWiggleSnapshot(snap)
    expect(result).toEqual(snap)
  })

  test('migrates generation 1: scale → flat scaleType', () => {
    const result = migrateWiggleSnapshot({ scale: 'log' })
    expect(result).toEqual({ scaleType: 'log' })
  })

  test('migrates generation 1: autoscale → flat autoscale', () => {
    const result = migrateWiggleSnapshot({ autoscale: 'local' })
    expect(result).toEqual({ autoscale: 'local' })
  })

  test('migrates generation 1: summaryScoreMode', () => {
    const result = migrateWiggleSnapshot({ summaryScoreMode: 'whiskers' })
    expect(result).toEqual({ summaryScoreMode: 'whiskers' })
  })

  test('migrates generation 1: color properties (solid color → useBicolor:false)', () => {
    const result = migrateWiggleSnapshot({
      color: '#ff0000',
      posColor: '#0000ff',
      negColor: '#00ff00',
    })
    expect(result).toEqual({
      color: '#ff0000',
      useBicolor: false,
      posColor: '#0000ff',
      negColor: '#00ff00',
    })
  })

  test('migrates sentinel #f0f color → useBicolor:true, strips color', () => {
    const result = migrateWiggleSnapshot({ color: '#f0f' })
    expect(result).toEqual({ useBicolor: true })
  })

  test('migrates sentinel #ff00ff color → useBicolor:true, strips color', () => {
    const result = migrateWiggleSnapshot({ colorSetting: '#ff00ff' })
    expect(result).toEqual({ useBicolor: true })
  })

  test('migrates generation 1: constraints.{min,max}', () => {
    const result = migrateWiggleSnapshot({
      constraints: { min: -10, max: 100 },
    })
    expect(result).toEqual({ minScore: -10, maxScore: 100 })
  })

  test('handles constraints with only min', () => {
    const result = migrateWiggleSnapshot({ constraints: { min: 0 } })
    expect(result).toEqual({ minScore: 0 })
  })

  test('handles constraints with only max', () => {
    const result = migrateWiggleSnapshot({ constraints: { max: 50 } })
    expect(result).toEqual({ maxScore: 50 })
  })

  test('migrates generation 1: rendererTypeNameState', () => {
    const result = migrateWiggleSnapshot({ rendererTypeNameState: 'density' })
    expect(result).toEqual({ defaultRendering: 'density' })
  })

  test('migrates generation 1: selectedRendering as fallback', () => {
    const result = migrateWiggleSnapshot({ selectedRendering: 'line' })
    expect(result).toEqual({ defaultRendering: 'line' })
  })

  test('empty-string selectedRendering does not become a defaultRendering override', () => {
    // Legacy configs saved `selectedRendering: ''`; it must NOT migrate to
    // `defaultRendering: ''` (which throws "Unknown wiggle rendering type:")
    const result = migrateWiggleSnapshot({ selectedRendering: '', resolution: 1 })
    expect(result).toEqual({ resolution: 1 })
  })

  test('empty-string rendererTypeNameState/renderingTypeSetting are ignored', () => {
    expect(migrateWiggleSnapshot({ rendererTypeNameState: '' })).toEqual({})
    expect(migrateWiggleSnapshot({ renderingTypeSetting: '' })).toEqual({})
  })

  test('rendererTypeNameState takes precedence over selectedRendering', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'density',
      selectedRendering: 'xyplot',
    })
    expect(result).toEqual({ defaultRendering: 'density' })
  })

  test('multiWiggle mode remaps xyplot → multixyplot', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'xyplot' },
      { multiWiggle: true },
    )
    expect(result).toEqual({ defaultRendering: 'multixyplot' })
  })

  test('multiWiggle mode passes through non-xyplot types unchanged', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'multirowxy' },
      { multiWiggle: true },
    )
    expect(result).toEqual({ defaultRendering: 'multirowxy' })
  })

  test('migrates generation 1: showSidebar → showTree', () => {
    const result = migrateWiggleSnapshot({ showSidebar: false })
    expect(result).toEqual({ showTree: false })
  })

  test('strips fill:true and minSize without changing rendering', () => {
    const result = migrateWiggleSnapshot({
      scale: 'linear',
      fill: true,
      minSize: 2,
    })
    expect(result).toEqual({ scaleType: 'linear' })
    expect(result).not.toHaveProperty('fill')
    expect(result).not.toHaveProperty('minSize')
  })

  test('migrates fill:false on xyplot → scatter', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'xyplot',
      fill: false,
    })
    expect(result).toEqual({ defaultRendering: 'scatter' })
  })

  test('migrates fill:false with no rendering (single) → scatter', () => {
    const result = migrateWiggleSnapshot({ fill: false })
    expect(result).toEqual({ defaultRendering: 'scatter' })
  })

  test('migrates fill:false with no rendering (multiWiggle) → multirowscatter', () => {
    const result = migrateWiggleSnapshot({ fill: false }, { multiWiggle: true })
    expect(result).toEqual({ defaultRendering: 'multirowscatter' })
  })

  test('migrates fill:false on multirowxy (multiWiggle) → multirowscatter', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'multirowxy', fill: false },
      { multiWiggle: true },
    )
    expect(result).toEqual({ defaultRendering: 'multirowscatter' })
  })

  test('migrates fill:false on xyplot (multiWiggle) → multiscatter', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'xyplot', fill: false },
      { multiWiggle: true },
    )
    expect(result).toEqual({ defaultRendering: 'multiscatter' })
  })

  test('fill:false on density/line passes through unchanged', () => {
    expect(
      migrateWiggleSnapshot({ rendererTypeNameState: 'density', fill: false }),
    ).toEqual({ defaultRendering: 'density' })
    expect(
      migrateWiggleSnapshot({ rendererTypeNameState: 'line', fill: false }),
    ).toEqual({ defaultRendering: 'line' })
  })

  test('migrates generation 2: *Setting properties (solid color → useBicolor:false)', () => {
    const result = migrateWiggleSnapshot({
      colorSetting: 'red',
      scaleTypeSetting: 'log',
      autoscaleSetting: 'local',
    })
    expect(result).toEqual({
      color: 'red',
      useBicolor: false,
      scaleType: 'log',
      autoscale: 'local',
    })
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
      scaleType: 'log',
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
      defaultRendering: 'multixyplot',
      scaleType: 'log',
      autoscale: 'local',
      summaryScoreMode: 'whiskers',
      minScore: 0,
      maxScore: 200,
      showTree: true,
    })
  })

  test('bicolorPivot "numeric" + bicolorPivotValue → numeric bicolorPivot', () => {
    const result = migrateWiggleSnapshot({
      bicolorPivot: 'numeric',
      bicolorPivotValue: 100,
    })
    expect(result).toEqual({ bicolorPivot: 100 })
  })

  test('bicolorPivot "mean"/"z_score"/"none" drop to default (no override)', () => {
    expect(migrateWiggleSnapshot({ bicolorPivot: 'mean' })).toEqual({})
    expect(migrateWiggleSnapshot({ bicolorPivot: 'z_score' })).toEqual({})
    expect(migrateWiggleSnapshot({ bicolorPivot: 'none' })).toEqual({})
  })

  test('numeric bicolorPivot passes through unchanged', () => {
    const result = migrateWiggleSnapshot({ bicolorPivot: 42 })
    expect(result).toEqual({ bicolorPivot: 42 })
  })

  test('strips clipColor and bicolorPivotValue', () => {
    const result = migrateWiggleSnapshot({
      scale: 'log',
      clipColor: 'red',
      bicolorPivotValue: 5,
    })
    expect(result).toEqual({ scaleType: 'log' })
    expect(result).not.toHaveProperty('clipColor')
    expect(result).not.toHaveProperty('bicolorPivotValue')
  })
})
