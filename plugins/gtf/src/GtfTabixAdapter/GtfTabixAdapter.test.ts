import { toArray } from 'rxjs/operators'
import configSchema from './configSchema'
import GtfTabixAdapter from './GtfTabixAdapter'

describe('adapter can fetch features from volvox.sorted.gtf', () => {
  let adapter: GtfTabixAdapter
  beforeEach(() => {
    adapter = new GtfTabixAdapter(
      configSchema.create({
        gtfGzLocation: {
          localPath: require.resolve('./test_data/volvox.sorted.gtf.gz'),
        },
        index: {
          location: {
            localPath: require.resolve('./test_data/volvox.sorted.gtf.gz.tbi'),
          },
        },
      }),
    )
  })
  it('test getfeatures on gtf adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 100000,
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(false)
    const featuresArray = await features.pipe(toArray()).toPromise()
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    console.log(featuresJsonArray)
    expect(featuresJsonArray).toMatchSnapshot()
  })
})

test('can instantiate new GtfTabixAdapter and check for demo data', async () => {
  const adapter = new GtfTabixAdapter(
    configSchema.create({
      gtfGzLocation: {
        localPath: require.resolve('./test_data/demo.sorted.gtf.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/demo.sorted.gtf.gz.tbi'),
        },
      },
    }),
  )
  expect(await adapter.hasDataForRefName('GeneScaffold_10')).toBe(true)
  expect(await adapter.hasDataForRefName('GeneScaffold_11')).toBe(false)
  const features = adapter.getFeatures({
    refName: 'GeneScaffold_10',
    start: 0,
    end: 110000,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
