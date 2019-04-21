import { toArray } from 'rxjs/operators'

import Adapter from './NCListAdapter'

test('adapter can fetch features from ensembl_genes test set', async () => {
  const adapter = new Adapter({
    rootUrlTemplate: `file://${process.cwd()}/test_data/ensembl_genes/{refseq}/trackData.json`,
  })

  const features = await adapter.getFeatures({
    refName: '21',
    start: 34960388,
    end: 35960388,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('21')
  expect(featuresArray[0].id()).toBe('0,0,19,22,0')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(94)
  expect(featuresJsonArray).toMatchSnapshot()

  expect(await adapter.hasDataForRefName('ctgA')).toBe(false)
  expect(await adapter.hasDataForRefName('21')).toBe(true)
  expect(await adapter.hasDataForRefName('20')).toBe(false)
})
