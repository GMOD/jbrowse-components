import {
  featureHasCDS,
  featureHasExon,
  featureHasExonOrCDS,
} from './featureTypeUtil.ts'

describe('hasExonOrCDS', () => {
  test('feature with CDS only is true (no exon subfeatures)', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'CDS' }],
    }
    expect(featureHasCDS(feature)).toBe(true)
    expect(featureHasExon(feature)).toBe(false)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })

  test('feature with exon only is true', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'exon' }],
    }
    expect(featureHasExon(feature)).toBe(true)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })

  test('feature with neither is false', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'region',
      subfeatures: [],
    }
    expect(featureHasExonOrCDS(feature)).toBe(false)
  })

  test('mature_protein_region_of_cds counts as CDS', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mature_protein_region_of_cds',
    }
    expect(featureHasCDS(feature)).toBe(true)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })
})
