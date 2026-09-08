import { createTestEnvironment } from '../testEnv.ts'
import {
  buildCollapsedRegions,
  buildCollapsedViewSnapshot,
  collapsedRegionsFor,
  featureHasSplicedParts,
  getSplicedParts,
  getTranscripts,
  replaceIntrons,
} from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

interface FeatFields {
  type?: string
  subfeatures?: Feature[]
  refName?: string
  start?: number
  end?: number
}

function feat(fields: FeatFields = {}): Feature {
  return {
    get: (k: keyof FeatFields) => fields[k],
  } as unknown as Feature
}

// ctgB is short enough for a padded exon to run off the end of it, which is
// what the clamping tests need.
const CONTIGS = [
  { refName: 'ctgA', start: 0, end: 50_000 },
  { refName: 'ctgB', start: 0, end: 120 },
]

const assembly = {
  name: 'volvox',
  getCanonicalRefName2: (r: string) => r,
  regions: CONTIGS,
  getRegionForRefName: (r: string) => CONTIGS.find(c => c.refName === r),
} as unknown as Assembly

function collapsedRegionsOf(opts: {
  transcripts: Feature[]
  flip: boolean
  padding?: number
}) {
  const result = collapsedRegionsFor({ assembly, padding: 20, ...opts })
  if ('error' in result) {
    throw new Error(result.error)
  }
  return result.regions
}

function intronArgs(opts: {
  transcripts: Feature[]
  flip: boolean
  padding?: number
}) {
  return {
    view: createTestEnvironment().createDisplay().view,
    regions: collapsedRegionsOf(opts),
    trackId: 'test_track',
    soloFeatureId: undefined,
    label: 'myGene',
  }
}

describe('CollapseIntrons utilities', () => {
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

  describe('buildCollapsedRegions', () => {
    const args = { refName: 'ctgA', assembly }

    it('pads each exon by the window size', () => {
      const regions = buildCollapsedRegions({
        intervals: [{ start: 1000, end: 1100 }],
        padding: 50,
        ...args,
      })
      expect(regions).toEqual([
        { refName: 'ctgA', assemblyName: 'volvox', start: 950, end: 1150 },
      ])
    })

    it('collapses a wide intron into separate regions', () => {
      const regions = buildCollapsedRegions({
        intervals: [
          { start: 0, end: 100 },
          { start: 900, end: 1000 },
        ],
        padding: 100,
        ...args,
      })
      expect(regions).toHaveLength(2)
    })

    it('merges exons whose padded windows overlap (intron < 2*padding)', () => {
      const regions = buildCollapsedRegions({
        intervals: [
          { start: 0, end: 100 },
          { start: 250, end: 350 },
        ],
        padding: 100,
        ...args,
      })
      expect(regions).toHaveLength(1)
      expect(regions[0]).toMatchObject({ start: 0, end: 450 })
    })

    it('keeps introns between 2*padding and 4*padding collapsed (regression: no double-padding)', () => {
      const regions = buildCollapsedRegions({
        intervals: [
          { start: 0, end: 100 },
          { start: 400, end: 500 },
        ],
        padding: 100,
        ...args,
      })
      expect(regions).toHaveLength(2)
    })

    it('drops an exon the contig does not reach, rather than inverting it', () => {
      const regions = buildCollapsedRegions({
        intervals: [
          { start: 10, end: 90 },
          { start: 500, end: 600 },
        ],
        padding: 5,
        refName: 'ctgB',
        assembly,
      })
      expect(regions).toEqual([
        { refName: 'ctgB', assemblyName: 'volvox', start: 5, end: 95 },
      ])
    })

    it('clamps padded regions to the chromosome bounds', () => {
      const regions = buildCollapsedRegions({
        intervals: [{ start: 10, end: 90 }],
        padding: 50,
        refName: 'ctgB',
        assembly,
      })
      expect(regions).toEqual([
        { refName: 'ctgB', assemblyName: 'volvox', start: 0, end: 120 },
      ])
    })
  })

  describe('the framing the snapshot carries', () => {
    const transcripts = [
      feat({
        refName: 'ctgA',
        subfeatures: [
          feat({ type: 'exon', start: 0, end: 100 }),
          feat({ type: 'exon', start: 5000, end: 5100 }),
        ],
      }),
    ]

    it('frames the collapsed regions, not the window it was launched from', () => {
      const snap = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: false }),
      )

      expect(snap.windowWidthBp).toBe(260)
      expect(snap.windowStartBp).toBe(0)
    })

    it('names no bpPerPx/offsetPx, which the view would ignore here anyway', () => {
      const snap: Record<string, unknown> = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: false }),
      )

      expect(snap.bpPerPx).toBeUndefined()
      expect(snap.offsetPx).toBeUndefined()
    })

    it('frames the same as the in-place button, which takes the other route', () => {
      const { view } = createTestEnvironment().createDisplay()
      replaceIntrons({ ...intronArgs({ transcripts, flip: false }), view })
      const snap = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: false }),
      )

      expect(view.windowWidthBp).toBe(snap.windowWidthBp)
      expect(view.windowStartBp).toBe(snap.windowStartBp)
    })

    it('floors the window at the zoom-in limit for a tiny region set, and centers it', () => {
      // 10bp is past the view's 1/50 bp-per-px zoom floor, so the fit cannot be
      // exact and the content is centered in what it does not fill.
      const snap = buildCollapsedViewSnapshot(
        intronArgs({
          transcripts: [
            feat({
              refName: 'ctgA',
              subfeatures: [feat({ type: 'exon', start: 0, end: 10 })],
            }),
          ],
          flip: false,
          padding: 0,
        }),
      )

      expect(snap.windowWidthBp).toBe(800 / 50)
      expect(snap.windowStartBp).toBe((10 - 800 / 50) / 2)
    })
  })

  describe('no collapsible intervals', () => {
    const errorFor = (transcripts: Feature[]) =>
      collapsedRegionsFor({ transcripts, assembly, padding: 20, flip: false })

    it('reports having found no exons, rather than an empty region set', () => {
      expect(errorFor([feat({ refName: 'ctgA', type: 'tRNA' })])).toEqual({
        error: expect.stringMatching(/No exons, CDS or blocks/),
      })
    })

    it('reports a missing refName rather than guessing one', () => {
      expect(
        errorFor([feat({ subfeatures: [feat({ type: 'exon' })] })]),
      ).toEqual({ error: expect.stringMatching(/refName/) })
    })

    it('names the contig when every exon was past the end of it', () => {
      expect(
        errorFor([
          feat({
            refName: 'ctgA',
            subfeatures: [
              feat({ type: 'exon', start: 60_000, end: 60_100 }),
              feat({ type: 'exon', start: 70_000, end: 70_100 }),
            ],
          }),
        ]),
      ).toEqual({ error: expect.stringMatching(/past the end of ctgA/) })
    })
  })

  describe('flip', () => {
    const transcripts = [
      feat({
        refName: 'ctgA',
        subfeatures: [
          feat({ type: 'exon', start: 0, end: 100 }),
          feat({ type: 'exon', start: 5000, end: 5100 }),
        ],
      }),
    ]

    it('leaves regions in genomic order when off', () => {
      expect(collapsedRegionsOf({ transcripts, flip: false })).toEqual([
        { refName: 'ctgA', assemblyName: 'volvox', start: 0, end: 120 },
        { refName: 'ctgA', assemblyName: 'volvox', start: 4980, end: 5120 },
      ])
    })

    it('reverses the region order and marks every region reversed when on', () => {
      expect(collapsedRegionsOf({ transcripts, flip: true })).toEqual([
        {
          refName: 'ctgA',
          assemblyName: 'volvox',
          start: 4980,
          end: 5120,
          reversed: true,
        },
        {
          refName: 'ctgA',
          assemblyName: 'volvox',
          start: 0,
          end: 120,
          reversed: true,
        },
      ])
    })

    it('frames the same span either way (flip is order-only, not zoom)', () => {
      const plain = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: false }),
      )
      const flipped = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: true }),
      )

      expect(flipped.windowWidthBp).toBe(plain.windowWidthBp)
      expect(flipped.windowStartBp).toBe(plain.windowStartBp)
    })
  })
})
