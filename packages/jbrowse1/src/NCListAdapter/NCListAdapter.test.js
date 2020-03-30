import { promises as fsPromises } from 'fs'
import path from 'path'
import { URL } from 'url'
import { toArray } from 'rxjs/operators'
import objectHash from 'object-hash'

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
  await fsPromises.stat(rootTemplate.replace('{refseq}', '21')) // will throw if doesnt exist
  const args = {
    rootUrlTemplate: decodeURI(new URL(`file://${rootTemplate}`).href),
  }
  const hash = objectHash(args)
  const adapter = new Adapter(args)

  const features = await adapter.getFeatures({
    refName: '21',
    start: 34960388,
    end: 35960388,
    assemblyName: 'hg38',
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe(`${hash}-21,0,0,19,22,0`)
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(94)
  for (const feature of featuresJsonArray) {
    expect(feature).toMatchSnapshot({ uniqueId: expect.any(String) })
  }

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
