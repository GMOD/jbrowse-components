import BaseResult, {
  LocStringResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import path from 'path'
import outIx from '../../test_data/out.ix'
import outIxx from '../../test_data/out.ixx'
import Adapter from './TrixTextSearchAdapter'
import configSchema from './configSchema'

test('adapter can fetch output files', async () => {
  function mockFetch(url: string): Promise<Response> {
    let response = {}
    if (url.includes('out.ix')) {
      response = outIx
    }
    if (url.includes('out.ixx')) {
      response = outIxx
    }
    return Promise.resolve(new Response(JSON.stringify(response)))
  }

  const rootTemplate = path
    .join(__dirname, '..', '..', '..', '..', 'test_data', 'volvox')
    .replace(/\\/g, '\\\\')

  const spy = jest.spyOn(global, 'fetch')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy.mockImplementation(mockFetch as any)

  const urlPath = decodeURI(new URL(`file://${rootTemplate}`).href)
  const args = {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: 'TrixTextSearchAdapterTest',
    ixFilePath: {
      uri: `${urlPath}/out.ix`,
    },
    ixxFilePath: {
      uri: `${urlPath}/out.ixx`,
    },
  }
  // create adapter
  const adapter = new Adapter(configSchema.create(args))
  // prefix search
  const results = await adapter.searchIndex({
    queryString: 'apple',
  })
  // check results are of type BaseResult for prefix search
  expect(results[0] instanceof BaseResult).toBeTruthy()
  expect(results[0].getLabel()).toEqual('Apple1')
  expect(results[1].getLabel()).toEqual('Apple2')
  expect(results[2].getLabel()).toEqual('Apple3')
  // exact search
  const results2 = await adapter.searchIndex({
    queryString: 'apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(1)
  const test2 = results2[0]
  expect(test2 instanceof BaseResult).toBeTruthy()
  expect(test2.getLabel()).toEqual('Apple3')
  expect(test2 instanceof LocStringResult).toBeTruthy()
  expect(test2.getLocation()).toEqual('ctgA:17400..23000')
})
