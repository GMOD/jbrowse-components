import {
  featureHasExonsOrCDS,
  getExonsAndCDS,
  getTranscripts,
  hasIntrons,
} from './util.ts'

function mockFeature(data: Record<string, unknown>) {
  return {
    get: (key: string) => data[key],
    id: () => data.uniqueId ?? 'mock-id',
  } as any
}

function mockGene(transcripts: ReturnType<typeof mockFeature>[]) {
  return mockFeature({
    type: 'gene',
    subfeatures: transcripts,
  })
}

function mockTranscript(
  exonRanges: [number, number][],
  cdsRanges: [number, number][] = [],
) {
  const subs = [
    ...exonRanges.map(([start, end]) =>
      mockFeature({ type: 'exon', start, end }),
    ),
    ...cdsRanges.map(([start, end]) =>
      mockFeature({ type: 'CDS', start, end }),
    ),
  ]
  return mockFeature({
    type: 'mRNA',
    subfeatures: subs,
    start: Math.min(...exonRanges.map(r => r[0])),
    end: Math.max(...exonRanges.map(r => r[1])),
  })
}

describe('featureHasExonsOrCDS', () => {
  it('returns true for feature with exon subfeatures', () => {
    const f = mockFeature({
      subfeatures: [mockFeature({ type: 'exon' })],
    })
    expect(featureHasExonsOrCDS(f)).toBe(true)
  })

  it('returns true for feature with CDS subfeatures', () => {
    const f = mockFeature({
      subfeatures: [mockFeature({ type: 'CDS' })],
    })
    expect(featureHasExonsOrCDS(f)).toBe(true)
  })

  it('returns false for feature with no exon/CDS subfeatures', () => {
    const f = mockFeature({
      subfeatures: [mockFeature({ type: 'mRNA' })],
    })
    expect(featureHasExonsOrCDS(f)).toBe(false)
  })

  it('returns false for feature with no subfeatures', () => {
    const f = mockFeature({})
    expect(featureHasExonsOrCDS(f)).toBe(false)
  })
})

describe('getTranscripts', () => {
  it('returns the feature itself if it has exons', () => {
    const tx = mockTranscript([[100, 200]])
    const result = getTranscripts(tx)
    expect(result).toEqual([tx])
  })

  it('returns subfeatures for a gene-level feature', () => {
    const tx1 = mockTranscript([[100, 200]])
    const tx2 = mockTranscript([[100, 300]])
    const gene = mockGene([tx1, tx2])
    const result = getTranscripts(gene)
    expect(result).toEqual([tx1, tx2])
  })

  it('returns empty array for undefined input', () => {
    expect(getTranscripts(undefined)).toEqual([])
  })
})

describe('hasIntrons', () => {
  it('returns true when exons have gaps between them', () => {
    const tx = mockTranscript([
      [100, 200],
      [300, 400],
    ])
    expect(hasIntrons([tx])).toBe(true)
  })

  it('returns false for a single exon', () => {
    const tx = mockTranscript([[100, 400]])
    expect(hasIntrons([tx])).toBe(false)
  })

  it('returns false for contiguous exons (no intron gap)', () => {
    const tx = mockTranscript([
      [100, 200],
      [200, 300],
    ])
    expect(hasIntrons([tx])).toBe(false)
  })

  it('returns false for empty transcript list', () => {
    expect(hasIntrons([])).toBe(false)
  })

  it('returns true when introns exist across multiple transcripts', () => {
    const tx1 = mockTranscript([[100, 200]])
    const tx2 = mockTranscript([[400, 500]])
    expect(hasIntrons([tx1, tx2])).toBe(true)
  })

  it('returns false when multiple transcripts fill the gaps', () => {
    const tx1 = mockTranscript([[100, 250]])
    const tx2 = mockTranscript([[200, 300]])
    expect(hasIntrons([tx1, tx2])).toBe(false)
  })

  it('detects introns using CDS subfeatures too', () => {
    const tx = mockFeature({
      type: 'mRNA',
      subfeatures: [
        mockFeature({ type: 'CDS', start: 100, end: 200 }),
        mockFeature({ type: 'CDS', start: 400, end: 500 }),
      ],
    })
    expect(hasIntrons([tx])).toBe(true)
  })
})

describe('getExonsAndCDS', () => {
  it('extracts exon and CDS subfeatures from transcripts', () => {
    const tx = mockTranscript(
      [
        [100, 200],
        [300, 400],
      ],
      [[150, 350]],
    )
    const result = getExonsAndCDS([tx])
    expect(result.length).toBe(3)
    expect(result.filter(f => f.get('type') === 'exon').length).toBe(2)
    expect(result.filter(f => f.get('type') === 'CDS').length).toBe(1)
  })

  it('filters out non-exon/CDS subfeatures', () => {
    const tx = mockFeature({
      type: 'mRNA',
      subfeatures: [
        mockFeature({ type: 'exon', start: 100, end: 200 }),
        mockFeature({ type: 'intron', start: 200, end: 300 }),
        mockFeature({ type: 'CDS', start: 100, end: 200 }),
      ],
    })
    const result = getExonsAndCDS([tx])
    expect(result.length).toBe(2)
  })

  it('returns empty for transcripts with no subfeatures', () => {
    const tx = mockFeature({ type: 'mRNA' })
    expect(getExonsAndCDS([tx])).toEqual([])
  })
})
