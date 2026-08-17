import { createTestEnvironment } from '../testEnv.ts'
import {
  buildCollapsedRegions,
  buildCollapsedViewSnapshot,
  featureHasExonsOrCDS,
  getExonsAndCDS,
  getTranscripts,
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

const assembly = {
  name: 'volvox',
  getCanonicalRefName2: (r: string) => r,
  regions: [{ refName: 'ctgA', start: 0, end: 50_000 }],
} as unknown as Assembly

function intronArgs({
  transcripts,
  flip,
  padding = 20,
}: {
  transcripts: Feature[]
  flip: boolean
  padding?: number
}) {
  return {
    view: createTestEnvironment().createDisplay().view,
    transcripts,
    assembly,
    padding,
    flip,
    trackId: 'test_track',
    soloFeatureId: undefined,
    label: 'myGene',
  }
}

// buildMergedRegions is private, so the regions it produces are read back off
// the snapshot the "Open in new view" action builds from them.
function collapsedRegionsOf(opts: { transcripts: Feature[]; flip: boolean }) {
  return buildCollapsedViewSnapshot(intronArgs(opts)).displayedRegions
}

describe('CollapseIntrons utilities', () => {
  describe('getExonsAndCDS', () => {
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
      expect(getExonsAndCDS(transcripts)).toHaveLength(2)
    })

    it('extracts CDS from transcripts', () => {
      const transcripts = [
        feat({
          subfeatures: [feat({ type: 'CDS' }), feat({ type: 'UTR' })],
        }),
      ]
      expect(getExonsAndCDS(transcripts)).toHaveLength(1)
    })

    it('handles transcripts with no subfeatures', () => {
      expect(getExonsAndCDS([feat()])).toHaveLength(0)
    })
  })

  describe('featureHasExonsOrCDS', () => {
    it('returns true when subfeatures include an exon', () => {
      expect(
        featureHasExonsOrCDS(feat({ subfeatures: [feat({ type: 'exon' })] })),
      ).toBe(true)
    })

    it('returns false when subfeatures contain neither exon nor CDS', () => {
      expect(
        featureHasExonsOrCDS(feat({ subfeatures: [feat({ type: 'UTR' })] })),
      ).toBe(false)
    })

    it('returns false when feature has no subfeatures', () => {
      expect(featureHasExonsOrCDS(feat())).toBe(false)
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
      // a childless tRNA alongside a real transcript: keeping it would offer a
      // table row whose collapse yields an empty region set
      const transcript = feat({ subfeatures: [feat({ type: 'exon' })] })
      const childless = feat({ type: 'tRNA' })
      expect(
        getTranscripts(feat({ subfeatures: [transcript, childless] })),
      ).toEqual([transcript])
    })
  })

  describe('buildCollapsedRegions', () => {
    const args = { refName: 'chr1', assemblyName: 'hg19' }

    it('pads each exon by the window size', () => {
      const regions = buildCollapsedRegions({
        intervals: [{ start: 1000, end: 1100 }],
        padding: 50,
        ...args,
      })
      expect(regions).toEqual([
        { refName: 'chr1', assemblyName: 'hg19', start: 950, end: 1150 },
      ])
    })

    it('collapses a wide intron into separate regions', () => {
      // gap = 800, well beyond any padding window -> stays collapsed (2 regions)
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
      // gap = 150, 2*padding = 200, so 150 < 200 -> windows overlap, merge.
      // The padded low end (0 - 100 = -100) is floored at 0 (interbase min)
      // even though no chromosome bounds are passed here.
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
      // gap = 300 sits in the old broken window (>2p, <4p). Must stay 2 regions.
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

    it('clamps padded regions to the chromosome bounds', () => {
      // exon near coordinate 0 + padding would go negative; end would run past
      // the contig length without clamping
      const regions = buildCollapsedRegions({
        intervals: [{ start: 10, end: 90 }],
        padding: 50,
        bounds: { start: 0, end: 120 },
        ...args,
      })
      expect(regions).toEqual([
        { refName: 'chr1', assemblyName: 'hg19', start: 0, end: 120 },
      ])
    })
  })

  // The view persists its viewport as a genomic window, so that is what the
  // snapshot has to name. A `bpPerPx`/`offsetPx` pair alongside an inherited
  // `windowWidthBp` is dropped by the view's own snapshot migration, which is
  // how the launch came to open at the source view's zoom instead of this one.
  describe('the framing the snapshot carries', () => {
    // exons 0..100 and 5000..5100 padded by 20 -> 0..120 (the low pad is clamped
    // at the contig start) and 4980..5120, so 260bp collapsed — against a source
    // view showing 10,000bp at 800px (see testEnv)
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

      // 260 / 0.9, filling 90% of the width with a 10% margin — the same framing
      // "Replace current view" gets from showAllRegions. The source view's own
      // 10,000bp window is what this used to inherit.
      expect(snap.windowWidthBp).toBeCloseTo(288.89, 2)
      // half the unfilled margin, so the content lands centered
      expect(snap.windowStartBp).toBeCloseTo(-14.44, 2)
    })

    it('names no bpPerPx/offsetPx, which the view would ignore here anyway', () => {
      const snap: Record<string, unknown> = buildCollapsedViewSnapshot(
        intronArgs({ transcripts, flip: false }),
      )

      expect(snap.bpPerPx).toBeUndefined()
      expect(snap.offsetPx).toBeUndefined()
    })

    it('floors the window at the zoom-in limit for a tiny region set', () => {
      // 10bp of exon at window size 0 wants an 11bp window, past the 1/50
      // bp-per-px floor the view's own zoom controls clamp to anyway
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
    })
  })

  // Every downstream consumer assumes at least one region: the in-place path
  // would blank the view back to the import form, and the new-view path would
  // divide by a zero-length span.
  describe('no collapsible intervals', () => {
    it('throws rather than building an empty region set', () => {
      expect(() => {
        collapsedRegionsOf({
          transcripts: [feat({ refName: 'ctgA', type: 'tRNA' })],
          flip: false,
        })
      }).toThrow(/No exons or CDS/)
    })
  })

  // The flip option has to move two things together: the region order and the
  // per-region `reversed` flag. Order without the flag draws each exon's own
  // bases backwards; the flag without the order leaves the gene reading 3'->5'.
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
