import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import { refNameMapKey } from './refNameMapKey.ts'

const conf = { type: 'MultiPairwiseSyntenyAdapter', adapters: [] }

// a selection loads its own map, and the same selection in another order
// finds it; the adapter alone is the key it always was
test('a lane selection is part of the map key, unordered', () => {
  const eight = refNameMapKey(conf, { haplotypes: ['panTro6', 'mm39'] })
  expect(refNameMapKey(conf, { haplotypes: ['mm39', 'panTro6'] })).toBe(eight)
  expect(refNameMapKey(conf, { haplotypes: ['mm39'] })).not.toBe(eight)
  expect(refNameMapKey(conf, {})).toBe(adapterConfigCacheKey(conf))
})
