import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import BigWigAdapter from './BigWigAdapter'
import configSchema from './configSchema'

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
      assemblyName: 'volvox',
      end: 20000,
      refName: 'ctgA',
      start: 0,
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
        assemblyName: 'volvox',
        end: 40000,
        refName: 'ctgA',
        start: 10000,
      }),
    ).toMatchSnapshot()
  })

  it('get local stats', async () => {
    expect(
      await adapter.getMultiRegionQuantitativeStats([
        {
          assemblyName: 'volvox',
          end: 39999,
          refName: 'ctgA',
          start: 10000,
        },
        {
          assemblyName: 'volvox',
          end: 99,
          refName: 'ctgB',
          start: 0,
        },
      ]),
    ).toMatchSnapshot()
  })
})
