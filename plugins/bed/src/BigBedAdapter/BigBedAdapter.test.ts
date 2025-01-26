import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import BigBedAdapter from './BigBedAdapter'
import configSchema from './configSchema'
beforeEach(() => {
  // tell vitest we use mocked time
  vi.useFakeTimers()
})

afterEach(() => {
  // restoring date after each test run
  vi.useRealTimers()
})
test('adapter can fetch features from volvox.bb', async () => {
  const adapter = new BigBedAdapter(
    configSchema.create({
      bigBedLocation: {
        localPath: require.resolve('./test_data/volvox.bb'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
