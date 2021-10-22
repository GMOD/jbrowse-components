import { toArray } from 'rxjs/operators'
import configSchema from './configSchema'
import Gff3TabixAdapter from './Gff3TabixAdapter'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3TabixAdapter
  beforeEach(() => {
    adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3.gz'),
        },
        index: {
          location: {
            localPath: require.resolve('../test_data/volvox.sort.gff3.gz.tbi'),
          },
        },
      }),
    )
  })
  it('test getfeatures on gff plain text adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgB',
      start: 0,
      end: 200000,
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
    const featuresArray = await features.pipe(toArray()).toPromise()
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(4)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })
})
