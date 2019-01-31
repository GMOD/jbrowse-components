import { toArray } from 'rxjs/operators'

import Adapter from './IndexedFastaAdapter'

test('adapter can fetch sequence from volvox.fa', async () => {
  const adapter = new Adapter({
    assemblyName: 'volvox',
    fastaLocation: { path: require.resolve('./test_data/volvox.fa') },
    faiLocation: { path: require.resolve('./test_data/volvox.fa.fai') },
  })

  const features = adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})

// need to make test for missing files but require.resolve throws
// test('adapter can handle missing fai', async () => {
//   const adapter = new Adapter({
//     assemblyName: 'volvox',
//     fastaLocation: { path: require.resolve('./test_data/volvox.fa') },
//     faiLocation: { path: require.resolve('./test_data/volvox.fa.fai_missing') },
//   })
// })
//
//

test('can use a indexed fasta with gzi', async () => {
  const adapter = new Adapter({
    assemblyName: 'volvox',
    fastaLocation: { path: require.resolve('./test_data/volvox.fa.gz') },
    faiLocation: { path: require.resolve('./test_data/volvox.fa.gz.fai') },
    gziLocation: { path: require.resolve('./test_data/volvox.fa.gz.gzi') },
  })

  const features = adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()

  expect(await adapter.hasDataForRefSeq('ctgA')).toEqual(true)
  expect(await adapter.hasDataForRefSeq('ctgC')).toEqual(false)
  expect(await adapter.hasDataForRefSeq('contigA')).toEqual(true)
})
