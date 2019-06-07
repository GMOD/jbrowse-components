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

  const csiFeatures = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  const csiFeaturesArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()
  expect(csiFeaturesArray).toEqual(featuresArray)

  const features2 = await adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
