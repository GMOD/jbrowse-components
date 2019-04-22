import { toArray } from 'rxjs/operators'

import BigWigAdapter from './BigWigAdapter'

describe('adapter can fetch features from volvox.bw', () => {
  let adapter
  beforeEach(() => {
    adapter = new BigWigAdapter(
      {
        assemblyName: 'volvox',
        bigWigLocation: { localPath: require.resolve('./test_data/volvox.bw') },
      },
      {},
    )
  })
  it('test basic aspects of getfeatures', async () => {
    const features = await adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    expect(await adapter.refIdToName(0)).toBe('ctgA')
    expect(await adapter.refIdToName(1)).toBe(undefined)
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

    const featuresArray = await features.pipe(toArray()).toPromise()
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
  })
  it('adapter can fetch stats from volvox.bw', async () => {
    expect(await adapter.getGlobalStats()).toMatchSnapshot()
  })
  it('get region stats', async () => {
    expect(
      await adapter.getRegionStats({
        refName: 'ctgA',
        start: 10000,
        end: 40000,
      }),
    ).toMatchSnapshot()
  })
  it('get local stats', async () => {
    expect(
      await adapter.getMultiRegionStats([
        {
          refName: 'ctgA',
          start: 10000,
          end: 40000,
        },
        { refName: 'ctgB', start: 0, end: 100 },
      ]),
    ).toMatchSnapshot()
  })
})
