import { toArray } from 'rxjs/operators'

import Adapter from './FromConfigAdapter'

test('adapter can fetch features', async () => {
  const features = [
    { uniqueId: 'one', seq_id: 'ctgA', start: 20, end: 40 },
    { uniqueId: 'two', seq_id: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(
    {
      assemblyName: 'volvox',
      features,
    },
    {},
  )
  const result = await adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await result.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].toJSON()).toEqual(features[0])
})
