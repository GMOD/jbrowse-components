import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './VcfTabixAdapter'
import configSchema from './configSchema'

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  const adapter = new Adapter(
    configSchema.create({
      index: {
        indexType: 'TBI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const csiAdapter = new Adapter(
    configSchema.create({
      index: {
        indexType: 'CSI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.csi'),
          locationType: 'LocalPathLocation',
        },
      },
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const csiFeatures = csiAdapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const names = await adapter.getRefNames()
  const csiNames = await csiAdapter.getRefNames()
  expect(names).toEqual(csiNames)
  expect(names).toMatchSnapshot()

  const feat = adapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const featArray = await firstValueFrom(feat.pipe(toArray()))
  const csiFeaturesArray = await firstValueFrom(csiFeatures.pipe(toArray()))
  expect(featArray.slice(0, 5)).toMatchSnapshot()
  expect(csiFeaturesArray.slice(0, 5)).toEqual(featArray.slice(0, 5))

  const featNonExist = adapter.getFeatures({
    end: 20000,
    refName: 'ctgC',
    start: 0,
  })

  const featArrayNonExist = await firstValueFrom(featNonExist.pipe(toArray()))
  expect(featArrayNonExist).toEqual([])
})
