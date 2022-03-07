import { toArray } from 'rxjs/operators'
import Adapter from './MCScanAnchorsAdapter'
import { TextEncoder, TextDecoder } from 'web-encoding'
import configSchema from './configSchema'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}

test('adapter can fetch features from mcscan anchors file', async () => {
  const adapter = new Adapter(
    configSchema.create({
      mcscanAnchorsLocation: {
        localPath: require.resolve('./test_data/grape.peach.anchors.gz'),
        locationType: 'LocalPathLocation',
      },
      bed1Location: {
        localPath: require.resolve('./test_data/peach.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      bed2Location: {
        localPath: require.resolve('./test_data/grape.bed.gz'),
        locationType: 'LocalPathLocation',
      },

      assemblyNames: ['peach', 'grape'],
    }),
  )

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await features1.pipe(toArray()).toPromise()
  const fa2 = await features2.pipe(toArray()).toPromise()
  expect(fa1.length).toBe(7)
  expect(fa2.length).toBe(8)
})
