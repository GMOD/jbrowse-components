import { SimpleFeature } from '@jbrowse/core/util'

import { fetchVariantFeatures } from './fetchVariantFeatures.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

function feat(id: string, start: number, end: number) {
  return new SimpleFeature({ id, data: { refName: 'ctgA', start, end } })
}

test('a record the merge emits once per spanned region comes back once', async () => {
  const del = feat('del', 900, 3500)
  const adapter = {
    getFeaturesInMultipleRegionsArray: async () => [
      feat('snp1', 100, 101),
      del,
      feat('snp2', 3100, 3101),
      del,
    ],
  } as unknown as BaseFeatureDataAdapter
  const features = await fetchVariantFeatures(
    adapter,
    [
      { refName: 'ctgA', start: 0, end: 2000, assemblyName: 'a' },
      { refName: 'ctgA', start: 3000, end: 6000, assemblyName: 'a' },
    ],
    {},
  )
  expect(features.map(f => f.id())).toEqual(['snp1', 'del', 'snp2'])
})
