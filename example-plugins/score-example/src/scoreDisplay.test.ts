import { SimpleFeature } from '@jbrowse/core/util'

import { buildScoreResult, fetchScoreData } from './scoreDisplay.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

function feature(uniqueId: string, start: number, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: '1',
    start,
    end: start + 10,
    score,
  })
}

describe('buildScoreResult', () => {
  test('flattens features into parallel typed arrays at matching indexes', () => {
    const r = buildScoreResult(
      [feature('a', 10, 2), feature('b', 200, 4), feature('c', 3000, 1)],
      'score',
    )
    expect(r.numFeatures).toBe(3)
    expect(Array.from(r.starts)).toEqual([10, 200, 3000])
    expect(Array.from(r.ends)).toEqual([20, 210, 3010])
  })

  test('normalizes score to 0..1 against the region max', () => {
    const r = buildScoreResult(
      [feature('a', 0, 5), feature('b', 100, 10)],
      'score',
    )
    expect(Array.from(r.scores)).toEqual([0.5, 1])
  })

  test('drops features with a non-finite score, keeping arrays dense', () => {
    const r = buildScoreResult(
      [feature('a', 10, 3), feature('scoreless', 50), feature('c', 3000, 6)],
      'score',
    )
    expect(r.numFeatures).toBe(2)
    expect(Array.from(r.starts)).toEqual([10, 3000])
  })

  test('preserves uint32 positions above the float32-safe range', () => {
    const bigPos = 250_000_001
    const r = buildScoreResult([feature('big', bigPos, 1)], 'score')
    expect(r.starts[0]).toBe(bigPos)
  })
})

describe('fetchScoreData', () => {
  // The adapter is what knows when it is downloading and what can stop
  // mid-fetch, so both handles have to reach it rather than be consumed here.
  // Both are optional on the adapter side, so dropping either compiles.
  test('the status callback and stop token reach the adapter', async () => {
    const getFeaturesArray = jest.fn().mockResolvedValue([feature('f1', 0, 5)])
    const statusCallback = jest.fn()
    const adapter = { getFeaturesArray } as unknown as BaseFeatureDataAdapter
    const result = await fetchScoreData({
      adapter,
      region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      params: { scoreColumn: 'score' },
      stopToken: 'token-1',
      statusCallback,
    })
    expect(result.numFeatures).toBe(1)
    const opts = getFeaturesArray.mock.calls[0]![1]
    expect(opts.statusCallback).toBe(statusCallback)
    expect(opts.stopToken).toBe('token-1')
    expect(statusCallback).toHaveBeenCalledWith('Fetching features')
  })
})
