import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './MCScanAnchorsAdapter'

import configSchema from './configSchema'

test('adapter can fetch features from mcscan anchors file', async () => {
  const adapter = new Adapter(
    configSchema.create({
      assemblyNames: ['grape', 'peach'],
      bed1Location: {
        localPath: require.resolve('./test_data/grape.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      bed2Location: {
        localPath: require.resolve('./test_data/peach.bed.gz'),
        locationType: 'LocalPathLocation',
      },

      mcscanAnchorsLocation: {
        localPath: require.resolve('./test_data/grape.peach.anchors.gz'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features1 = adapter.getFeatures({
    assemblyName: 'peach',
    end: 200000,
    refName: 'Pp01',
    start: 0,
  })

  const features2 = adapter.getFeatures({
    assemblyName: 'grape',
    end: 200000,
    refName: 'chr1',
    start: 0,
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(7)
  expect(fa2.length).toBe(8)
})
