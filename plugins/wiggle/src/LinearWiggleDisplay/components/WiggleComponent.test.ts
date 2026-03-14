import { buildSourceRenderData } from './WiggleComponent.tsx'

import type { WiggleDisplayModel } from './WiggleComponent.tsx'
import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'

function makeData(numFeatures = 2): WiggleDataResult {
  return {
    regionStart: 0,
    featurePositions: new Uint32Array([0, 10, 10, 20]),
    featureScores: new Float32Array([5, 8]),
    featureMinScores: new Float32Array([5, 8]),
    featureMaxScores: new Float32Array([5, 8]),
    numFeatures,
    posFeaturePositions: new Uint32Array([0, 10, 10, 20]),
    posFeatureScores: new Float32Array([5, 8]),
    posNumFeatures: numFeatures,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

function makeModel(
  overrides: Partial<WiggleDisplayModel> = {},
): WiggleDisplayModel {
  return {
    rpcDataMap: new Map(),
    dataVersion: 0,
    height: 100,
    domain: [0, 10] as [number, number],
    scaleType: 'linear',
    color: '#f0f',
    posColor: '#0068d1',
    negColor: '#e10000',
    renderingType: 'xyplot',
    isDensityMode: false,
    summaryScoreMode: 'avg',
    ticks: undefined,
    error: null,
    isLoading: false,
    statusMessage: undefined,
    displayCrossHatches: false,
    scalebarOverlapLeft: 0,
    featureUnderMouse: undefined,
    setFeatureUnderMouse: () => {},
    reload: () => {},
    ...overrides,
  }
}

describe('buildSourceRenderData', () => {
  it('uses posColor/negColor when color is default bicolor (#f0f)', () => {
    const model = makeModel({ color: '#f0f' })
    const data = makeData()
    const sources = buildSourceRenderData(data, model)
    expect(sources.length).toBeGreaterThan(0)
    for (const s of sources) {
      expect(s.color).not.toEqual([1, 0, 1])
    }
  })

  it('uses base color when color is not default', () => {
    const model = makeModel({ color: '#00ff00' })
    const data = makeData()
    const sources = buildSourceRenderData(data, model)
    expect(sources).toHaveLength(1)
    expect(sources[0]!.color[0]).toBeCloseTo(0)
    expect(sources[0]!.color[1]).toBeCloseTo(1)
    expect(sources[0]!.color[2]).toBeCloseTo(0)
  })

  it('produces different colors when model color changes', () => {
    const data = makeData()

    const model1 = makeModel({ color: '#ff0000' })
    const sources1 = buildSourceRenderData(data, model1)

    const model2 = makeModel({ color: '#0000ff' })
    const sources2 = buildSourceRenderData(data, model2)

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  it('produces different colors when posColor changes in bicolor mode', () => {
    const data = makeData()

    const model1 = makeModel({ color: '#f0f', posColor: '#0068d1' })
    const sources1 = buildSourceRenderData(data, model1)

    const model2 = makeModel({ color: '#f0f', posColor: '#ff0000' })
    const sources2 = buildSourceRenderData(data, model2)

    expect(sources1[0]!.color).not.toEqual(sources2[0]!.color)
  })

  it('produces different colors when negColor changes in bicolor mode', () => {
    const data: WiggleDataResult = {
      regionStart: 0,
      featurePositions: new Uint32Array([0, 10, 10, 20]),
      featureScores: new Float32Array([5, -3]),
      featureMinScores: new Float32Array([5, -3]),
      featureMaxScores: new Float32Array([5, -3]),
      numFeatures: 2,
      posFeaturePositions: new Uint32Array([0, 10]),
      posFeatureScores: new Float32Array([5]),
      posNumFeatures: 1,
      negFeaturePositions: new Uint32Array([10, 20]),
      negFeatureScores: new Float32Array([-3]),
      negNumFeatures: 1,
    }

    const model1 = makeModel({ color: '#f0f', negColor: '#e10000' })
    const sources1 = buildSourceRenderData(data, model1)

    const model2 = makeModel({ color: '#f0f', negColor: '#00ff00' })
    const sources2 = buildSourceRenderData(data, model2)

    const negSource1 = sources1.find(
      s => s.color[0]! > 0.5 && s.color[1]! < 0.5,
    )
    const negSource2 = sources2.find(
      s => s.color[1]! > 0.5 && s.color[0]! < 0.5,
    )
    expect(negSource1).toBeDefined()
    expect(negSource2).toBeDefined()
    expect(negSource1!.color).not.toEqual(negSource2!.color)
  })

  it('density mode uses posColor instead of base color in bicolor', () => {
    const data = makeData()
    const model = makeModel({ color: '#f0f', isDensityMode: true })
    const sources = buildSourceRenderData(data, model)
    expect(sources).toHaveLength(1)
  })
})
