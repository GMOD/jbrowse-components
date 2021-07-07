import { toArray } from 'rxjs/operators'
import Adapter from './VcfAdapter'
import configSchema from './configSchema'
import { TextDecoder } from 'web-encoding'
window.TextDecoder = TextDecoder

test('adapter can fetch variants from volvox.vcf', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf'),
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  expect(names).toMatchSnapshot()

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray.slice(0, 5)).toMatchSnapshot()
})
