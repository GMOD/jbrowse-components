import { toArray } from 'rxjs/operators'
import Adapter from './JBrowseRESTFeatureAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'

const testFeatures = [{ start: 100, end: 200, refName: '21', uniqueId: 'foo' }]
const mockResponses = {
  '/mock/url/features/21?start=34960388&end=35960388': {
    features: testFeatures,
  },
  '/mock/url/reference_sequences': ['21'],
}

test('adapter can fetch features from mocked API', async () => {
  const stubManager = new PluginManager()
  const adapter = new Adapter(
    configSchema.create({
      location: { uri: '/mock/url' },
      extra_query: { extra_query: 42 },
      optional_resources: {
        region_stats: true,
      },
    }),
    undefined,
    stubManager,
  )

  const fetchMock = jest
    // @ts-ignore
    .spyOn(adapter, 'fetch')
    // @ts-ignore
    .mockImplementation(async (fetcher, url: string, signal) => {
      return {
        async json() {
          if (url in mockResponses) {
            return mockResponses[url as keyof typeof mockResponses]
          }
          throw new Error('no mock for ' + url)
        },
      }
    })

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray.length).toBe(testFeatures.length)
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe('foo')
  // @ts-ignore
  expect(fetchMock.mock.calls[0][1]).toBe(
    '/mock/url/features/21?start=34960388&end=35960388',
  )

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  // expect(await adapter.hasDataForRefName('21')).toBe(true)
  // expect(await adapter.hasDataForRefName('20')).toBe(false)
})
