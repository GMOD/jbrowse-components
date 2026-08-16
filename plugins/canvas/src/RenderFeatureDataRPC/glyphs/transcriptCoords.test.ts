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

function coordsOf(feature: Feature, over?: Partial<typeof config>) {
  const c = { ...config, ...over }
  return transcriptCoords(findGlyph(feature, c)({ feature, config: c }))
}

function exonsOf(feature: Feature, over?: Partial<typeof config>) {
  return coordsOf(feature, over)?.exons
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

  // A CDS-only transcript's untranslated overhang is evidenced only by its own
  // bounds, so those cap the outermost exons — the same reconstruction the
  // renderer's implied UTRs make, but derived here from the feature rather than
  // borrowed from what got drawn.
  it('stretches a CDS-only transcript to its own bounds', () => {
    const transcript = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'CDS', start: 50, end: 100 }),
        mockFeature({ type: 'CDS', start: 200, end: 300 }),
        mockFeature({ type: 'CDS', start: 400, end: 450 }),
      ],
    })
    expect(exonsOf(transcript)).toEqual([0, 100, 200, 300, 400, 500])
  })

  // A GFF3 that annotates one UTR row and not the other used to lose the
  // untranslated overhang on BOTH sides — the reconstruction was all-or-nothing
  // on "are there any UTR rows at all". So a transcript whose 3' UTR is only
  // evidenced by its own bounds ended at the stop codon, and every `c.*n`
  // position on it read as off the transcript entirely.
  it('stretches to its own bounds on whichever side no row covers', () => {
    const transcript = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'five_prime_UTR', start: 0, end: 50 }),
        mockFeature({ type: 'CDS', start: 50, end: 100 }),
        mockFeature({ type: 'CDS', start: 200, end: 300 }),
        mockFeature({ type: 'CDS', start: 400, end: 450 }),
      ],
    })
    expect(exonsOf(transcript)).toEqual([0, 100, 200, 300, 400, 500])
  })

  // The other half of that rule: a UTR row spliced across an intron is the only
  // evidence of where the untranslated part actually runs, so the bounds must
  // NOT be used to bridge it.
  it('leaves a spliced UTR alone rather than bridging it from the bounds', () => {
    const transcript = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'CDS', start: 50, end: 100 }),
        mockFeature({ type: 'CDS', start: 200, end: 300 }),
        mockFeature({ type: 'CDS', start: 400, end: 450 }),
        mockFeature({ type: 'three_prime_UTR', start: 450, end: 500 }),
        mockFeature({ type: 'five_prime_UTR', start: 0, end: 20 }),
        mockFeature({ type: 'five_prime_UTR', start: 30, end: 50 }),
      ],
    })
    expect(exonsOf(transcript)).toEqual([0, 20, 30, 100, 200, 300, 400, 500])
  })

  // The exons a coordinate is counted on come from the FEATURE, never from what
  // the glyph drew. `subParts` and `impliedUTRs` decide which rows are rendered;
  // routing coordinates through that list made an HGVS position change when
  // someone edited a rendering slot — `subParts: 'CDS'` alone silently dropped
  // every UTR position off transcripts annotated without exon rows.
  it('ignores the display slots that decide which subparts are drawn', () => {
    const cdsUtr = mockFeature({
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
    const whole = [0, 100, 200, 300, 400, 500]
    expect(exonsOf(cdsUtr, { subParts: 'CDS' })).toEqual(whole)
    expect(exonsOf(cdsUtr, { impliedUTRs: false })).toEqual(whole)

    const cdsOnly = mockFeature({
      type: 'mRNA',
      start: 0,
      end: 200,
      subfeatures: [mockFeature({ type: 'CDS', start: 50, end: 150 })],
    })
    expect(exonsOf(cdsOnly, { impliedUTRs: false })).toEqual([0, 200])
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
