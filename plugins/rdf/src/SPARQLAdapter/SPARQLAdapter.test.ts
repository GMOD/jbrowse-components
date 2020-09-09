import { toArray } from 'rxjs/operators'
import 'whatwg-fetch'
import Adapter from './SPARQLAdapter'
import emptyQueryResponse from './test_data/emptyQueryResponse.json'
import queryResponse from './test_data/queryResponse.json'
import refNamesResponse from './test_data/refNamesResponse.json'
import 'core-js/stable'

import configSchema from './configSchema'

// window.fetch = jest.fn(url => new Promise(resolve => resolve()))

test('adapter can fetch variants from volvox.vcf.gz', async () => {
  function mockFetch(url: string): Promise<Response> {
    let response = {}
    if (url.includes('chr1')) response = queryResponse
    if (url.includes('chr80')) response = emptyQueryResponse
    else if (url.includes('fakeRefNamesQuery')) response = refNamesResponse

    return Promise.resolve(new Response(JSON.stringify(response)))
  }

  // @ts-ignore
  const spy = jest.spyOn(global, 'fetch')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy.mockImplementation(mockFetch as any)
  const adapter = new Adapter(
    configSchema.create({
      endpoint: { uri: 'http://somesite.com/sparql' },
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
      signal: undefined,
    },
  )
  expect(refNames.length).toBe(17)
  expect(refNames[0]).toBe('NC_004353.4')

  const features = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 20000,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()
  expect(spy).toHaveBeenLastCalledWith(
    'http://somesite.com/sparql?query=fakeSPARQLQuery-start0-end20000-chr1&format=json',
    {
      headers: { accept: 'application/json,application/sparql-results+json' },
      signal: undefined,
    },
  )

  const featuresNonExist = adapter.getFeatures({
    refName: 'chr80',
    start: 0,
    end: 20000,
  })
  const featuresArrayNonExist = await featuresNonExist
    .pipe(toArray())
    .toPromise()
  expect(featuresArrayNonExist).toEqual([])
  expect(spy).toHaveBeenLastCalledWith(
    'http://somesite.com/sparql?query=fakeSPARQLQuery-start0-end20000-chr80&format=json',
    {
      headers: { accept: 'application/json,application/sparql-results+json' },
      signal: undefined,
    },
  )
})
