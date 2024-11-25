import path from 'path'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import Adapter from './TrixTextSearchAdapter'
import configSchema from './configSchema'

test('adapter can fetch output files', async () => {
  const args = {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: 'TrixTextSearchAdapterTest',
    ixFilePath: {
      localPath: path.resolve(__dirname, 'test_data/volvox.ix'),
      locationType: 'LocalPathLocation',
    },
    ixxFilePath: {
      localPath: path.resolve(__dirname, 'test_data/volvox.ixx'),
      locationType: 'LocalPathLocation',
    },
    metaFilePath: {
      localPath: path.resolve(__dirname, 'test_data/volvox_meta.json'),
      locationType: 'LocalPathLocation',
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
  expect(results[0]!.getLabel()).toEqual('Apple2')
  expect(results[1]!.getLabel()).toEqual('Apple3')
  // exact search
  const results2 = await adapter.searchIndex({
    queryString: 'apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(1)
  const test2 = results2[0]
  expect(test2 instanceof BaseResult).toBeTruthy()
  expect(test2!.getLabel()).toEqual('Apple3')
  expect(test2!.getLocation()).toEqual('ctgA:17400..23000')
})
