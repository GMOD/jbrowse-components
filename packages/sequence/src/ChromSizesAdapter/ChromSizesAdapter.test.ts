import { toArray } from 'rxjs/operators'
import Adapter from './ChromSizesAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.chrom.sizes', async () => {
  const adapter = new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('./test_data/volvox.chrom.sizes'),
      },
    }),
  )

  const names = await adapter.getRefNames()
  expect(names).toEqual(['ctgA', 'ctgB'])

  const features = adapter.getFeatures()

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(0)
})
