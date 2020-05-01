import { toArray } from 'rxjs/operators'
import Adapter from './ChromSizesAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.chrom.sizes', async () => {
  const adapter = new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('../../../../test_data/volvox.chrom.sizes'),
      },
    }),
  )

  const names = await adapter.getRefNames()
  expect(names).toMatchSnapshot()

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = await adapter.getFeatures({
    refName: 'ctgA',
    start: 45000,
    end: 55000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2.length).toBe(0)

  const features3 = await adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray3 = await features3.pipe(toArray()).toPromise()
  expect(featuresArray3).toMatchSnapshot()
})
