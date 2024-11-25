import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './VcfAdapter'
import configSchema from './configSchema'

test('adapter can fetch variants from volvox.vcf', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const feat = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  expect(names).toMatchSnapshot()

  const featArray = await firstValueFrom(feat.pipe(toArray()))
  expect(featArray.slice(0, 5)).toMatchSnapshot()
})
