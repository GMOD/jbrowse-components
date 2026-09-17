import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigWigAdapter from './BigWigAdapter.ts'
import configSchema from './configSchema.ts'
import { sampleMeanRecordSpan } from './syntheticTiers.ts'

jest.mock('./syntheticTiers.ts', () => {
  const actual = jest.requireActual('./syntheticTiers.ts')
  return {
    ...actual,
    sampleMeanRecordSpan: jest.fn(actual.sampleMeanRecordSpan),
  }
})

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

describe('the raw sample synthetic tiers are sized from', () => {
  const region = { refName: 'ctgA', start: 0, end: 20000, assemblyName: 'v' }
  function coverage() {
    return new BigWigAdapter(
      configSchema.create({
        bigWigLocation: {
          localPath: require.resolve('./test_data/volvox.bw'),
          locationType: 'LocalPathLocation',
        },
      }),
    )
  }
  beforeEach(() => {
    jest.mocked(sampleMeanRecordSpan).mockClear()
  })

  it('is never read by a fetch that sends no zoom, or one finer than any bin', async () => {
    const adapter = coverage()
    await firstValueFrom(adapter.getFeatures(region).pipe(toArray()))
    await adapter.getFeatureArrays(region)
    await adapter.getFeatureArraysMulti([region], { bpPerPx: 1 })
    expect(await adapter.getZoomRange({})).toEqual({
      minBpPerPx: 0,
      maxBpPerPx: 2,
    })
    expect(await adapter.getZoomRange({ bpPerPx: 400 })).toEqual({
      minBpPerPx: 320,
      maxBpPerPx: 1280,
    })
    expect(sampleMeanRecordSpan).not.toHaveBeenCalled()
  })

  it('is read once, at the first zoom a synthetic bin could serve', async () => {
    const adapter = coverage()
    const [rows] = await adapter.getFeatureArraysMulti([region], { bpPerPx: 2 })
    expect(rows!.minScores).toBeDefined()
    await adapter.getZoomRange({ bpPerPx: 19 })
    expect(sampleMeanRecordSpan).toHaveBeenCalledTimes(1)
  })
})

function adapterAt(localPath: string) {
  return new BigWigAdapter(
    configSchema.create({
      bigWigLocation: { localPath, locationType: 'LocalPathLocation' },
    }),
  )
}

function rowsOf(r: Awaited<ReturnType<BigWigAdapter['getFeatureArrays']>>) {
  return Array.from({ length: r.count }, (_, i) => [
    r.starts[i],
    r.ends[i],
    r.scores[i],
    r.minScores?.[i],
    r.maxScores?.[i],
  ])
}

describe('a synthetic zoom over several regions', () => {
  it('bins each region as a fetch of that region alone does', async () => {
    const adapter = adapterAt(require.resolve('./test_data/volvox.bw'))
    const regions = [
      { refName: 'ctgA', start: 1000, end: 3000, assemblyName: 'v' },
      { refName: 'ctgA', start: 2501, end: 6003, assemblyName: 'v' },
      { refName: 'ctgB', start: 0, end: 100, assemblyName: 'v' },
      { refName: 'ctgA', start: 20003, end: 21007, assemblyName: 'v' },
    ]
    const together = await adapter.getFeatureArraysMulti(regions, {
      bpPerPx: 5,
    })
    expect(together).toHaveLength(4)
    for (const [i, region] of regions.entries()) {
      const alone = await adapter.getFeatureArrays(region, { bpPerPx: 5 })
      expect(rowsOf(together[i]!)).toEqual(rowsOf(alone))
    }
    expect(together[0]!.minScores).toBeDefined()
    expect(together[0]!.count).toBeGreaterThan(100)
    expect(together[2]!.count).toBe(0)
  })
})

describe('a BigWig with no zoom levels', () => {
  let dir: string
  let path: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bigwig-no-zoom-'))
    path = join(dir, 'no_zoom_levels.bw')
    const bytes = readFileSync(require.resolve('./test_data/volvox.bw'))
    bytes.writeUInt16LE(0, 6)
    writeFileSync(path, bytes)
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })
  beforeEach(() => {
    jest.mocked(sampleMeanRecordSpan).mockClear()
  })

  it('answers raw records at every zoom, over one range, with no sample', async () => {
    const adapter = adapterAt(path)
    const region = {
      refName: 'ctgA',
      start: 1000,
      end: 9000,
      assemblyName: 'v',
    }
    const { fileLevels } = await adapter.setup()
    expect(fileLevels).toEqual([])
    expect(await adapter.getReductionLevels()).toEqual([])
    const raw = await adapterAt(
      require.resolve('./test_data/volvox.bw'),
    ).getFeatureArrays(region, { bpPerPx: 1 })
    for (const bpPerPx of [0.5, 5, 19, 1000]) {
      expect(await adapter.getZoomRange({ bpPerPx })).toEqual({
        minBpPerPx: 0,
        maxBpPerPx: Infinity,
      })
      const [rows] = await adapter.getFeatureArraysMulti([region], { bpPerPx })
      expect(rows!.minScores).toBeUndefined()
      expect(rowsOf(rows!)).toEqual(rowsOf(raw))
    }
    expect(sampleMeanRecordSpan).not.toHaveBeenCalled()
  })
})
