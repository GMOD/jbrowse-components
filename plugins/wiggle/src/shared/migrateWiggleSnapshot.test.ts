import { migrateWiggleSnapshot } from './migrateWiggleSnapshot.ts'

describe('migrateWiggleSnapshot', () => {
  test('returns snapshot unchanged when no old properties present', () => {
    const snap = {
      type: 'LinearWiggleDisplay',
      configOverrides: { scaleType: 'log', autoscale: 'local' },
    }
    const result = migrateWiggleSnapshot(snap)
    expect(result).toEqual(snap)
  })

  test('migrates generation 1: scale → configOverrides.scaleType', () => {
    const result = migrateWiggleSnapshot({ scale: 'log' })
    expect(result).toEqual({ configOverrides: { scaleType: 'log' } })
  })

  test('migrates generation 1: autoscale → configOverrides.autoscale', () => {
    const result = migrateWiggleSnapshot({ autoscale: 'local' })
    expect(result).toEqual({ configOverrides: { autoscale: 'local' } })
  })

  test('migrates generation 1: summaryScoreMode', () => {
    const result = migrateWiggleSnapshot({ summaryScoreMode: 'whiskers' })
    expect(result).toEqual({
      configOverrides: { summaryScoreMode: 'whiskers' },
    })
  })

  test('migrates generation 1: color properties', () => {
    const result = migrateWiggleSnapshot({
      color: '#ff0000',
      posColor: '#0000ff',
      negColor: '#00ff00',
    })
    expect(result).toEqual({
      configOverrides: {
        color: '#ff0000',
        posColor: '#0000ff',
        negColor: '#00ff00',
      },
    })
  })

  test('migrates generation 1: constraints.{min,max}', () => {
    const result = migrateWiggleSnapshot({
      constraints: { min: -10, max: 100 },
    })
    expect(result).toEqual({
      configOverrides: { minScore: -10, maxScore: 100 },
    })
  })

  test('handles constraints with only min', () => {
    const result = migrateWiggleSnapshot({ constraints: { min: 0 } })
    expect(result).toEqual({ configOverrides: { minScore: 0 } })
  })

  test('handles constraints with only max', () => {
    const result = migrateWiggleSnapshot({ constraints: { max: 50 } })
    expect(result).toEqual({ configOverrides: { maxScore: 50 } })
  })

  test('migrates generation 1: rendererTypeNameState', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'density',
    })
    expect(result).toEqual({
      configOverrides: { defaultRendering: 'density' },
    })
  })

  test('migrates generation 1: selectedRendering as fallback', () => {
    const result = migrateWiggleSnapshot({ selectedRendering: 'line' })
    expect(result).toEqual({ configOverrides: { defaultRendering: 'line' } })
  })

  test('rendererTypeNameState takes precedence over selectedRendering', () => {
    const result = migrateWiggleSnapshot({
      rendererTypeNameState: 'density',
      selectedRendering: 'xyplot',
    })
    expect(result).toEqual({
      configOverrides: { defaultRendering: 'density' },
    })
  })

  test('multiWiggle mode remaps xyplot → multixyplot', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'xyplot' },
      { multiWiggle: true },
    )
    expect(result).toEqual({
      configOverrides: { defaultRendering: 'multixyplot' },
    })
  })

  test('multiWiggle mode passes through non-xyplot types unchanged', () => {
    const result = migrateWiggleSnapshot(
      { rendererTypeNameState: 'multirowxy' },
      { multiWiggle: true },
    )
    expect(result).toEqual({
      configOverrides: { defaultRendering: 'multirowxy' },
    })
  })

  test('migrates generation 1: showSidebar → showTree', () => {
    const result = migrateWiggleSnapshot({ showSidebar: false })
    expect(result).toEqual({ configOverrides: { showTree: false } })
  })

  test('strips fill and minSize', () => {
    const result = migrateWiggleSnapshot({
      scale: 'linear',
      fill: true,
      minSize: 2,
    })
    expect(result).toEqual({ configOverrides: { scaleType: 'linear' } })
    expect(result).not.toHaveProperty('fill')
    expect(result).not.toHaveProperty('minSize')
  })

  test('migrates generation 2: *Setting properties', () => {
    const result = migrateWiggleSnapshot({
      colorSetting: 'red',
      scaleTypeSetting: 'log',
      autoscaleSetting: 'local',
    })
    expect(result).toEqual({
      configOverrides: { color: 'red', scaleType: 'log', autoscale: 'local' },
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
      configOverrides: { scaleType: 'log' },
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
      configOverrides: {
        defaultRendering: 'multixyplot',
        scaleType: 'log',
        autoscale: 'local',
        summaryScoreMode: 'whiskers',
        minScore: 0,
        maxScore: 200,
        showTree: true,
      },
    })
  })

  test('merges with existing configOverrides', () => {
    const result = migrateWiggleSnapshot({
      configOverrides: { color: 'blue' },
      scaleTypeSetting: 'log',
    })
    expect(result).toEqual({
      configOverrides: { color: 'blue', scaleType: 'log' },
    })
  })
})
