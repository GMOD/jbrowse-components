import { PLOT_SCAN_MAX_BP, plotScanRegions } from './fetchPlotFields.ts'

import type { RegionHost } from '@jbrowse/display-kit/regionHost'

function hostOf(
  blocks: { start: number; end: number; displayedRegionIndex: number }[],
) {
  return {
    staticBlocks: {
      contentBlocks: blocks.map(b => ({
        ...b,
        refName: 'chr1',
        assemblyName: 'hg38',
      })),
    },
  } as unknown as RegionHost
}

const onTrack = () => true

test('the scan reads every block on screen, not only the first', () => {
  const host = hostOf(
    [0, 1, 2].map(i => ({
      start: 1101412 + i * 4667,
      end: 1101412 + (i + 1) * 4667,
      displayedRegionIndex: 0,
    })),
  )
  expect(plotScanRegions(host, onTrack)).toEqual([
    {
      refName: 'chr1',
      start: 1101412,
      end: 1115413,
      assemblyName: 'hg38',
    },
  ])
})

test('the scan stays within the first region and its byte budget', () => {
  const host = hostOf([
    { start: 0, end: 15_000, displayedRegionIndex: 0 },
    { start: 15_000, end: 30_000, displayedRegionIndex: 0 },
    { start: 0, end: 5_000, displayedRegionIndex: 1 },
  ])
  expect(plotScanRegions(host, onTrack)[0]).toMatchObject({
    start: 0,
    end: PLOT_SCAN_MAX_BP,
  })
})
