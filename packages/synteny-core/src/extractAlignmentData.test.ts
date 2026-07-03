import { extractAlignmentData } from './extractAlignmentData.ts'

import type { Feature } from '@jbrowse/core/util'

// Minimal Feature stand-in: extractAlignmentData only reads via feat.get().
function makeFeature(data: Record<string, unknown>): Feature {
  return {
    get: (key: string) => data[key],
  } as unknown as Feature
}

const base = {
  refName: 'chr1',
  start: 100,
  end: 200,
  strand: 1,
  mate: { refName: 'ctgA', start: 300, end: 400 },
}

describe('extractAlignmentData', () => {
  it('maps a mated feature to one alignment', () => {
    const [a] = extractAlignmentData([makeFeature(base)])
    expect(a).toEqual({
      refRefName: 'chr1',
      queryRefName: 'ctgA',
      refStart: 100,
      refEnd: 200,
      queryStart: 300,
      queryEnd: 400,
      strand: 1,
    })
  })

  it('skips features without a mate', () => {
    const { mate, ...noMate } = base
    expect(
      extractAlignmentData([makeFeature(noMate), makeFeature(base)]),
    ).toHaveLength(1)
  })

  it('defaults missing strand to 1', () => {
    const { strand, ...noStrand } = base
    expect(extractAlignmentData([makeFeature(noStrand)])[0]!.strand).toBe(1)
  })

  it('translates both axes back to canonical via the refName maps', () => {
    const [a] = extractAlignmentData([makeFeature(base)], {
      refRefNameMap: { chr1: '1' },
      queryRefNameMap: { ctgA: 'A' },
    })
    expect(a!.refRefName).toBe('1')
    expect(a!.queryRefName).toBe('A')
  })

  it('passes through refNames absent from the maps unchanged', () => {
    const [a] = extractAlignmentData([makeFeature(base)], {
      refRefNameMap: { other: 'x' },
      queryRefNameMap: { other: 'y' },
    })
    expect(a!.refRefName).toBe('chr1')
    expect(a!.queryRefName).toBe('ctgA')
  })

  it('translates only the query axis when only that map is given', () => {
    const [a] = extractAlignmentData([makeFeature(base)], {
      queryRefNameMap: { ctgA: 'A' },
    })
    expect(a!.refRefName).toBe('chr1')
    expect(a!.queryRefName).toBe('A')
  })
})
