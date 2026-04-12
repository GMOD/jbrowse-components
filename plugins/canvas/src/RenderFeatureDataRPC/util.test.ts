import { layoutBox } from './glyphs/box.ts'
import { findGlyph } from './glyphs/index.ts'
import { layoutMatureProteinRegion } from './glyphs/matureProteinRegion.ts'
import { layoutProcessedTranscript } from './glyphs/processed.ts'
import { layoutSegments } from './glyphs/segments.ts'
import { layoutSubfeatures } from './glyphs/subfeatures.ts'
import { mockDisplayConfig } from './testUtils.ts'
import { isUTR, truncateLabel } from './util.ts'

function createMockFeature(opts: {
  type?: string
  subfeatures?: ReturnType<typeof createMockFeature>[]
  parent?: () => unknown
}) {
  const data: Record<string, unknown> = {
    type: opts.type,
    subfeatures: opts.subfeatures,
  }
  return {
    get: (key: string) => data[key],
    parent: opts.parent,
  }
}

const defaultConfig = mockDisplayConfig({
  transcriptTypes: ['mRNA', 'transcript'],
  containerTypes: ['gene'],
})

const GLYPH_NAMES = new Map([
  [layoutBox, 'Box'],
  [layoutProcessedTranscript, 'ProcessedTranscript'],
  [layoutSegments, 'Segments'],
  [layoutSubfeatures, 'Subfeatures'],
  [layoutMatureProteinRegion, 'MatureProteinRegion'],
])

function glyphType(feature: ReturnType<typeof createMockFeature>, config = defaultConfig) {
  return GLYPH_NAMES.get(findGlyph(feature as any, config))
}

describe('findGlyph (glyph matching)', () => {
  describe('CDS features', () => {
    it('returns Box glyph for type=CDS regardless of subfeatures', () => {
      const feature = createMockFeature({
        type: 'CDS',
        subfeatures: [createMockFeature({ type: 'exon' })],
      })
      expect(glyphType(feature)).toBe('Box')
    })

    it('returns Box glyph for simple CDS without subfeatures', () => {
      const feature = createMockFeature({ type: 'CDS' })
      expect(glyphType(feature)).toBe('Box')
    })
  })

  describe('Box features (no subfeatures)', () => {
    it('returns Box glyph for simple feature without subfeatures', () => {
      const feature = createMockFeature({ type: 'exon' })
      expect(glyphType(feature)).toBe('Box')
    })

    it('returns Box glyph for feature with empty subfeatures array', () => {
      const feature = createMockFeature({ type: 'exon', subfeatures: [] })
      expect(glyphType(feature)).toBe('Box')
    })

    it('returns Box glyph for gene type without subfeatures', () => {
      const feature = createMockFeature({ type: 'gene' })
      expect(glyphType(feature)).toBe('Box')
    })
  })

  describe('ProcessedTranscript (transcript with CDS)', () => {
    it('returns ProcessedTranscript glyph for mRNA with CDS child', () => {
      const feature = createMockFeature({
        type: 'mRNA',
        subfeatures: [
          createMockFeature({ type: 'exon' }),
          createMockFeature({ type: 'CDS' }),
        ],
      })
      expect(glyphType(feature)).toBe('ProcessedTranscript')
    })

    it('returns ProcessedTranscript glyph for transcript with CDS child', () => {
      const feature = createMockFeature({
        type: 'transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      expect(glyphType(feature)).toBe('ProcessedTranscript')
    })

    it('returns Segments glyph for mRNA without CDS (non-coding)', () => {
      const feature = createMockFeature({
        type: 'mRNA',
        subfeatures: [
          createMockFeature({ type: 'exon' }),
          createMockFeature({ type: 'exon' }),
        ],
      })
      expect(glyphType(feature)).toBe('Segments')
    })
  })

  describe('Subfeatures (containers)', () => {
    it('returns Subfeatures glyph for gene type with transcript children', () => {
      const feature = createMockFeature({
        type: 'gene',
        subfeatures: [
          createMockFeature({
            type: 'mRNA',
            subfeatures: [createMockFeature({ type: 'CDS' })],
          }),
        ],
      })
      expect(glyphType(feature)).toBe('Subfeatures')
    })

    it('returns Subfeatures glyph for top-level feature with nested subfeatures', () => {
      const feature = createMockFeature({
        type: 'region',
        parent: () => undefined,
        subfeatures: [
          createMockFeature({
            type: 'mRNA',
            subfeatures: [createMockFeature({ type: 'exon' })],
          }),
        ],
      })
      expect(glyphType(feature)).toBe('Subfeatures')
    })

    it('returns Segments glyph for non-top-level feature with nested subfeatures', () => {
      const parentFeature = createMockFeature({ type: 'gene' })
      const feature = createMockFeature({
        type: 'region',
        parent: () => parentFeature,
        subfeatures: [
          createMockFeature({
            type: 'child',
            subfeatures: [createMockFeature({ type: 'grandchild' })],
          }),
        ],
      })
      expect(glyphType(feature)).toBe('Segments')
    })

    it('treats feature without parent() method as top-level', () => {
      const feature = createMockFeature({
        type: 'region',
        subfeatures: [
          createMockFeature({
            type: 'child',
            subfeatures: [createMockFeature({ type: 'grandchild' })],
          }),
        ],
      })
      expect(glyphType(feature)).toBe('Subfeatures')
    })
  })

  describe('Segments (simple children)', () => {
    it('returns Segments glyph for feature with simple children', () => {
      const feature = createMockFeature({
        type: 'match',
        subfeatures: [
          createMockFeature({ type: 'match_part' }),
          createMockFeature({ type: 'match_part' }),
        ],
      })
      expect(glyphType(feature)).toBe('Segments')
    })

    it('returns Segments glyph for exon with simple subfeatures', () => {
      const feature = createMockFeature({
        type: 'exon',
        subfeatures: [createMockFeature({ type: 'part' })],
      })
      expect(glyphType(feature)).toBe('Segments')
    })
  })

  describe('custom transcriptTypes and containerTypes', () => {
    it('respects custom transcriptTypes', () => {
      const config = mockDisplayConfig({
        transcriptTypes: ['custom_transcript'],
      })
      const feature = createMockFeature({
        type: 'custom_transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      expect(glyphType(feature, config)).toBe('ProcessedTranscript')
    })

    it('respects custom containerTypes', () => {
      const config = mockDisplayConfig({
        transcriptTypes: [],
        containerTypes: ['custom_container'],
      })
      const feature = createMockFeature({
        type: 'custom_container',
        subfeatures: [createMockFeature({ type: 'child' })],
      })
      expect(glyphType(feature, config)).toBe('Subfeatures')
    })
  })
})

describe('isUTR', () => {
  it('detects UTR type', () => {
    expect(isUTR({ get: () => 'UTR' } as any)).toBe(true)
    expect(isUTR({ get: () => 'five_prime_UTR' } as any)).toBe(true)
    expect(isUTR({ get: () => 'three_prime_UTR' } as any)).toBe(true)
    expect(isUTR({ get: () => "5'UTR" } as any)).toBe(true)
    expect(isUTR({ get: () => 'untranslated_region' } as any)).toBe(true)
    expect(isUTR({ get: () => 'untranslated region' } as any)).toBe(true)
  })

  it('rejects non-UTR types', () => {
    expect(isUTR({ get: () => 'exon' } as any)).toBe(false)
    expect(isUTR({ get: () => 'CDS' } as any)).toBe(false)
    expect(isUTR({ get: () => 'mRNA' } as any)).toBe(false)
  })
})

describe('truncateLabel', () => {
  it('does not truncate short labels', () => {
    expect(truncateLabel('short')).toBe('short')
    expect(truncateLabel('exactly50chars'.padEnd(50, 'x'))).toBe(
      'exactly50chars'.padEnd(50, 'x'),
    )
  })

  it('truncates long labels with ellipsis', () => {
    const longLabel = 'A'.repeat(60)
    const result = truncateLabel(longLabel)
    expect(result.length).toBe(50)
    expect(result.endsWith('…')).toBe(true)
  })

  it('respects custom maxLength', () => {
    const label = 'ABCDEFGHIJ'
    expect(truncateLabel(label, 5)).toBe('ABCD…')
  })
})
