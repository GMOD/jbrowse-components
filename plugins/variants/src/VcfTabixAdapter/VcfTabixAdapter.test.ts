import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { expect, test } from 'vitest'

import Adapter from './VcfTabixAdapter'
import configSchema from './configSchema'

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const csiAdapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'CSI',
        location: {
          localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.csi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const csiFeatures = csiAdapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  const csiNames = await csiAdapter.getRefNames()
  expect(names).toEqual(csiNames)
  expect(names).toMatchSnapshot()

  const feat = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featArray = await firstValueFrom(feat.pipe(toArray()))
  const csiFeaturesArray = await firstValueFrom(csiFeatures.pipe(toArray()))
  expect(
    featArray.map(r => {
      const s = r.toJSON()
      // @ts-expect-error
      delete s.uniqueId
      return s
    }),
  ).toEqual(
    csiFeaturesArray.map(r => {
      const s = r.toJSON()
      // @ts-expect-error
      delete s.uniqueId
      return s
    }),
  )

  const featNonExist = adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featArrayNonExist = await firstValueFrom(featNonExist.pipe(toArray()))
  expect(featArrayNonExist).toEqual([])
})
