import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './SPARQLAdapter'
import configSchema from './configSchema'
import emptyQueryResponse from './test_data/emptyQueryResponse.json'
import queryResponse from './test_data/queryResponse.json'
import refNamesResponse from './test_data/refNamesResponse.json'

// window.fetch = jest.fn(url => new Promise(resolve => resolve()))

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  function mockFetch(url: RequestInfo | URL) {
    let response = {}
    if (`${url}`.includes('chr1')) {
      response = queryResponse
    }
    if (`${url}`.includes('chr80')) {
      response = emptyQueryResponse
    } else if (`${url}`.includes('fakeRefNamesQuery')) {
      response = refNamesResponse
    }

    return Promise.resolve(new Response(JSON.stringify(response)))
  }

  const spy = jest.spyOn(global, 'fetch')
  spy.mockImplementation(mockFetch)
  const adapter = new Adapter(
    configSchema.create({
      endpoint: {
        uri: 'http://somesite.com/sparql',
        locationType: 'UriLocation',
      },
      queryTemplate: 'fakeSPARQLQuery-start{start}-end{end}-{refName}',
      refNamesQueryTemplate: 'fakeRefNamesQuery',
      additionalQueryParams: ['format=json'],
      refNames: [],
    }),
  )

  const refNames = await adapter.getRefNames()
  expect(spy).toHaveBeenLastCalledWith(
    'http://somesite.com/sparql?query=fakeRefNamesQuery&format=json',
    {
      headers: { accept: 'application/json,application/sparql-results+json' },
      stopToken: undefined,
    },
  )
  expect(refNames.length).toBe(17)
  expect(refNames[0]).toBe('NC_004353.4')

  const features = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray).toMatchSnapshot()
  expect(spy).toHaveBeenLastCalledWith(
    'http://somesite.com/sparql?query=fakeSPARQLQuery-start0-end20000-chr1&format=json',
    {
      headers: { accept: 'application/json,application/sparql-results+json' },
      stopToken: undefined,
    },
  )

  const featuresNonExist = adapter.getFeatures({
    refName: 'chr80',
    start: 0,
    end: 20000,
  })
  const featuresArrayNonExist = await firstValueFrom(
    featuresNonExist.pipe(toArray()),
  )
  expect(featuresArrayNonExist).toEqual([])
  expect(spy).toHaveBeenLastCalledWith(
    'http://somesite.com/sparql?query=fakeSPARQLQuery-start0-end20000-chr80&format=json',
    {
      headers: { accept: 'application/json,application/sparql-results+json' },
      stopToken: undefined,
    },
  )
})
