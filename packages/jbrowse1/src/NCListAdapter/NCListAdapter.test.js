import { promises as fsPromises } from 'fs'
import path from 'path'
import { URL } from 'url'
import { toArray } from 'rxjs/operators'

import Adapter from './NCListAdapter'

test('adapter can fetch features from ensembl_genes test set', async () => {
  const rootTemplate = path
    .join(
      process.cwd(),
      'packages',
      'jbrowse1',
      'test_data',
      'ensembl_genes',
      '{refseq}',
      'trackData.json',
    )
    .replace(/\\/g, '\\\\')
  await fsPromises.stat(rootTemplate.replace('{refseq}', 21)) // will throw if doesnt exist
  const adapter = new Adapter({
    rootUrlTemplate: decodeURI(new URL(`file://${rootTemplate}`).href),
    configId: 'test_adapter',
  })

  const features = await adapter.getFeatures({
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe('test_adapter-0,0,19,22,0')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(94)
  expect(featuresJsonArray).toMatchSnapshot()

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
