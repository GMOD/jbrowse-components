import { toArray } from 'rxjs/operators'
import Adapter from './JBrowseRESTFeatureAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { firstValueFrom } from 'rxjs'
import {
  FeatureScoreStats,
  isFeatureCoverageStats,
  isFeatureScoreStats,
} from '@jbrowse/core/util/stats'

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
  const fetchMock: any = mockFetchResponses(adapter, mockResponses)

  return { adapter, fetchMock }
}

const testFeatures1 = [{ start: 100, end: 200, refName: '21', uniqueId: 'foo' }]

test('adapter can fetch features and stats from mocked API with no region stats', async () => {
  const { adapter, fetchMock } = createTestAdapter(
    {
      location: { uri: 'https://mock.url/mock/url' },
      extraQuery: { extra_query: 42 },
      assemblyNames: ['volvox'],
      optionalResources: {
        assembly_names: false,
      },
    },
    {
      'https://mock.url/mock/url/features/volvox/21?start=34960388&end=35960388&extra_query=42':
        {
          features: testFeatures1,
        },
      'https://mock.url/mock/url/volvox/reference_sequences?extra_query=42': [
        '21',
      ],
      'https://mock.url/mock/url/has_data_for_reference/volvox/ctgA?extra_query=42':
        false,
      'https://mock.url/mock/url/has_data_for_reference/volvox/21?extra_query=42':
        true,
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
  expect(await adapter.getAssemblyNames()).toStrictEqual(['volvox'])
  expect(
    await adapter.hasDataForRefName('ctgA', { assemblyName: 'volvox' }),
  ).toBe(false)
  expect(
    await adapter.hasDataForRefName('21', { assemblyName: 'volvox' }),
  ).toBe(true)
  expect(
    await adapter.hasDataForRefName('21', { assemblyName: 'volvox' }),
  ).toBe(true)
  expect(await adapter.hasDataForRefName('21')).toBe(true)

  expect(
    await adapter.getRegionStats({
      assemblyName: 'volvox',
      refName: '21',
      start: 34960388,
      end: 35960388,
    }),
  ).toMatchSnapshot()
})

test('adapter can fetch features and stats from mocked API with region stats and REST assembly names', async () => {
  const { adapter } = createTestAdapter(
    {
      location: { uri: 'https://mock.url/mock/url' },
      optionalResources: {
        assembly_names: true,
        region_stats: true,
        has_data_for_reference: false,
        reference_sequences: true,
      },
    },
    {
      'https://mock.url/mock/url/features/volvox/21?start=34960388&end=35960388':
        {
          features: [],
        },
      'https://mock.url/mock/url/assembly_names': ['zonker'],
      'https://mock.url/mock/url/reference_sequences/volvox': [],
      'https://mock.url/mock/url/reference_sequences/zonker': ['21'],
      'https://mock.url/mock/url/has_data_for_reference/volvox/ctgA': false,
      'https://mock.url/mock/url/has_data_for_reference/volvox/21': false,
      'https://mock.url/mock/url/has_data_for_reference/zonker/21': true,
      'https://mock.url/mock/url/stats/region/zonker/2?start=1&end=20': {
        featureCount: 20,
        basesCovered: 400,
      },
      'https://mock.url/mock/url/stats/region/zonker/3?start=400&end=500': {
        featureCount: 20,
        basesCovered: 100,
        scoreSum: 400,
        scoreSumSquares: 10000,
        scoreMax: 100,
        scoreMin: 42,
      },
    },
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray.length).toBe(0)

  expect(await adapter.getAssemblyNames()).toStrictEqual(['zonker'])
  expect(await adapter.getRefNames({ assemblyName: 'volvox' })).toStrictEqual(
    [],
  )

  expect(
    await adapter.hasDataForRefName('ctgA', { assemblyName: 'volvox' }),
  ).toBe(false)
  expect(
    await adapter.hasDataForRefName('21', { assemblyName: 'volvox' }),
  ).toBe(false)
  expect(
    await adapter.hasDataForRefName('21', { assemblyName: 'zonker' }),
  ).toBe(true)

  // stats with no scores
  const stats1 = await adapter.getRegionStats({
    assemblyName: 'zonker',
    refName: '2',
    start: 1,
    end: 20,
  })
  expect(isFeatureCoverageStats(stats1)).toBeTruthy()
  expect(isFeatureScoreStats(stats1)).toBeFalsy()
  expect(stats1).toMatchSnapshot()

  // stats with scores
  const stats2 = (await adapter.getRegionStats({
    assemblyName: 'zonker',
    refName: '3',
    start: 400,
    end: 500,
  })) as FeatureScoreStats
  expect(isFeatureCoverageStats(stats2)).toBeTruthy()
  expect(isFeatureScoreStats(stats2)).toBeTruthy()
  expect(stats2.featureDensity).toBeDefined()
  expect(stats2.scoreMean).toBeDefined()
  expect(stats2).toMatchSnapshot()
})
