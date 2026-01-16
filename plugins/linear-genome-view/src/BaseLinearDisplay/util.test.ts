import { hasIntrons } from './util.ts'

function mockFeature(subfeatures: { type: string; start: number; end: number }[]) {
  return {
    get: (key: string) => {
      if (key === 'subfeatures') {
        return subfeatures.map(sf => ({
          get: (k: string) => {
            if (k === 'type') {
              return sf.type
            }
            if (k === 'start') {
              return sf.start
            }
            if (k === 'end') {
              return sf.end
            }
            return undefined
          },
        }))
      }
      return undefined
    },
  } as any
}

describe('hasIntrons', () => {
  it('returns false for empty transcripts', () => {
    expect(hasIntrons([])).toBe(false)
  })

  it('returns false for transcript with no subfeatures', () => {
    const transcript = { get: () => undefined } as any
    expect(hasIntrons([transcript])).toBe(false)
  })

  it('returns false for single exon', () => {
    const transcript = mockFeature([{ type: 'exon', start: 100, end: 200 }])
    expect(hasIntrons([transcript])).toBe(false)
  })

  it('returns false for two overlapping exons', () => {
    const transcript = mockFeature([
      { type: 'exon', start: 100, end: 200 },
      { type: 'exon', start: 150, end: 250 },
    ])
    expect(hasIntrons([transcript])).toBe(false)
  })

  it('returns false for two adjacent exons', () => {
    const transcript = mockFeature([
      { type: 'exon', start: 100, end: 200 },
      { type: 'exon', start: 200, end: 300 },
    ])
    expect(hasIntrons([transcript])).toBe(false)
  })

  it('returns true for two non-overlapping exons', () => {
    const transcript = mockFeature([
      { type: 'exon', start: 100, end: 200 },
      { type: 'exon', start: 300, end: 400 },
    ])
    expect(hasIntrons([transcript])).toBe(true)
  })

  it('returns true for multiple exons with introns', () => {
    const transcript = mockFeature([
      { type: 'exon', start: 100, end: 200 },
      { type: 'exon', start: 300, end: 400 },
      { type: 'exon', start: 500, end: 600 },
    ])
    expect(hasIntrons([transcript])).toBe(true)
  })

  it('works with CDS instead of exons', () => {
    const transcript = mockFeature([
      { type: 'CDS', start: 100, end: 200 },
      { type: 'CDS', start: 300, end: 400 },
    ])
    expect(hasIntrons([transcript])).toBe(true)
  })

  it('ignores non-exon/CDS subfeatures', () => {
    const transcript = mockFeature([
      { type: 'exon', start: 100, end: 200 },
      { type: 'intron', start: 200, end: 300 },
      { type: 'UTR', start: 300, end: 400 },
    ])
    expect(hasIntrons([transcript])).toBe(false)
  })

  it('works with multiple transcripts', () => {
    const transcript1 = mockFeature([{ type: 'exon', start: 100, end: 200 }])
    const transcript2 = mockFeature([{ type: 'exon', start: 300, end: 400 }])
    expect(hasIntrons([transcript1, transcript2])).toBe(true)
  })

  it('handles overlapping exons from multiple transcripts', () => {
    const transcript1 = mockFeature([{ type: 'exon', start: 100, end: 200 }])
    const transcript2 = mockFeature([{ type: 'exon', start: 150, end: 250 }])
    expect(hasIntrons([transcript1, transcript2])).toBe(false)
  })
})
