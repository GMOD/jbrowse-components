import {
  collapsibleIntronsOf,
  featureHasSplicedParts,
  getSplicedParts,
  getTranscripts,
  hasCollapsibleIntrons,
  hasIntrons,
} from './splicedParts.ts'

import type { Feature } from '@jbrowse/core/util'

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

const part = (type: string, start: number, end: number) =>
  feat({ type, start, end })

const transcript = (...parts: Feature[]) => feat({ subfeatures: parts })

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
    const tx = feat({ subfeatures: [feat({ type: 'exon' })] })
    expect(getTranscripts(feat({ subfeatures: [tx] }))).toEqual([tx])
  })

  it('drops gene subfeatures that carry no exon/CDS of their own', () => {
    const tx = feat({ subfeatures: [feat({ type: 'exon' })] })
    const childless = feat({ type: 'tRNA' })
    expect(getTranscripts(feat({ subfeatures: [tx, childless] }))).toEqual([tx])
  })

  it('prefers the mRNA children of a gene that also carries stray exons', () => {
    const tx = feat({
      type: 'mRNA',
      subfeatures: [feat({ type: 'exon' })],
    })
    const gene = feat({
      type: 'gene',
      subfeatures: [feat({ type: 'exon' }), tx],
    })
    expect(getTranscripts(gene)).toEqual([tx])
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
    expect(hasIntrons([feat()])).toBe(false)
  })

  it('returns false for single exon', () => {
    expect(hasIntrons([transcript(part('exon', 100, 200))])).toBe(false)
  })

  it('returns false for two overlapping exons', () => {
    expect(
      hasIntrons([transcript(part('exon', 100, 200), part('exon', 150, 250))]),
    ).toBe(false)
  })

  it('returns false for two adjacent exons', () => {
    expect(
      hasIntrons([transcript(part('exon', 100, 200), part('exon', 200, 300))]),
    ).toBe(false)
  })

  it('returns true for two non-overlapping exons', () => {
    expect(
      hasIntrons([transcript(part('exon', 100, 200), part('exon', 300, 400))]),
    ).toBe(true)
  })

  it('returns true for multiple exons with introns', () => {
    expect(
      hasIntrons([
        transcript(
          part('exon', 100, 200),
          part('exon', 300, 400),
          part('exon', 500, 600),
        ),
      ]),
    ).toBe(true)
  })

  it('works with CDS instead of exons', () => {
    expect(
      hasIntrons([transcript(part('CDS', 100, 200), part('CDS', 300, 400))]),
    ).toBe(true)
  })

  it('ignores non-exon/CDS subfeatures', () => {
    expect(
      hasIntrons([
        transcript(
          part('exon', 100, 200),
          part('intron', 200, 300),
          part('UTR', 300, 400),
        ),
      ]),
    ).toBe(false)
  })

  it('works with multiple transcripts', () => {
    expect(
      hasIntrons([
        transcript(part('exon', 100, 200)),
        transcript(part('exon', 300, 400)),
      ]),
    ).toBe(true)
  })

  it('handles overlapping exons from multiple transcripts', () => {
    expect(
      hasIntrons([
        transcript(part('exon', 100, 200)),
        transcript(part('exon', 150, 250)),
      ]),
    ).toBe(false)
  })

  it.each(['match_part', 'block'])(
    'counts %s children the way it counts exons',
    type => {
      expect(
        hasIntrons([transcript(part(type, 100, 200), part(type, 300, 400))]),
      ).toBe(true)
    },
  )
})

describe('hasCollapsibleIntrons', () => {
  // The retained-intron gene: the union of the two isoforms' exons is
  // contiguous, so the whole-gene scope collapses nothing while the spliced
  // isoform the dropdown offers collapses fine.
  const retained = transcript(part('exon', 100, 400))
  const spliced = transcript(part('exon', 100, 200), part('exon', 300, 400))

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
  const twoExons = [part('exon', 0, 100), part('exon', 400, 500)]

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
    const gene = (parts: Feature[]) =>
      feat({
        type: 'gene',
        subfeatures: [feat({ type: 'mRNA', subfeatures: parts })],
      })

    expect(collapsibleIntronsOf(gene(twoExons))).toBe(true)
    expect(collapsibleIntronsOf(gene([part('exon', 0, 500)]))).toBe(false)
  })

  it('refuses a gene carrying no parts at all', () => {
    expect(collapsibleIntronsOf(feat({ type: 'gene' }))).toBe(false)
  })
})
