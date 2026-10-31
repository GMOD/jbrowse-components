import { PLOT_SCAN_MAX_BP, plotScanRegions } from './fetchPlotFields.ts'

import type { RegionHost } from '@jbrowse/display-kit/regionHost'

function hostOf(
  displayedRegions: { start: number; end: number }[],
  visible: { start: number; end: number; displayedRegionIndex: number }[],
) {
  const named = { refName: 'chr1', assemblyName: 'hg38' }
  return {
    displayedRegions: displayedRegions.map(r => ({ ...r, ...named })),
    visibleRegions: visible.map(r => ({ ...r, ...named })),
  } as unknown as RegionHost
}

const onTrack = () => true

test('the scan covers the screen, not the padding left of it', () => {
  const host = hostOf(
    [{ start: 0, end: 10_000_000 }],
    [{ start: 1_134_567, end: 1_154_567, displayedRegionIndex: 0 }],
  )
  expect(plotScanRegions(host, onTrack)).toEqual([
    {
      refName: 'chr1',
      start: 1_130_000,
      end: 1_130_000 + PLOT_SCAN_MAX_BP,
      assemblyName: 'hg38',
    },
  ])
})

test('a pan within the grid step reads the same window', () => {
  const at = (start: number) =>
    plotScanRegions(
      hostOf(
        [{ start: 0, end: 10_000_000 }],
        [{ start, end: start + 1_000, displayedRegionIndex: 0 }],
      ),
      onTrack,
    )
  expect(at(1_131_000)).toEqual(at(1_139_000))
  expect(at(1_131_000)).not.toEqual(at(1_141_000))
})

test('a screen wider than the budget is sampled across every region', () => {
  const host = hostOf(
    [
      { start: 3_000, end: 15_000 },
      { start: 0, end: 50_000 },
      { start: 0, end: 5_000 },
    ],
    [
      { start: 3_000, end: 15_000, displayedRegionIndex: 0 },
      { start: 0, end: 50_000, displayedRegionIndex: 1 },
      { start: 0, end: 5_000, displayedRegionIndex: 2 },
    ],
  )
  const scans = plotScanRegions(host, onTrack)
  expect(scans.map(({ start }) => start)).toEqual([
    10_000, 0, 10_000, 20_000, 30_000, 40_000, 0,
  ])
  expect(
    scans.reduce((sum, r) => sum + r.end - r.start, 0),
  ).toBeLessThanOrEqual(PLOT_SCAN_MAX_BP)
})

// hap-ibd's blocks start ~15 Mb into chr1: a read of the screen's left edge
// found none and the track drew nothing
test('a whole chromosome is read across its length, not at its left edge', () => {
  const chr1 = 248_956_422
  const scans = plotScanRegions(
    hostOf(
      [{ start: 0, end: chr1 }],
      [{ start: 0, end: chr1, displayedRegionIndex: 0 }],
    ),
    onTrack,
  )
  expect(scans.length).toBeGreaterThanOrEqual(4)
  expect(scans.at(-1)!.start).toBeGreaterThan(chr1 / 2)
  expect(
    scans.reduce((sum, r) => sum + r.end - r.start, 0),
  ).toBeLessThanOrEqual(PLOT_SCAN_MAX_BP)
})

test('a pan that moves no grid point past the edge reads the same windows', () => {
  const at = (start: number) =>
    plotScanRegions(
      hostOf(
        [{ start: 0, end: 248_956_422 }],
        [{ start, end: start + 100_000_000, displayedRegionIndex: 0 }],
      ),
      onTrack,
    )
  expect(at(1_000_000)).toEqual(at(9_000_000))
  expect(at(1_000_000)).not.toEqual(at(11_000_000))
})

test('a view showing none of the track reads nothing', () => {
  const host = hostOf(
    [{ start: 0, end: 5_000 }],
    [{ start: 0, end: 5_000, displayedRegionIndex: 0 }],
  )
  expect(plotScanRegions(host, () => false)).toEqual([])
})
