import { createTestEnvironment } from '../testEnv.ts'
import {
  buildCollapsedRegions,
  buildCollapsedViewSnapshot,
  calculateInitialViewState,
  featureHasExonsOrCDS,
  getExonsAndCDS,
  getTranscripts,
} from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

function feat({
  type,
  subfeatures,
  refName,
}: {
  type?: string
  subfeatures?: Feature[]
  refName?: string
} = {}): Feature {
  return {
    get: (k: string) =>
      k === 'type'
        ? type
        : k === 'subfeatures'
          ? subfeatures
          : k === 'refName'
            ? refName
            : undefined,
  } as unknown as Feature
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

  describe('calculateInitialViewState', () => {
    const minBpPerPx = 1 / 50

    it('calculates zoom to fit all regions in 90% of viewport', () => {
      const result = calculateInitialViewState(
        [
          { start: 0, end: 1000 },
          { start: 2000, end: 3000 },
        ],
        900,
        minBpPerPx,
      )

      // totalBp 2000 / (900 * 0.9) ≈ 2.469
      expect(result.bpPerPx).toBeCloseTo(2.469, 2)
    })

    it('centers the content in the viewport', () => {
      const result = calculateInitialViewState(
        [
          { start: 0, end: 100 },
          { start: 200, end: 300 },
          { start: 400, end: 500 },
        ],
        1000,
        minBpPerPx,
      )

      // totalBp 300 / 900 = 0.333..., content 900px wide in a 1000px viewport
      // -> centered at (900 - 1000) / 2
      expect(result.bpPerPx).toBeCloseTo(0.333, 2)
      expect(result.offsetPx).toBe(-50)
    })

    it('handles single region', () => {
      const result = calculateInitialViewState(
        [{ start: 0, end: 1000 }],
        900,
        minBpPerPx,
      )

      expect(result.bpPerPx).toBeCloseTo(1.234, 2)
      expect(result.offsetPx).toBe(-45)
    })

    it('handles very small viewport', () => {
      const result = calculateInitialViewState(
        [{ start: 0, end: 1000 }],
        100,
        minBpPerPx,
      )

      expect(result.bpPerPx).toBeCloseTo(11.111, 2)
      expect(result.offsetPx).toBe(-5)
    })

    it('floors at the view zoom minimum and still centers', () => {
      // 10bp of exon at window size 0 wants bpPerPx 0.0139, below the floor.
      // Content is then 500px, centered in an 800px viewport.
      const result = calculateInitialViewState(
        [{ start: 0, end: 10 }],
        800,
        minBpPerPx,
      )

      expect(result.bpPerPx).toBe(minBpPerPx)
      expect(result.offsetPx).toBe(-150)
    })
  })

  // Every downstream consumer assumes at least one region: the in-place path
  // would blank the view back to the import form, and the new-view path would
  // divide by a zero-length span.
  describe('no collapsible intervals', () => {
    const assembly = {
      name: 'volvox',
      getCanonicalRefName2: (r: string) => r,
      regions: [{ refName: 'ctgA', start: 0, end: 50_000 }],
    } as unknown as Assembly

    it('throws rather than building an empty region set', () => {
      const { view } = createTestEnvironment().createDisplay()
      expect(() => {
        buildCollapsedViewSnapshot({
          view,
          transcripts: [feat({ refName: 'ctgA', type: 'tRNA' })],
          assembly,
          padding: 100,
          flip: false,
          trackId: 'test_track',
          soloFeatureId: undefined,
          label: 'tRNA1',
        })
      }).toThrow(/No exons or CDS/)
    })
  })
})
