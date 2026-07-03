import { getSubparts } from './filterSubparts.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  start: number
  end: number
  strand?: number
  refName?: string
  subfeatures?: ReturnType<typeof mockFeature>[]
}): Feature {
  const {
    type,
    start,
    end,
    strand = 1,
    refName = 'chr1',
    subfeatures = [],
  } = opts
  const f = {
    get: (key: string) => {
      const map: Record<string, unknown> = {
        type,
        start,
        end,
        strand,
        refName,
        subfeatures,
      }
      return map[key]
    },
    id: () => `${type}-${start}-${end}`,
    parent: () => undefined,
  }
  return f as unknown as Feature
}

function typesOf(feats: Feature[]) {
  return feats.map(f => f.get('type')).sort()
}

// exon spanning the CDS with no explicit UTR features: the UTR regions are
// implied from the exon/CDS difference.
function transcript(type: string, cdsType = 'CDS') {
  return mockFeature({
    type,
    start: 100,
    end: 500,
    subfeatures: [
      mockFeature({ type: 'exon', start: 100, end: 500 }),
      mockFeature({ type: cdsType, start: 200, end: 400 }),
    ],
  })
}

describe('getSubparts implied UTRs', () => {
  const config = mockDisplayConfig({
    transcriptTypes: ['mRNA', 'transcript', 'primary_transcript'],
  })

  it('implies UTRs for mRNA', () => {
    expect(typesOf(getSubparts(transcript('mRNA'), config))).toEqual([
      'CDS',
      'five_prime_UTR',
      'three_prime_UTR',
    ])
  })

  it('implies UTRs for primary_transcript (was previously skipped)', () => {
    expect(
      typesOf(getSubparts(transcript('primary_transcript'), config)),
    ).toEqual(['CDS', 'five_prime_UTR', 'three_prime_UTR'])
  })

  it('implies UTRs around a lowercase cds', () => {
    expect(typesOf(getSubparts(transcript('mRNA', 'cds'), config))).toEqual([
      'cds',
      'five_prime_UTR',
      'three_prime_UTR',
    ])
  })

  it('flips 5p/3p assignment on the minus strand', () => {
    const minus = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 500,
      strand: -1,
      subfeatures: [
        mockFeature({ type: 'exon', start: 100, end: 500, strand: -1 }),
        mockFeature({ type: 'CDS', start: 200, end: 400, strand: -1 }),
      ],
    })
    const result = getSubparts(minus, config)
    const left = result.find(f => f.get('start') === 100)
    const right = result.find(f => f.get('end') === 500)
    // upstream (left) on the minus strand is the 3' end
    expect(left!.get('type')).toBe('three_prime_UTR')
    expect(right!.get('type')).toBe('five_prime_UTR')
  })

  it('implies UTRs structurally regardless of feature type', () => {
    // getSubparts only runs for features findGlyph routes to the processed-
    // transcript glyph (a direct CDS child), so UTR synthesis is structural, not
    // type-gated: even a bare `gene` with direct exon+CDS children
    // (prokaryote-style) gets implied UTRs.
    expect(typesOf(getSubparts(transcript('gene'), config))).toEqual([
      'CDS',
      'five_prime_UTR',
      'three_prime_UTR',
    ])
  })

  it('keeps explicit UTRs and does not synthesize duplicates', () => {
    const tx = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'five_prime_UTR', start: 100, end: 200 }),
        mockFeature({ type: 'CDS', start: 200, end: 400 }),
        mockFeature({ type: 'three_prime_UTR', start: 400, end: 500 }),
      ],
    })
    expect(typesOf(getSubparts(tx, config))).toEqual([
      'CDS',
      'five_prime_UTR',
      'three_prime_UTR',
    ])
  })

  it('does not duplicate explicit UTRs even when impliedUTRs is forced on', () => {
    // impliedUTRs config previously bypassed the !hasUTRs guard, so a transcript
    // with explicit UTRs but no exon subfeatures got a second, parent-derived
    // set of UTRs pushed on top of the real ones.
    const forced = mockDisplayConfig({
      transcriptTypes: ['mRNA', 'transcript', 'primary_transcript'],
      impliedUTRs: true,
    })
    const tx = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 500,
      subfeatures: [
        mockFeature({ type: 'five_prime_UTR', start: 100, end: 200 }),
        mockFeature({ type: 'CDS', start: 200, end: 400 }),
        mockFeature({ type: 'three_prime_UTR', start: 400, end: 500 }),
      ],
    })
    expect(typesOf(getSubparts(tx, forced))).toEqual([
      'CDS',
      'five_prime_UTR',
      'three_prime_UTR',
    ])
  })
})
