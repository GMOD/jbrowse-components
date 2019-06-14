import { toArray } from 'rxjs/operators'

import Adapter from './VcfTabixAdapter'

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  const adapter = new Adapter({
    vcfGzLocation: {
      localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
    },
    index: {
      index: 'TBI',
      location: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.tbi'),
      },
    },
  })

  const csiAdapter = new Adapter({
    vcfGzLocation: {
      localPath: require.resolve('./test_data/volvox.filtered.vcf.gz'),
    },
    index: {
      index: 'CSI',
      location: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf.gz.csi'),
      },
    },
  })

  const csiFeatures = await csiAdapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  const csiNames = await csiAdapter.getRefNames()
  expect(names).toEqual(csiNames)
  expect(names).toMatchSnapshot()

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  const csiFeaturesArray = await csiFeatures.pipe(toArray()).toPromise()
  expect(featuresArray.slice(0, 5)).toMatchSnapshot()
  expect(csiFeaturesArray.slice(0, 5)).toEqual(featuresArray.slice(0, 5))

  const featuresNonExist = await adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArrayNonExist = await featuresNonExist
    .pipe(toArray())
    .toPromise()
  expect(featuresArrayNonExist).toEqual([])
})
