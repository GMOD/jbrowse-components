import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './IndexedFastaAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.fa', async () => {
  const adapter = new Adapter(
    configSchema.create({
      fastaLocation: {
        localPath: require.resolve('../../test_data/volvox.fa'),
        locationType: 'LocalPathLocation',
      },
      faiLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.fai'),
        locationType: 'LocalPathLocation',
      },
      metadataLocation: {
        localPath: require.resolve('../../test_data/hello.txt'),
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

  const data = await adapter.getHeader()
  expect(data?.trim()).toBe('hello world')

  const featuresArray3 = await firstValueFrom(features3.pipe(toArray()))
  expect(featuresArray3).toMatchSnapshot()
})
