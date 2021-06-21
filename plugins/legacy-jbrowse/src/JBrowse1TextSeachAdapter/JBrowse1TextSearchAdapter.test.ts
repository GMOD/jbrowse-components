import BaseResult, {
  LocStringResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import path from 'path'
import meta from '../../test_data/names/meta.json'
import first from '../../test_data/names/0.json'
import last from '../../test_data/names/f.json'
import Adapter from './JBrowse1TextSearchAdapter'
import configSchema from './configSchema'

test('adapter can fetch files from names index', async () => {
  function mockFetch(url: string): Promise<Response> {
    let response = {}
    if (url.includes('names/meta.json')) {
      response = meta
    }
    if (url.includes('names/0.json')) {
      response = first
    }
    if (url.includes('names/f.json')) {
      response = last
    }
    return Promise.resolve(new Response(JSON.stringify(response)))
  }

  const rootTemplate = path
    .join(__dirname, '..', '..', '..', '..', 'test_data', 'names')
    .replace(/\\/g, '\\\\')

  const spy = jest.spyOn(global, 'fetch')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy.mockImplementation(mockFetch as any)

  const urlPath = decodeURI(new URL(`file://${rootTemplate}`).href)
  const args = {
    type: 'JBrowse1TextSearchAdapter',
    textSearchAdapterId: 'JBrowse1GenerateNamesAdapterTest',
    namesIndexLocation: {
      uri: urlPath,
    },
  }
  // create adapter
  const adapter = new Adapter(configSchema.create(args))
  // prefix search
  const results = await adapter.searchIndex({
    searchType: 'prefix',
    queryString: 'apple',
  })
  // check results are of type BaseResult for prefix search
  expect(results[0] instanceof BaseResult).toBeTruthy()
  expect(results[0].getLabel()).toEqual('Apple1')
  expect(results[1].getLabel()).toEqual('Apple2')
  expect(results[2].getLabel()).toEqual('Apple3')
  // exact search
  const results2 = await adapter.searchIndex({
    searchType: 'exact',
    queryString: 'apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(5)
  const test2 = results2[0]
  expect(test2 instanceof BaseResult).toBeTruthy()
  expect(test2.getLabel()).toEqual('Apple3')
  expect(test2 instanceof LocStringResult).toBeTruthy()
  expect(test2.getLocation()).toEqual('ctgA:17399-23000')
})
