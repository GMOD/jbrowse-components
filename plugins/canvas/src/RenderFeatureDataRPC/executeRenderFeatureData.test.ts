// Tests for logic extracted from executeRenderFeatureData.ts.

// Mirrors the showOnlyGenes filter in executeRenderFeatureData:
//   featuresArray.filter(f =>
//     ['gene', 'mRNA', 'transcript', 'CDS'].includes(f.get('type'))
//   )
function passesGeneFilter(type: string) {
  return ['gene', 'mRNA', 'transcript', 'CDS'].includes(type)
}

describe('showOnlyGenes type filter', () => {
  it('keeps top-level gene-like types', () => {
    expect(passesGeneFilter('gene')).toBe(true)
    expect(passesGeneFilter('mRNA')).toBe(true)
    expect(passesGeneFilter('transcript')).toBe(true)
    expect(passesGeneFilter('CDS')).toBe(true)
  })

  it('filters out subfeature and non-gene types', () => {
    expect(passesGeneFilter('exon')).toBe(false)
    expect(passesGeneFilter('UTR')).toBe(false)
    expect(passesGeneFilter('three_prime_UTR')).toBe(false)
    expect(passesGeneFilter('five_prime_UTR')).toBe(false)
    expect(passesGeneFilter('intron')).toBe(false)
    expect(passesGeneFilter('region')).toBe(false)
    expect(passesGeneFilter('match')).toBe(false)
  })
})
