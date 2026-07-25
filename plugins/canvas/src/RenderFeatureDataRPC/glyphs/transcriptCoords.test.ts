import { mockDisplayConfig } from '../testUtils.ts'
import { findGlyph } from './findGlyph.ts'
import { transcriptCoords } from './transcriptCoords.ts'

import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  start: number
  end: number
  strand?: number
  subfeatures?: Feature[]
}): Feature {
  const { type, start, end, strand = 1, subfeatures = [] } = opts
  const data: Record<string, unknown> = {
    type,
    start,
    end,
    strand,
    subfeatures,
  }
  return {
    get: (key: string) => data[key],
    id: () => `${type}-${start}-${end}`,
    parent: () => undefined,
  } as unknown as Feature
}

const config = mockDisplayConfig()

function coordsOf(feature: Feature) {
  return transcriptCoords(findGlyph(feature, config)({ feature, config }))
}

function exonsOf(feature: Feature) {
  return coordsOf(feature)?.exons
}

// exon rows present: the authoritative source, used as-is
function exonTranscript(strand: number) {
  return mockFeature({
    type: 'mRNA',
    start: 0,
    end: 500,
    strand,
    subfeatures: [
      mockFeature({ type: 'exon', start: 0, end: 100, strand }),
      mockFeature({ type: 'exon', start: 200, end: 300, strand }),
      mockFeature({ type: 'exon', start: 400, end: 500, strand }),
      mockFeature({ type: 'CDS', start: 50, end: 450, strand }),
    ],
  })
}

describe('transcriptCoords', () => {
  it('numbers + strand exons left to right', () => {
    expect(exonsOf(exonTranscript(1))).toEqual([0, 100, 200, 300, 400, 500])
  })

  it('numbers - strand exons from the highest coordinate', () => {
    expect(exonsOf(exonTranscript(-1))).toEqual([400, 500, 200, 300, 0, 100])
  })

  // The default subParts renders CDS + UTR rows, not exons. The coding and
  // untranslated halves of one exon abut, so merging reconstructs the exon —
  // three exons here, not the five boxes actually drawn.
  it('merges abutting CDS/UTR rows back into whole exons', () => {
    const transcript = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'five_prime_UTR', start: 0, end: 50 }),
        mockFeature({ type: 'CDS', start: 50, end: 100 }),
        mockFeature({ type: 'CDS', start: 200, end: 300 }),
        mockFeature({ type: 'CDS', start: 400, end: 450 }),
        mockFeature({ type: 'three_prime_UTR', start: 450, end: 500 }),
      ],
    })
    expect(exonsOf(transcript)).toEqual([0, 100, 200, 300, 400, 500])
  })

  // Reported even though "exon 1/1" is worth nothing to show: the c. coordinate
  // is built from the same walk and is perfectly meaningful here, so the display
  // decides what to say, not the data.
  it('reports the single exon of an unspliced transcript', () => {
    const transcript = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 100,
      subfeatures: [mockFeature({ type: 'CDS', start: 0, end: 100 })],
    })
    expect(exonsOf(transcript)).toEqual([0, 100])
  })

  it('carries the coding extent, and omits it for a non-coding transcript', () => {
    expect(coordsOf(exonTranscript(1))?.coding).toEqual([50, 450])
    const lncRNA = mockFeature({
      type: 'lnc_RNA',
      start: 0,
      end: 300,
      subfeatures: [
        mockFeature({ type: 'exon', start: 0, end: 100 }),
        mockFeature({ type: 'exon', start: 200, end: 300 }),
      ],
    })
    expect(coordsOf(lncRNA)?.coding).toBeUndefined()
  })

  // A match → match_part chain has blocks, not exons; numbering them would be a
  // lie, so the Segments glyph only reports bounds when real exon rows exist.
  it('reports nothing for a non-transcript segmented feature', () => {
    const match = mockFeature({
      type: 'match',
      start: 0,
      end: 300,
      subfeatures: [
        mockFeature({ type: 'match_part', start: 0, end: 100 }),
        mockFeature({ type: 'match_part', start: 200, end: 300 }),
      ],
    })
    expect(exonsOf(match)).toBeUndefined()
  })

  it('reports exons for a non-coding transcript that carries exon rows', () => {
    const lncRNA = mockFeature({
      type: 'lnc_RNA',
      start: 0,
      end: 300,
      subfeatures: [
        mockFeature({ type: 'exon', start: 0, end: 100 }),
        mockFeature({ type: 'exon', start: 200, end: 300 }),
      ],
    })
    expect(exonsOf(lncRNA)).toEqual([0, 100, 200, 300])
  })
})
