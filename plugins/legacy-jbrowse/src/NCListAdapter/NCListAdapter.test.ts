import { promises as fsPromises } from 'fs'
import path from 'path'
import { URL } from 'url'
import { toArray } from 'rxjs/operators'
import Adapter from './NCListAdapter'
import configSchema from './configSchema'

test('adapter can fetch features from ensembl_genes test set', async () => {
  const rootTemplate = path
    .join(
      __dirname,
      '..',
      '..',
      'test_data',
      'ensembl_genes',
      '{refseq}',
      'trackData.json',
    )
    .replace(/\\/g, '\\\\')
  await fsPromises.stat(rootTemplate.replace('{refseq}', '21')) // will throw if doesnt exist
  const args = {
    refNames: [],
    rootUrlTemplate: { uri: decodeURI(new URL(`file://${rootTemplate}`).href) },
  }
  const adapter = new Adapter(configSchema.create(args))

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe(`test-21,0,0,19,22,0`)
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(94)
  for (const feature of featuresJsonArray) {
    expect(feature).toMatchSnapshot({ uniqueId: expect.any(String) })
  }

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
