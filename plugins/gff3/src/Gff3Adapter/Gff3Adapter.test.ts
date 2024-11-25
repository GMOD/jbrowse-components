import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Gff3Adapter from './Gff3Adapter'
import configSchema from './configSchema'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3Adapter
  beforeEach(() => {
    adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3'),
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
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(4)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })
})
