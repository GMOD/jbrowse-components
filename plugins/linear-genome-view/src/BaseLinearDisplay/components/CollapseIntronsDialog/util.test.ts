import { calculateInitialViewState, getExonsAndCDS } from './util.ts'

describe('CollapseIntrons utilities', () => {
  describe('getExonsAndCDS', () => {
    it('extracts exons from transcripts', () => {
      const transcripts = [
        {
          get: (key: string) => {
            if (key === 'subfeatures') {
              return [
                { get: (k: string) => (k === 'type' ? 'exon' : undefined) },
                { get: (k: string) => (k === 'type' ? 'intron' : undefined) },
                { get: (k: string) => (k === 'type' ? 'exon' : undefined) },
              ]
            }
            return undefined
          },
        },
      ] as any

      const result = getExonsAndCDS(transcripts)
      expect(result).toHaveLength(2)
    })

    it('extracts CDS from transcripts', () => {
      const transcripts = [
        {
          get: (key: string) => {
            if (key === 'subfeatures') {
              return [
                { get: (k: string) => (k === 'type' ? 'CDS' : undefined) },
                { get: (k: string) => (k === 'type' ? 'UTR' : undefined) },
              ]
            }
            return undefined
          },
        },
      ] as any

      const result = getExonsAndCDS(transcripts)
      expect(result).toHaveLength(1)
    })

    it('handles transcripts with no subfeatures', () => {
      const transcripts = [
        {
          get: () => undefined,
        },
      ] as any

      const result = getExonsAndCDS(transcripts)
      expect(result).toHaveLength(0)
    })
  })

  describe('calculateInitialViewState', () => {
    it('calculates zoom to fit all regions in 90% of viewport', () => {
      const regions = [
        { start: 0, end: 1000 },
        { start: 2000, end: 3000 },
      ]
      const viewWidth = 900

      const result = calculateInitialViewState(regions, viewWidth)

      // Total BP = 2000, viewport width * 0.9 = 810
      // bpPerPx = 2000 / 810 ≈ 2.469
      expect(result.bpPerPx).toBeCloseTo(2.469, 2)
    })

    it('accounts for inter-region padding when centering', () => {
      const regions = [
        { start: 0, end: 100 },
        { start: 200, end: 300 },
        { start: 400, end: 500 },
      ]
      const viewWidth = 1000

      const result = calculateInitialViewState(regions, viewWidth)

      // Total BP = 300, 3 regions = 2 paddings = 4 pixels
      // bpPerPx = 300 / 900 = 0.333...
      // totalContentPx = 300 / 0.333... + 4 = 900 + 4 = 904
      // centerPx = 452, offsetPx = 452 - 500 = -48
      expect(result.bpPerPx).toBeCloseTo(0.333, 2)
      expect(result.offsetPx).toBe(-48)
    })

    it('handles single region', () => {
      const regions = [{ start: 0, end: 1000 }]
      const viewWidth = 900

      const result = calculateInitialViewState(regions, viewWidth)

      // No inter-region padding for single region
      expect(result.bpPerPx).toBeCloseTo(1.234, 2)
      expect(result.offsetPx).toBeCloseTo(-45, 0)
    })

    it('handles very small viewport', () => {
      const regions = [{ start: 0, end: 1000 }]
      const viewWidth = 100

      const result = calculateInitialViewState(regions, viewWidth)

      expect(result.bpPerPx).toBeCloseTo(11.111, 2)
      expect(result.offsetPx).toBeCloseTo(-5, 0)
    })
  })
})
