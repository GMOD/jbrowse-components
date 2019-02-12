import { toArray } from 'rxjs/operators'

import Adapter from './BgzipFastaAdapter'

test('can use a indexed fasta with gzi', async () => {
  const adapter = new Adapter(
    {
      assemblyName: 'volvox',
      fastaLocation: { path: require.resolve('./test_data/volvox.fa.gz') },
      faiLocation: { path: require.resolve('./test_data/volvox.fa.gz.fai') },
      gziLocation: { path: require.resolve('./test_data/volvox.fa.gz.gzi') },
    },
    {},
  )

  const features = await adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = await adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
