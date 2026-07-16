import createJexlInstance from '@jbrowse/core/util/jexl'

import {
  FEATURE_DEFAULT_COLOR,
  UTR_DEFAULT_COLOR,
} from './featureColors.ts'
import { layoutBox } from './glyphs/box.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { layoutMatureProteinRegion } from './glyphs/matureProteinRegion.ts'
import { layoutProcessedTranscript } from './glyphs/processed.ts'
import { layoutSegments } from './glyphs/segments.ts'
import { layoutSubfeatures } from './glyphs/subfeatures.ts'
import { mockDisplayConfig } from './testUtils.ts'
import { getBoxColor, isUTR, truncateLabel } from './util.ts'

import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

function createMockFeature(opts: {
  type?: string
  subfeatures?: Feature[]
  parent?: () => Feature | undefined
  attrs?: Record<string, unknown>
}): Feature {
  const data: Record<string, unknown> = {
    type: opts.type,
    subfeatures: opts.subfeatures,
    ...opts.attrs,
  }
  return {
    get: (key: string) => data[key],
    parent: opts.parent,
  } as unknown as Feature
}

// A BED12 gene as the glyph actually sees it: itemRgb rides on the mRNA parent
// and the drawn box is a child that carries none of it.
function bed12Child(childType: string, parentItemRgb?: string): Feature {
  const parent = createMockFeature({
    type: 'mRNA',
    attrs: { itemRgb: parentItemRgb },
  })
  return createMockFeature({ type: childType, parent: () => parent })
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

function glyphType(feature: Feature, config = defaultConfig) {
  return GLYPH_NAMES.get(findGlyph(feature, config))
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
    expect(isUTR(createMockFeature({ type: 'UTR' }))).toBe(true)
    expect(isUTR(createMockFeature({ type: 'five_prime_UTR' }))).toBe(true)
    expect(isUTR(createMockFeature({ type: 'three_prime_UTR' }))).toBe(true)
    expect(isUTR(createMockFeature({ type: "5'UTR" }))).toBe(true)
    expect(isUTR(createMockFeature({ type: 'untranslated_region' }))).toBe(true)
    expect(isUTR(createMockFeature({ type: 'untranslated region' }))).toBe(true)
  })

  it('rejects non-UTR types', () => {
    expect(isUTR(createMockFeature({ type: 'exon' }))).toBe(false)
    expect(isUTR(createMockFeature({ type: 'CDS' }))).toBe(false)
    expect(isUTR(createMockFeature({ type: 'mRNA' }))).toBe(false)
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

describe('getBoxColor (BED itemRgb)', () => {
  const theme = { palette: { framesCDS: [] } } as unknown as Theme
  const jexl = createJexlInstance()

  function boxColor(feature: Feature, config = mockDisplayConfig()) {
    return getBoxColor({ feature, config, colorByCDS: false, theme, jexl })
  }

  it('inherits itemRgb from the parent for a drawn exon', () => {
    // the box the glyph draws is the child, which carries no itemRgb of its own
    expect(boxColor(bed12Child('exon', '227,26,28'))).toBe('227,26,28')
  })

  it('colors UTRs with itemRgb too, matching UCSC whole-item coloring', () => {
    expect(boxColor(bed12Child('five_prime_UTR', '227,26,28'))).toBe(
      '227,26,28',
    )
  })

  it('an explicit color slot beats itemRgb', () => {
    const config = mockDisplayConfig({ color: 'red' })
    expect(boxColor(bed12Child('exon', '227,26,28'), config)).toBe('red')
  })

  it('an explicit utrColor restores the contrasting-UTR look', () => {
    const config = mockDisplayConfig({ utrColor: 'cyan' })
    expect(boxColor(bed12Child('five_prime_UTR', '227,26,28'), config)).toBe(
      'cyan',
    )
    // the exon still takes itemRgb — the slots are independent
    expect(boxColor(bed12Child('exon', '227,26,28'), config)).toBe('227,26,28')
  })

  it('a placeholder itemRgb leaves the defaults alone', () => {
    // every itemRgb in the volvox-bed12 fixture is this placeholder; honoring it
    // would paint an ordinary BED12 gene track black
    expect(boxColor(bed12Child('exon', '0,0,0'))).toBe(FEATURE_DEFAULT_COLOR)
    expect(boxColor(bed12Child('five_prime_UTR', '0'))).toBe(UTR_DEFAULT_COLOR)
  })

  it('no itemRgb anywhere on the chain keeps the slot defaults', () => {
    expect(boxColor(bed12Child('exon'))).toBe(FEATURE_DEFAULT_COLOR)
    expect(boxColor(bed12Child('five_prime_UTR'))).toBe(UTR_DEFAULT_COLOR)
  })

  it('a parentless feature with its own itemRgb still works (flat BED9)', () => {
    const flat = createMockFeature({
      type: 'block',
      attrs: { itemRgb: '31,120,180' },
    })
    expect(boxColor(flat)).toBe('31,120,180')
  })
})
