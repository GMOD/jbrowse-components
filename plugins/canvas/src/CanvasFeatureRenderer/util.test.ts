import { findGlyph, builtinGlyphs } from './glyphs'
import { isUTR, truncateLabel } from './util'

import type { RenderConfigContext } from './renderConfig'

// Mock feature factory
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

// Default config context for tests
const defaultConfigContext = {
  transcriptTypes: ['mRNA', 'transcript'],
  containerTypes: ['gene'],
} as RenderConfigContext

describe('findGlyph (glyph matching)', () => {
  describe('CDS features', () => {
    it('returns CDS glyph for type=CDS regardless of subfeatures', () => {
      const feature = createMockFeature({
        type: 'CDS',
        subfeatures: [createMockFeature({ type: 'exon' })],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('CDS')
    })

    it('returns CDS glyph for simple CDS without subfeatures', () => {
      const feature = createMockFeature({ type: 'CDS' })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('CDS')
    })
  })

  describe('Box features (no subfeatures)', () => {
    it('returns Box glyph for simple feature without subfeatures', () => {
      const feature = createMockFeature({ type: 'exon' })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Box')
    })

    it('returns Box glyph for feature with empty subfeatures array', () => {
      const feature = createMockFeature({ type: 'exon', subfeatures: [] })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Box')
    })

    it('returns Box glyph for gene type without subfeatures', () => {
      const feature = createMockFeature({ type: 'gene' })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Box')
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
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('ProcessedTranscript')
    })

    it('returns ProcessedTranscript glyph for transcript with CDS child', () => {
      const feature = createMockFeature({
        type: 'transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('ProcessedTranscript')
    })

    it('returns Segments glyph for mRNA without CDS (non-coding)', () => {
      const feature = createMockFeature({
        type: 'mRNA',
        subfeatures: [
          createMockFeature({ type: 'exon' }),
          createMockFeature({ type: 'exon' }),
        ],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Segments')
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
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Subfeatures')
    })

    it('returns Subfeatures glyph for top-level feature with nested subfeatures', () => {
      const feature = createMockFeature({
        type: 'region',
        parent: () => undefined, // no parent = top level
        subfeatures: [
          createMockFeature({
            type: 'mRNA',
            subfeatures: [createMockFeature({ type: 'exon' })],
          }),
        ],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Subfeatures')
    })

    it('returns Segments glyph for non-top-level feature with nested subfeatures', () => {
      const parentFeature = createMockFeature({ type: 'gene' })
      const feature = createMockFeature({
        type: 'region',
        parent: () => parentFeature, // has parent
        subfeatures: [
          createMockFeature({
            type: 'child',
            subfeatures: [createMockFeature({ type: 'grandchild' })],
          }),
        ],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Segments')
    })

    it('treats feature without parent() method as top-level', () => {
      const feature = createMockFeature({
        type: 'region',
        // parent is undefined (not a function)
        subfeatures: [
          createMockFeature({
            type: 'child',
            subfeatures: [createMockFeature({ type: 'grandchild' })],
          }),
        ],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Subfeatures')
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
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Segments')
    })

    it('returns Segments glyph for exon with simple subfeatures', () => {
      const feature = createMockFeature({
        type: 'exon',
        subfeatures: [createMockFeature({ type: 'part' })],
      })
      const glyph = findGlyph(feature as any, defaultConfigContext, builtinGlyphs)
      expect(glyph.type).toBe('Segments')
    })
  })

  describe('custom transcriptTypes and containerTypes', () => {
    it('respects custom transcriptTypes', () => {
      const customConfig = {
        transcriptTypes: ['custom_transcript'],
        containerTypes: [] as string[],
      } as RenderConfigContext
      const feature = createMockFeature({
        type: 'custom_transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      const glyph = findGlyph(feature as any, customConfig, builtinGlyphs)
      expect(glyph.type).toBe('ProcessedTranscript')
    })

    it('respects custom containerTypes', () => {
      const customConfig = {
        transcriptTypes: [] as string[],
        containerTypes: ['custom_container'],
      } as RenderConfigContext
      const feature = createMockFeature({
        type: 'custom_container',
        subfeatures: [createMockFeature({ type: 'child' })],
      })
      const glyph = findGlyph(feature as any, customConfig, builtinGlyphs)
      expect(glyph.type).toBe('Subfeatures')
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
