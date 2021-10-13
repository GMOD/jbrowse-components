// import { toArray } from 'rxjs/operators'
import configSchema from './configSchema'
import Gff3Adapter from './Gff3Adapter'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3Adapter
  beforeEach(() => {
    adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('./test_data/volvox.gff3'),
        },
      }),
    )
  })
  it('test getfeatures on gff plain text adapter', async () => {
    // const features = adapter.getFeatures({
    //   refName: 'ctgA',
    //   start: 0,
    //   end: 20000,
    // })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
    // const featuresArray = await features.pipe(toArray()).toPromise()
    // const featuresJsonArray = featuresArray.map(f => f.toJSON())
    // expect(featuresJsonArray).toMatchSnapshot()
  })
})
