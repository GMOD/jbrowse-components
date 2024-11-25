import path from 'path'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import Adapter from './JBrowse1TextSearchAdapter'
import configSchema from './configSchema'
import first from '../../test_data/names/0.json'
import last from '../../test_data/names/f.json'
import meta from '../../test_data/names/meta.json'

function mockFetch(url: RequestInfo | URL) {
  let response = {}
  if (`${url}`.includes('names/meta.json')) {
    response = meta
  }
  if (`${url}`.includes('names/0.json')) {
    response = first
  }
  if (`${url}`.includes('names/f.json')) {
    response = last
  }
  return Promise.resolve(new Response(JSON.stringify(response)))
}

const rootTemplate = path
  .join(__dirname, '..', '..', '..', '..', 'test_data', 'names')
  .replaceAll('\\', '\\\\')

test('search upper case', async () => {
  const spy = jest.spyOn(global, 'fetch')
  spy.mockImplementation(mockFetch)

  const adapter = new Adapter(
    configSchema.create({
      type: 'JBrowse1TextSearchAdapter',
      textSearchAdapterId: 'JBrowse1GenerateNamesAdapterTest',
      namesIndexLocation: {
        uri: decodeURI(new URL(`file://${rootTemplate}`).href),
        locationType: 'UriLocation',
      },
    }),
  )
  const results = await adapter.searchIndex({
    searchType: 'prefix',
    queryString: 'Apple',
  })
  // check results are of type BaseResult for prefix search
  expect(results.length).toBeGreaterThan(0)
  expect(results[0] instanceof BaseResult).toBeTruthy()
  expect(results[0]!.getLabel()).toEqual('Apple1')
  expect(results[1]!.getLabel()).toEqual('Apple2')
  expect(results[2]!.getLabel()).toEqual('Apple3')

  // exact search
  const results2 = await adapter.searchIndex({
    searchType: 'exact',
    queryString: 'Apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(5)
  expect(results2.length).toBeGreaterThan(0)
  expect(results2[0] instanceof BaseResult).toBeTruthy()
  expect(results2[0]!.getLabel()).toEqual('Apple3')
  expect(results2[0]!.getLocation()).toEqual('ctgA:17399-23000')
})

test('search lower case', async () => {
  const spy = jest.spyOn(global, 'fetch')
  spy.mockImplementation(mockFetch)

  const adapter = new Adapter(
    configSchema.create({
      type: 'JBrowse1TextSearchAdapter',
      textSearchAdapterId: 'JBrowse1GenerateNamesAdapterTest',
      namesIndexLocation: {
        uri: decodeURI(new URL(`file://${rootTemplate}`).href),
        locationType: 'UriLocation',
      },
    }),
  )
  const results = await adapter.searchIndex({
    searchType: 'prefix',
    queryString: 'apple',
  })
  // check results are of type BaseResult for prefix search
  expect(results.length).toBeGreaterThan(0)
  expect(results[0] instanceof BaseResult).toBeTruthy()
  expect(results[0]!.getLabel()).toEqual('Apple1')
  expect(results[1]!.getLabel()).toEqual('Apple2')
  expect(results[2]!.getLabel()).toEqual('Apple3')

  // exact search
  const results2 = await adapter.searchIndex({
    searchType: 'exact',
    queryString: 'apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(5)
  expect(results2.length).toBeGreaterThan(0)
  expect(results2[0] instanceof BaseResult).toBeTruthy()
  expect(results2[0]!.getLabel()).toEqual('Apple3')
  expect(results2[0]!.getLocation()).toEqual('ctgA:17399-23000')
})
