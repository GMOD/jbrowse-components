import {
  collapsibleIntronsOf,
  featureHasSplicedParts,
  getSplicedParts,
  getTranscripts,
  hasCollapsibleIntrons,
  hasIntrons,
} from './splicedParts.ts'

import type { Feature } from '@jbrowse/core/util'

function mockFeature(
  subfeatures: { type: string; start: number; end: number }[],
): Feature {
  return {
    get: (key: string) =>
      key === 'subfeatures'
        ? subfeatures.map(sf => ({
            get: (k: string) =>
              k === 'type'
                ? sf.type
                : k === 'start'
                  ? sf.start
                  : k === 'end'
                    ? sf.end
                    : undefined,
          }))
        : undefined,
  } as unknown as Feature
}

interface FeatFields {
  type?: string
  subfeatures?: Feature[]
  start?: number
  end?: number
}

function feat(fields: FeatFields = {}): Feature {
  return {
    get: (k: keyof FeatFields) => fields[k],
  } as unknown as Feature
}

describe('getSplicedParts', () => {
  it('extracts exons from transcripts', () => {
    const transcripts = [
      feat({
        subfeatures: [
          feat({ type: 'exon' }),
          feat({ type: 'intron' }),
          feat({ type: 'exon' }),
        ],
      }),
    ]
    expect(getSplicedParts(transcripts)).toHaveLength(2)
  })

  it('extracts CDS from transcripts', () => {
    const transcripts = [
      feat({
        subfeatures: [feat({ type: 'CDS' }), feat({ type: 'UTR' })],
      }),
    ]
    expect(getSplicedParts(transcripts)).toHaveLength(1)
  })

  it('handles transcripts with no subfeatures', () => {
    expect(getSplicedParts([feat()])).toHaveLength(0)
  })
})

describe('featureHasSplicedParts', () => {
  it.each(['exon', 'CDS', 'match_part', 'block'])(
    'returns true when subfeatures include a %s',
    type => {
      expect(
        featureHasSplicedParts(feat({ subfeatures: [feat({ type })] })),
      ).toBe(true)
    },
  )

  it('returns false when subfeatures contain no spliced part', () => {
    expect(
      featureHasSplicedParts(feat({ subfeatures: [feat({ type: 'UTR' })] })),
    ).toBe(false)
  })

  it('returns false when feature has no subfeatures', () => {
    expect(featureHasSplicedParts(feat())).toBe(false)
  })
})

describe('getTranscripts', () => {
  it('returns [] for undefined feature', () => {
    expect(getTranscripts(undefined)).toEqual([])
  })

  it('wraps a transcript-shaped feature (exons directly under it) in [feature]', () => {
    const f = feat({ subfeatures: [feat({ type: 'exon' })] })
    expect(getTranscripts(f)).toEqual([f])
  })

  it('returns subfeatures for a gene-shaped feature (transcripts under it)', () => {
    const transcript = feat({ subfeatures: [feat({ type: 'exon' })] })
    expect(getTranscripts(feat({ subfeatures: [transcript] }))).toEqual([
      transcript,
    ])
  })

  it('drops gene subfeatures that carry no exon/CDS of their own', () => {
    const transcript = feat({ subfeatures: [feat({ type: 'exon' })] })
    const childless = feat({ type: 'tRNA' })
    expect(
      getTranscripts(feat({ subfeatures: [transcript, childless] })),
    ).toEqual([transcript])
  })

  it('prefers the mRNA children of a gene that also carries stray exons', () => {
    const transcript = feat({
      type: 'mRNA',
      subfeatures: [feat({ type: 'exon' })],
    })
    const gene = feat({
      type: 'gene',
      subfeatures: [feat({ type: 'exon' }), transcript],
    })
    expect(getTranscripts(gene)).toEqual([transcript])
  })

  it('stays one transcript when its exons nest their own CDS rows', () => {
    const mrna = feat({
      type: 'mRNA',
      subfeatures: [
        feat({ type: 'exon', subfeatures: [feat({ type: 'CDS' })] }),
        feat({ type: 'exon' }),
      ],
    })
    expect(getTranscripts(mrna)).toEqual([mrna])
  })

  it('wraps a match whose children are match_parts', () => {
    const match = feat({
      type: 'cDNA_match',
      subfeatures: [feat({ type: 'match_part' })],
    })
    expect(getTranscripts(match)).toEqual([match])
  })

  it('wraps a BED12 feature whose children are blocks', () => {
    const bed = feat({ subfeatures: [feat({ type: 'block' })] })
    expect(getTranscripts(bed)).toEqual([bed])
  })
})

describe('hasIntrons', () => {
  it('returns false for empty transcripts', () => {
    expect(hasIntrons([])).toBe(false)
  })

  it('returns false for transcript with no subfeatures', () => {
    const transcript = { get: () => undefined } as unknown as Feature
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

  it('counts match_part and block children the way it counts exons', () => {
    expect(
      hasIntrons([
        mockFeature([
          { type: 'match_part', start: 100, end: 200 },
          { type: 'match_part', start: 300, end: 400 },
        ]),
      ]),
    ).toBe(true)
    expect(
      hasIntrons([
        mockFeature([
          { type: 'block', start: 100, end: 200 },
          { type: 'block', start: 300, end: 400 },
        ]),
      ]),
    ).toBe(true)
  })
})

describe('hasCollapsibleIntrons', () => {
  // The retained-intron gene: the union of the two isoforms' exons is
  // contiguous, so the whole-gene scope collapses nothing while the spliced
  // isoform the dropdown offers collapses fine.
  const retained = mockFeature([{ type: 'exon', start: 100, end: 400 }])
  const spliced = mockFeature([
    { type: 'exon', start: 100, end: 200 },
    { type: 'exon', start: 300, end: 400 },
  ])

  it('passes a gene whose union is contiguous but whose isoform is spliced', () => {
    expect(hasIntrons([retained, spliced])).toBe(false)
    expect(hasCollapsibleIntrons([retained, spliced])).toBe(true)
  })

  it('still refuses a gene with no intron in any scope', () => {
    expect(hasCollapsibleIntrons([retained])).toBe(false)
    expect(hasCollapsibleIntrons([])).toBe(false)
  })
})

describe('collapsibleIntronsOf', () => {
  const twoExons = [
    feat({ type: 'exon', start: 100, end: 200 }),
    feat({ type: 'exon', start: 300, end: 400 }),
  ]

  it.each(['gene', 'mRNA', 'lnc_RNA', 'cDNA_match', 'EST_match', 'match'])(
    'answers for a spliced %s',
    type => {
      expect(collapsibleIntronsOf(feat({ type, subfeatures: twoExons }))).toBe(
        true,
      )
    },
  )

  it.each([
    'exon',
    'match_part',
    'repeat_region',
    'intergenic_region',
    undefined,
  ])('refuses %s whatever its parts look like', type => {
    expect(collapsibleIntronsOf(feat({ type, subfeatures: twoExons }))).toBe(
      false,
    )
  })

  it('reads the gap through the transcripts of a gene', () => {
    const gene = (exons: Feature[]) =>
      feat({
        type: 'gene',
        subfeatures: [feat({ type: 'mRNA', subfeatures: exons })],
      })

    expect(collapsibleIntronsOf(gene(twoExons))).toBe(true)
    expect(
      collapsibleIntronsOf(
        gene([feat({ type: 'exon', start: 100, end: 400 })]),
      ),
    ).toBe(false)
  })

  it('refuses a gene carrying no parts at all', () => {
    expect(collapsibleIntronsOf(feat({ type: 'gene' }))).toBe(false)
  })
})
