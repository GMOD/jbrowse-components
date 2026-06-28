import { chromosomeColor } from './drawSourceChrom.ts'

describe('chromosomeColor', () => {
  test('is deterministic per chromosome name', () => {
    expect(chromosomeColor('chr1')).toBe(chromosomeColor('chr1'))
    expect(chromosomeColor('chrX')).toBe(chromosomeColor('chrX'))
  })

  test('distinct names get distinct hues', () => {
    const names = ['chr1', 'chr2', 'chr3', 'chrX', 'scaffold_12']
    const colors = new Set(names.map(chromosomeColor))
    expect(colors.size).toBe(names.length)
  })

  test('emits a valid hsl string', () => {
    expect(chromosomeColor('chr7')).toMatch(/^hsl\(\d{1,3}, 62%, 55%\)$/)
  })
})
