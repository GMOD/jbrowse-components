import { toArray } from 'rxjs/operators'
import Adapter from './JBrowseRESTFeatureAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { firstValueFrom } from 'rxjs'

function mockFetchResponses(
  adapter: Adapter,
  mockResponses: Record<string, unknown>,
) {
  return (
    jest
      // @ts-ignore
      .spyOn(adapter, 'fetch')
      // @ts-ignore
      .mockImplementation(async (fetcher, url: string, signal) => {
        return {
          async json() {
            if (url in mockResponses) {
              return mockResponses[url]
            }
            throw new Error('no mock for ' + url)
          },
        }
      })
  )
}

function createTestAdapter(
  configuration: Record<string, unknown>,
  mockResponses: Record<string, unknown>,
) {
  const stubManager = new PluginManager()
  const adapter = new Adapter(
    configSchema.create(configuration),
    undefined,
    stubManager,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchMock: any = mockFetchResponses(adapter, {
    'https://mock.url/mock/url/features/volvox/21?start=34960388&end=35960388&extra_query=42':
      {
        features: testFeatures1,
      },
    'https://mock.url/mock/url/volvox/reference_sequences?extra_query=42': [
      '21',
    ],
  })

  return { adapter, fetchMock }
}

const testFeatures1 = [{ start: 100, end: 200, refName: '21', uniqueId: 'foo' }]

test('adapter can fetch features and stats from mocked API with no region stats', async () => {
  const { adapter, fetchMock } = createTestAdapter(
    {
      location: { uri: 'https://mock.url/mock/url' },
      extra_query: { extra_query: 42 },
      optional_resources: {},
    },
    {
      'https://mock.url/mock/url/features/volvox/21?start=34960388&end=35960388&extra_query=42':
        {
          features: testFeatures1,
        },
      'https://mock.url/mock/url/volvox/reference_sequences?extra_query=42': [
        '21',
      ],
    },
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray.length).toBe(testFeatures1.length)
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe('foo')
  // @ts-ignore
  expect(fetchMock.mock.calls[0][1]).toBe(
    'https://mock.url/mock/url/features/volvox/21?start=34960388&end=35960388&extra_query=42',
  )

  expect(
    await adapter.hasDataForRefName('ctgA', { assemblyName: 'volvox' }),
  ).toBe(false)
  expect(
    await adapter.hasDataForRefName('21', { assemblyName: 'volvox' }),
  ).toBe(true)

  expect(
    await adapter.getRegionStats({
      assemblyName: 'volvox',
      refName: '21',
      start: 34960388,
      end: 35960388,
    }),
  ).toMatchSnapshot()
})
