import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './IndexedFastaAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.fa', async () => {
  const adapter = new Adapter(
    configSchema.create({
      faiLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.fai'),
        locationType: 'LocalPathLocation',
      },
      fastaLocation: {
        localPath: require.resolve('../../test_data/volvox.fa'),
        locationType: 'LocalPathLocation',
      },
      metadataLocation: {
        localPath: require.resolve('../../test_data/hello.txt'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    end: 55000,
    refName: 'ctgA',
    start: 45000,
  })

  const featuresArray2 = await firstValueFrom(features2.pipe(toArray()))
  expect(featuresArray2[0].get('end')).toBe(50001)

  const features3 = adapter.getFeatures({
    end: 20000,
    refName: 'ctgC',
    start: 0,
  })

  const data = await adapter.getHeader()
  expect(data?.trim()).toBe('hello world')

  const featuresArray3 = await firstValueFrom(features3.pipe(toArray()))
  expect(featuresArray3).toMatchSnapshot()
})
