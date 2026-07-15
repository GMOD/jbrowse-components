import { sortSourcesByGenotype } from './MultiSampleVariantBaseModel.ts'

import type { ProcessedSource } from './types.ts'

const sample = (
  name: string,
  sampleName: string,
  extra?: Partial<ProcessedSource>,
): ProcessedSource => ({ name, sampleName, ...extra })

describe('sortSourcesByGenotype', () => {
  test('puts samples with more non-ref alleles first', () => {
    const sources = [sample('A', 'A'), sample('B', 'B'), sample('C', 'C')]
    const genotypes = { A: '0/0', B: '1/1', C: '0/1' }
    const result = sortSourcesByGenotype(sources, genotypes)
    expect(result.map(s => s.name)).toEqual(['B', 'C', 'A'])
  })

  test('missing genotype falls back to "./.": sorted last', () => {
    const sources = [sample('A', 'A'), sample('B', 'B'), sample('C', 'C')]
    const genotypes = { A: '0/1', B: '1/1' } // C missing
    const result = sortSourcesByGenotype(sources, genotypes)
    expect(result.map(s => s.name)).toEqual(['B', 'A', 'C'])
  })

  // Regression: previously the sort looked up `info.genotypes[a.name]`, but
  // in phased mode `name` is "<sample> HP<n>" while the genotype map is keyed
  // by sample name. Result: every key missed, sort was a no-op.
  test('phased rows look up genotypes by sampleName, not haplotype name', () => {
    const sources = [
      sample('A HP0', 'A', { HP: 0 }),
      sample('A HP1', 'A', { HP: 1 }),
      sample('B HP0', 'B', { HP: 0 }),
      sample('B HP1', 'B', { HP: 1 }),
    ]
    const genotypes = { A: '0/0', B: '1|1' }
    const result = sortSourcesByGenotype(sources, genotypes)
    // B's two haplotypes come first (they share genotype 1|1), then A's.
    expect(result.slice(0, 2).every(s => s.sampleName === 'B')).toBe(true)
    expect(result.slice(2).every(s => s.sampleName === 'A')).toBe(true)
  })

  test('does not mutate the input array', () => {
    const sources = [sample('A', 'A'), sample('B', 'B')]
    const before = sources.map(s => s.name)
    sortSourcesByGenotype(sources, { A: '0/1', B: '0/0' })
    expect(sources.map(s => s.name)).toEqual(before)
  })
})
