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

test('the scan stays within the first visible region', () => {
  const host = hostOf(
    [
      { start: 3_000, end: 15_000 },
      { start: 0, end: 5_000 },
    ],
    [
      { start: 3_000, end: 15_000, displayedRegionIndex: 0 },
      { start: 0, end: 5_000, displayedRegionIndex: 1 },
    ],
  )
  expect(plotScanRegions(host, onTrack)[0]).toMatchObject({
    start: 3_000,
    end: 15_000,
  })
})

test('a view showing none of the track reads nothing', () => {
  const host = hostOf(
    [{ start: 0, end: 5_000 }],
    [{ start: 0, end: 5_000, displayedRegionIndex: 0 }],
  )
  expect(plotScanRegions(host, () => false)).toEqual([])
})
