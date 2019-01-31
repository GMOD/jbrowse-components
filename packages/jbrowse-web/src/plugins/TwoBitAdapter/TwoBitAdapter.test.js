import { toArray } from 'rxjs/operators'

import Adapter from './TwoBitAdapter'

test('adapter can fetch features from volvox.2bit', async () => {
  const adapter = new Adapter(
    {
      assemblyName: 'volvox',
      twoBitLocation: { path: require.resolve('./test_data/volvox.2bit') },
    },
    {
      assemblies: {
        volvox: {
          aliases: ['vvx'],
          seqNameAliases: {
            A: ['ctgA', 'contigA'],
            B: ['ctgB', 'contigB'],
          },
        },
      },
    },
  )

  const features = await adapter.regularizeAndGetFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()
  expect(adapter.hasDataForRefSeq({ refName: 'ctgA' })).toEqual(true)
  expect(adapter.hasDataForRefSeq({ refName: 'ctgC' })).toEqual(false)
  expect(adapter.hasDataForRefSeq({ refName: 'contigA' })).toEqual(true)
})
