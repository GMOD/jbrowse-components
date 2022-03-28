import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import path from 'path'
import Adapter from './TrixTextSearchAdapter'
import configSchema from './configSchema'

test('adapter can fetch output files', async () => {
  const rootTemplate = path
    .join(__dirname, '..', '..', '..', '..', 'test_data', 'volvox', 'trix')
    .replace(/\\/g, '\\\\')

  const urlPath = decodeURI(new URL(`file://${rootTemplate}`).href)
  const args = {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: 'TrixTextSearchAdapterTest',
    ixFilePath: {
      uri: `${urlPath}/volvox.ix`,
      locationType: 'UriLocation',
    },
    ixxFilePath: {
      uri: `${urlPath}/volvox.ixx`,
      locationType: 'UriLocation',
    },
    metaFilePath: {
      uri: `${urlPath}/volvox_meta.json`,
      locationType: 'UriLocation',
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
  expect(results[0].getLabel()).toEqual('Apple2')
  /**
   * Addition of plain text adapter tracks adds an additional entry to both
   * apple2 and apple3. The results are coming from the different tracks
   * indexed, so there's an additional apple2 and apple3 result coming from
   * the gff3Adapter track and another one from the gff3TabixAdapter track.
   */
  expect(results[2].getLabel()).toEqual('Apple3')
  // exact search
  const results2 = await adapter.searchIndex({
    queryString: 'apple3',
  })
  // check results are of type location for exact search
  expect(results2.length).toEqual(2)
  const test2 = results2[0]
  expect(test2 instanceof BaseResult).toBeTruthy()
  expect(test2.getLabel()).toEqual('Apple3')
  expect(test2.getLocation()).toEqual('ctgA:17400..23000')
})
