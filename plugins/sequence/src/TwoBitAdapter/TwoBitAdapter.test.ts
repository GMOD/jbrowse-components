import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './TwoBitAdapter'
import configSchema from './configSchema'

test('adapter can fetch features from volvox.2bit', async () => {
  const adapter = new Adapter(
    configSchema.create({
      twoBitLocation: {
        localPath: require.resolve('../../test_data/volvox.2bit'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    refName: 'ctgA',
    start: 45000,
    end: 55000,
  })

  const featuresArray2 = await firstValueFrom(features2.pipe(toArray()))
  expect(featuresArray2[0]!.get('end')).toBe(50001)

  const features3 = adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray3 = await firstValueFrom(features3.pipe(toArray()))
  expect(featuresArray3).toMatchSnapshot()
})

test('adapter can fetch regions from with chrom.sizes', async () => {
  const adapter = new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('../../test_data/volvox.chrom.sizes'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  expect(await adapter.getRegions()).toMatchSnapshot()
})
