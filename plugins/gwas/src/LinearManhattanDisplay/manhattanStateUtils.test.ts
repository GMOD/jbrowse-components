import {
  aggregateScoreStats,
  encodeRegion,
  makeManhattanRenderState,
} from './manhattanStateUtils.ts'

import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function makeRegion(scores: number[]): ManhattanRpcResult {
  const n = scores.length
  const sum = scores.reduce((a, b) => a + b, 0)
  const sumSq = scores.reduce((a, b) => a + b * b, 0)
  return {
    positions: new Uint32Array(scores.map((_, i) => i)),
    scores: new Float32Array(scores),
    numFeatures: n,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    scoreSum: sum,
    scoreSumSq: sumSq,
  }
}

describe('aggregateScoreStats', () => {
  test('returns undefined for empty input', () => {
    expect(aggregateScoreStats([])).toBeUndefined()
  })

  test('returns undefined when all regions have 0 features', () => {
    const empty: ManhattanRpcResult = {
      positions: new Uint32Array(),
      scores: new Float32Array(),
      numFeatures: 0,
      scoreMin: Infinity,
      scoreMax: -Infinity,
      scoreSum: 0,
      scoreSumSq: 0,
    }
    expect(aggregateScoreStats([empty])).toBeUndefined()
  })

  test('single region', () => {
    const stats = aggregateScoreStats([makeRegion([1, 2, 3, 4, 5])])
    expect(stats).toEqual({
      scoreMin: 1,
      scoreMax: 5,
      scoreMean: 3,
      scoreStdDev: Math.sqrt(2),
    })
  })

  test('combines stats across multiple regions', () => {
    const a = makeRegion([1, 2, 3])
    const b = makeRegion([4, 5, 6])
    const stats = aggregateScoreStats([a, b])
    expect(stats?.scoreMin).toBe(1)
    expect(stats?.scoreMax).toBe(6)
    expect(stats?.scoreMean).toBeCloseTo(3.5)
  })
})

describe('encodeRegion', () => {
  test('shares positions/scores buffers, fills color column', () => {
    const data = makeRegion([0.5, 1.5, 2.5])
    const encoded = encodeRegion(data, 0xff112233)
    expect(encoded.positions).toBe(data.positions)
    expect(encoded.scores).toBe(data.scores)
    expect(encoded.numFeatures).toBe(3)
    expect(Array.from(encoded.colors)).toEqual([
      0xff112233, 0xff112233, 0xff112233,
    ])
  })

  test('empty region produces empty buffers', () => {
    const data: ManhattanRpcResult = {
      positions: new Uint32Array(),
      scores: new Float32Array(),
      numFeatures: 0,
      scoreMin: 0,
      scoreMax: 0,
      scoreSum: 0,
      scoreSumSq: 0,
    }
    expect(encodeRegion(data, 0).colors.length).toBe(0)
  })
})

describe('makeManhattanRenderState', () => {
  const view = { trackWidthPx: 800 } as LinearGenomeViewModel

  test('returns undefined when domain is undefined', () => {
    expect(
      makeManhattanRenderState({
        domain: undefined,
        view,
        height: 200,
        scaleType: 'linear',
      }),
    ).toBeUndefined()
  })

  test('builds render state with linear scale encoded as 0', () => {
    const state = makeManhattanRenderState({
      domain: [0, 10],
      view,
      height: 200,
      scaleType: 'linear',
    })
    expect(state).toMatchObject({
      domainY: [0, 10],
      scaleType: 0,
      canvasWidth: 800,
      pointRadius: 2,
    })
  })

  test('log scale encoded as 1', () => {
    const state = makeManhattanRenderState({
      domain: [1, 100],
      view,
      height: 200,
      scaleType: 'log',
    })
    expect(state?.scaleType).toBe(1)
  })

  test('canvasHeight subtracts YSCALEBAR_LABEL_OFFSET on each side', () => {
    const state = makeManhattanRenderState({
      domain: [0, 10],
      view,
      height: 200,
      scaleType: 'linear',
    })
    // YSCALEBAR_LABEL_OFFSET = 5 in wiggle-core
    expect(state?.canvasHeight).toBe(200 - 2 * 5)
  })
})
