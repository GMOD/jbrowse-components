import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigWigAdapter from './BigWigAdapter.ts'
import configSchema from './configSchema.ts'

describe('adapter can fetch features from volvox.bw', () => {
  let adapter: BigWigAdapter
  beforeEach(() => {
    adapter = new BigWigAdapter(
      configSchema.create({
        bigWigLocation: {
          localPath: require.resolve('./test_data/volvox.bw'),
          locationType: 'LocalPathLocation',
        },
      }),
    )
  })
  it('test basic aspects of getfeatures', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 20000,
      assemblyName: 'volvox',
    })
    expect(await adapter.refIdToName(0)).toBe('ctgA')
    expect(await adapter.refIdToName(1)).toBe(undefined)
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
  })
  it('adapter can fetch stats from volvox.bw', async () => {
    expect(await adapter.getGlobalStats()).toMatchSnapshot()
  })
  it('get region stats', async () => {
    expect(
      await adapter.getRegionQuantitativeStats({
        refName: 'ctgA',
        start: 10000,
        end: 40000,
        assemblyName: 'volvox',
      }),
    ).toMatchSnapshot()
  })

  it('get local stats', async () => {
    expect(
      await adapter.getMultiRegionQuantitativeStats([
        {
          refName: 'ctgA',
          start: 10000,
          end: 39999,
          assemblyName: 'volvox',
        },
        {
          refName: 'ctgB',
          start: 0,
          end: 99,
          assemblyName: 'volvox',
        },
      ]),
    ).toMatchSnapshot()
  })

  it('getFeatureArraysMulti returns one result per region at base resolution', async () => {
    const regions = [
      { refName: 'ctgA', start: 0, end: 10000, assemblyName: 'volvox' },
      { refName: 'ctgA', start: 10000, end: 20000, assemblyName: 'volvox' },
    ]
    const results = await adapter.getFeatureArraysMulti(regions, {
      bpPerPx: 1,
      resolution: 1,
    })
    expect(results).toHaveLength(2)

    // base resolution: no summary min/max
    expect(results[0]!.minScores).toBeUndefined()
    expect(results[0]!.maxScores).toBeUndefined()
    // count matches typed-array length
    expect(results[0]!.count).toBe(results[0]!.starts.length)
    expect(results[1]!.count).toBe(results[1]!.starts.length)
    // each region's starts are within its requested range
    expect(Math.min(...Array.from(results[0]!.starts))).toBeGreaterThanOrEqual(
      0,
    )
    expect(Math.max(...Array.from(results[0]!.ends))).toBeLessThanOrEqual(10000)
    expect(Math.min(...Array.from(results[1]!.starts))).toBeGreaterThanOrEqual(
      10000,
    )
    expect(Math.max(...Array.from(results[1]!.ends))).toBeLessThanOrEqual(20000)
  })

  it('getFeatureArraysMulti returns summary min/max at zoom resolution', async () => {
    const regions = [
      { refName: 'ctgA', start: 0, end: 40000, assemblyName: 'volvox' },
      { refName: 'ctgA', start: 0, end: 20000, assemblyName: 'volvox' },
    ]
    // basesPerSpan=1000 triggers a zoom level (isSummary=true in bbi)
    const results = await adapter.getFeatureArraysMulti(regions, {
      bpPerPx: 1000,
      resolution: 1,
    })
    expect(results).toHaveLength(2)
    // summary path: minScores and maxScores are present
    expect(results[0]!.minScores).toBeDefined()
    expect(results[0]!.maxScores).toBeDefined()
    expect(results[0]!.minScores!.length).toBe(results[0]!.count)
    expect(results[0]!.maxScores!.length).toBe(results[0]!.count)
    // wider region gets more bins
    expect(results[0]!.count).toBeGreaterThan(results[1]!.count)
  })
})
