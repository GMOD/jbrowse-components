import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import GtfAdapter from './GtfAdapter'
import configSchema from './configSchema'

describe('adapter can fetch features from volvox.sorted.gtf', () => {
  let adapter: GtfAdapter
  beforeEach(() => {
    adapter = new GtfAdapter(
      configSchema.create({
        gtfLocation: {
          localPath: require.resolve('../test_data/volvox.sorted.gtf'),
        },
      }),
    )
  })
  it('test getfeatures on gtf plain text adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 100000,
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(false)
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(6)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })
})

test('can instantiate new GtfAdapter and check for demo data', async () => {
  const demoAdapter = new GtfAdapter(
    configSchema.create({
      gtfLocation: {
        localPath: require.resolve('../test_data/demo.gtf'),
      },
    }),
  )
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_1')).toBe(true)
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_10')).toBe(true)
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_11')).toBe(false)

  const features = demoAdapter.getFeatures({
    refName: 'GeneScaffold_1',
    start: 0,
    end: 1100000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  // ENSVPAT00000000407
  expect(featuresArray.length).toEqual(1)
  expect(featuresJsonArray).toMatchSnapshot()
})
