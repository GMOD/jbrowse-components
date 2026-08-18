import { mockDisplayConfig } from '../testUtils.ts'
import { layoutBox } from './box.ts'
import { layoutCrisprGuide } from './crisprGuide.ts'
import { findGlyph } from './findGlyph.ts'
import { layoutMotif } from './motif.ts'
import { layoutProcessedTranscript } from './processed.ts'
import { layoutRepeatRegion } from './repeatRegion.ts'
import { layoutSegments } from './segments.ts'
import { layoutSubfeatures } from './subfeatures.ts'

import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  subfeatures?: ReturnType<typeof mockFeature>[]
  parent?: Feature
}): Feature {
  const { type, subfeatures = [], parent } = opts
  const f: Feature = {
    get: (key: string) => (key === 'type' ? type : subfeatures),
    id: () => type,
    parent: () => parent,
  } as unknown as Feature
  return f
}

const config = mockDisplayConfig({
  transcriptTypes: ['mRNA'],
  containerTypes: ['proteoform_orf'],
})

describe('findGlyph structural dispatch', () => {
  it('routes a leaf feature to Box', () => {
    expect(findGlyph(mockFeature({ type: 'match' }), config)).toBe(layoutBox)
  })

  it('routes an mRNA with a CDS child to ProcessedTranscript', () => {
    const mRNA = mockFeature({
      type: 'mRNA',
      subfeatures: [
        mockFeature({ type: 'exon' }),
        mockFeature({ type: 'CDS' }),
      ],
    })
    expect(findGlyph(mRNA, config)).toBe(layoutProcessedTranscript)
  })

  it('routes a coding type absent from transcriptTypes to ProcessedTranscript', () => {
    // the whole point of structural dispatch: V_gene_segment / org-specific
    // coding transcripts are no longer enumerated in config yet still get the
    // transcript glyph rather than falling through to Segments
    for (const type of ['V_gene_segment', 'some_org_specific_transcript']) {
      const feature = mockFeature({
        type,
        subfeatures: [
          mockFeature({ type: 'exon' }),
          mockFeature({ type: 'CDS' }),
        ],
      })
      expect(findGlyph(feature, config)).toBe(layoutProcessedTranscript)
    }
  })

  it('routes a prokaryotic gene with a direct CDS child to ProcessedTranscript', () => {
    const gene = mockFeature({
      type: 'gene',
      subfeatures: [mockFeature({ type: 'CDS' })],
    })
    expect(findGlyph(gene, config)).toBe(layoutProcessedTranscript)
  })

  it('routes a gene whose children are containers to Subfeatures', () => {
    const gene = mockFeature({
      type: 'gene',
      subfeatures: [
        mockFeature({
          type: 'mRNA',
          subfeatures: [mockFeature({ type: 'CDS' })],
        }),
      ],
    })
    expect(findGlyph(gene, config)).toBe(layoutSubfeatures)
  })

  it('routes a container of leaf children to Segments', () => {
    const feature = mockFeature({
      type: 'match',
      subfeatures: [
        mockFeature({ type: 'match_part' }),
        mockFeature({ type: 'match_part' }),
      ],
    })
    expect(findGlyph(feature, config)).toBe(layoutSegments)
  })

  it('routes an intact repeat_region to RepeatRegion', () => {
    const feature = mockFeature({
      type: 'repeat_region',
      subfeatures: [
        mockFeature({ type: 'long_terminal_repeat' }),
        mockFeature({ type: 'target_site_duplication' }),
      ],
    })
    expect(findGlyph(feature, config)).toBe(layoutRepeatRegion)
  })

  it('routes a guide_rna to CrisprGuide', () => {
    const feature = mockFeature({
      type: 'guide_rna',
      subfeatures: [mockFeature({ type: 'PAM' })],
    })
    expect(findGlyph(feature, config)).toBe(layoutCrisprGuide)
  })

  // Every other type test (isCDS, isExon, isUTR, the mature-protein set) is
  // case-insensitive; these were not, so a converted annotation writing
  // `Repeat_region` silently fell through to Segments.
  it('matches the semantic types case-insensitively', () => {
    expect(findGlyph(mockFeature({ type: 'Motif' }), config)).toBe(layoutMotif)
    expect(
      findGlyph(
        mockFeature({
          type: 'Guide_RNA',
          subfeatures: [mockFeature({ type: 'PAM' })],
        }),
        config,
      ),
    ).toBe(layoutCrisprGuide)
    expect(
      findGlyph(
        mockFeature({
          type: 'Repeat_Region',
          subfeatures: [mockFeature({ type: 'long_terminal_repeat' })],
        }),
        config,
      ),
    ).toBe(layoutRepeatRegion)
  })

  // `containerTypes` was the last case-SENSITIVE type test here, and it is the
  // one slot two places read: `featureAdmission` lowercases it into the
  // gene-like set `showOnlyGenes` admits by, so a `Proteoform_ORF` was admitted
  // and then refused a stacked glyph — drawn as one flat Segments row with its
  // parts on top of each other. Leaf children, so `hasContainerChildren` cannot
  // rescue it and the slot is the only thing deciding.
  it('matches containerTypes case-insensitively too', () => {
    const orf = (type: string) =>
      mockFeature({
        type,
        subfeatures: [
          mockFeature({ type: 'CDS' }),
          mockFeature({ type: 'CDS' }),
        ],
      })
    expect(findGlyph(orf('proteoform_orf'), config)).toBe(layoutSubfeatures)
    expect(findGlyph(orf('Proteoform_ORF'), config)).toBe(layoutSubfeatures)
  })
})
