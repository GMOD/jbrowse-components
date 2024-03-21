import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import Adapter from './FromConfigAdapter'
import configSchema from './configSchema'

test('adapter can fetch features', async () => {
  const features = [
    { end: 40, refName: 'ctgA', start: 20, uniqueId: 'one' },
    { end: 60, refName: 'ctgB', start: 50, uniqueId: 'two' },
  ]
  const adapter = new Adapter(configSchema.create({ features }))
  const result = adapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const featuresArray = await firstValueFrom(result.pipe(toArray()))
  expect(featuresArray.length).toBe(1)
  expect(featuresArray[0].toJSON()).toEqual(features[0])
})

test('adapter can fetch features with subfeatures', async () => {
  const features = [
    {
      end: 750,
      name: 'Feature1',
      refName: 'ctgA',
      start: 200,
      subfeatures: [
        {
          end: 300,
          name: 'Feature2',
          start: 225,
          uniqueId: 'feat2',
        },
        {
          end: 600,
          name: 'Feature3',
          start: 400,
          uniqueId: 'feat3',
        },
      ],
      uniqueId: 'feat1',
    },
  ]
  const adapter = new Adapter(configSchema.create({ features }))
  const result = adapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const featuresArray = await firstValueFrom(result.pipe(toArray()))
  expect(featuresArray.length).toBe(1)
})
