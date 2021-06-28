import { toArray } from 'rxjs/operators'
import Adapter from './FromConfigAdapter'
import { configSchema } from './configSchema'

test('adapter can fetch features', async () => {
  const features = [
    { uniqueId: 'one', refName: 'ctgA', start: 20, end: 40 },
    { uniqueId: 'two', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter(configSchema.create({ features }))
  const result = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await result.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].toJSON()).toEqual(features[0])
})

test('adapter can fetch features with subfeatures', async () => {
  const features = [
    {
      refName: 'ctgA',
      uniqueId: 'feat1',
      start: 200,
      end: 750,
      name: 'Feature1',
      subfeatures: [
        {
          uniqueId: 'feat2',
          start: 225,
          end: 300,
          name: 'Feature2',
        },
        {
          uniqueId: 'feat3',
          start: 400,
          end: 600,
          name: 'Feature3',
        },
      ],
    },
  ]
  const adapter = new Adapter(configSchema.create({ features }))
  const result = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await result.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(1)
})
