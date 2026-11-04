import { createPeptideCache } from './peptideCache.ts'

const peptide = (protein: string) => ({ protein })

test('evicts the least recently used entry, not the oldest written', () => {
  const cache = createPeptideCache(4)
  cache.set('a', peptide('AA'))
  cache.set('b', peptide('BB'))
  cache.get('a')
  cache.set('c', peptide('CC'))
  expect(cache.get('a')?.protein).toBe('AA')
  expect(cache.get('b')).toBeUndefined()
  expect(cache.get('c')?.protein).toBe('CC')
})

test('evicts by residues, so one long protein can displace several', () => {
  const cache = createPeptideCache(6)
  cache.set('a', peptide('AA'))
  cache.set('b', peptide('BB'))
  cache.set('a', peptide('AAA'))
  cache.set('long', peptide('LLLL'))
  expect(cache.get('b')).toBeUndefined()
  expect(cache.get('a')).toBeUndefined()
  expect(cache.get('long')?.protein).toBe('LLLL')
})
