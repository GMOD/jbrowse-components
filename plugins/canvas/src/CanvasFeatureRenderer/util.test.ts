import { chooseGlyphType, isUTR, truncateLabel } from './util'

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
}

describe('chooseGlyphType', () => {
  describe('CDS features', () => {
    it('returns CDS for type=CDS regardless of subfeatures', () => {
      const feature = createMockFeature({
        type: 'CDS',
        subfeatures: [createMockFeature({ type: 'exon' })],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('CDS')
    })

    it('returns CDS for simple CDS without subfeatures', () => {
      const feature = createMockFeature({ type: 'CDS' })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('CDS')
    })
  })

  describe('Box features (no subfeatures)', () => {
    it('returns Box for simple feature without subfeatures', () => {
      const feature = createMockFeature({ type: 'exon' })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Box')
    })

    it('returns Box for feature with empty subfeatures array', () => {
      const feature = createMockFeature({ type: 'exon', subfeatures: [] })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Box')
    })

    it('returns Box for gene type without subfeatures', () => {
      const feature = createMockFeature({ type: 'gene' })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Box')
    })
  })

  describe('ProcessedTranscript (transcript with CDS)', () => {
    it('returns ProcessedTranscript for mRNA with CDS child', () => {
      const feature = createMockFeature({
        type: 'mRNA',
        subfeatures: [
          createMockFeature({ type: 'exon' }),
          createMockFeature({ type: 'CDS' }),
        ],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('ProcessedTranscript')
    })

    it('returns ProcessedTranscript for transcript with CDS child', () => {
      const feature = createMockFeature({
        type: 'transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('ProcessedTranscript')
    })

    it('returns Segments for mRNA without CDS (non-coding)', () => {
      const feature = createMockFeature({
        type: 'mRNA',
        subfeatures: [
          createMockFeature({ type: 'exon' }),
          createMockFeature({ type: 'exon' }),
        ],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Segments')
    })
  })

  describe('Subfeatures (containers)', () => {
    it('returns Subfeatures for gene type with transcript children', () => {
      const feature = createMockFeature({
        type: 'gene',
        subfeatures: [
          createMockFeature({
            type: 'mRNA',
            subfeatures: [createMockFeature({ type: 'CDS' })],
          }),
        ],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Subfeatures')
    })

    it('returns Subfeatures for top-level feature with nested subfeatures', () => {
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
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Subfeatures')
    })

    it('returns Segments for non-top-level feature with nested subfeatures', () => {
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
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Segments')
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
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Subfeatures')
    })
  })

  describe('Segments (simple children)', () => {
    it('returns Segments for feature with simple children', () => {
      const feature = createMockFeature({
        type: 'match',
        subfeatures: [
          createMockFeature({ type: 'match_part' }),
          createMockFeature({ type: 'match_part' }),
        ],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Segments')
    })

    it('returns Segments for exon with simple subfeatures', () => {
      const feature = createMockFeature({
        type: 'exon',
        subfeatures: [createMockFeature({ type: 'part' })],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: defaultConfigContext,
        }),
      ).toBe('Segments')
    })
  })

  describe('custom transcriptTypes and containerTypes', () => {
    it('respects custom transcriptTypes', () => {
      const customConfig = {
        transcriptTypes: ['custom_transcript'],
        containerTypes: [] as string[],
      }
      const feature = createMockFeature({
        type: 'custom_transcript',
        subfeatures: [createMockFeature({ type: 'CDS' })],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: customConfig,
        }),
      ).toBe('ProcessedTranscript')
    })

    it('respects custom containerTypes', () => {
      const customConfig = {
        transcriptTypes: [] as string[],
        containerTypes: ['custom_container'],
      }
      const feature = createMockFeature({
        type: 'custom_container',
        subfeatures: [createMockFeature({ type: 'child' })],
      })
      expect(
        chooseGlyphType({
          feature: feature as any,
          configContext: customConfig,
        }),
      ).toBe('Subfeatures')
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
