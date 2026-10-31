import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { PlotFields } from './scanPlotFields.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types/data'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * How wide the scan reads. The display holds channels and not records, so the
 * fields have to come off a read of their own, and it is bounded here rather
 * than by the render fetch's byte gate: a whole visible chromosome of a BAM
 * would be the download the gate exists to refuse, and a sample is all the
 * field list needs.
 */
export const PLOT_SCAN_MAX_BP = 20_000

const PLOT_SCAN_STEP_BP = PLOT_SCAN_MAX_BP / 2

/**
 * How many windows a screen wider than the budget is sampled at, so a sparse
 * track at chromosome scale is read where its features are and not only at
 * the screen's left edge.
 */
const PLOT_SCAN_SAMPLES = 10

/** A displayed region, and the part of it the screen shows. */
interface ShownRegion {
  region: Region
  shownStart: number
  shownEnd: number
}

function niceStepAtLeast(bp: number) {
  const decade = 10 ** Math.floor(Math.log10(bp))
  return [1, 2, 5, 10].map(m => m * decade).find(step => step >= bp) ?? bp
}

function windowIn(region: Region, windowStart: number, windowEnd: number) {
  return {
    refName: region.refName,
    start: windowStart,
    end: Math.min(region.end, windowEnd),
    assemblyName: region.assemblyName,
  }
}

function contiguousScan(shown: ShownRegion[]) {
  const scans: Region[] = []
  let budget = PLOT_SCAN_MAX_BP
  for (const { region, shownStart } of shown) {
    if (budget > 0) {
      const windowStart = Math.max(
        region.start,
        Math.floor(shownStart / PLOT_SCAN_STEP_BP) * PLOT_SCAN_STEP_BP,
      )
      const scan = windowIn(region, windowStart, windowStart + budget)
      scans.push(scan)
      budget -= scan.end - scan.start
    }
  }
  return scans
}

function sampledScan(shown: ShownRegion[], shownBp: number) {
  const step = niceStepAtLeast(shownBp / PLOT_SCAN_SAMPLES)
  const gridPoints = shown.flatMap(({ region, shownStart, shownEnd }) => {
    const firstIndex = Math.ceil(shownStart / step)
    const count = Math.max(0, Math.ceil(shownEnd / step) - firstIndex)
    return Array.from({ length: count }, (_, i) => ({
      region,
      at: (firstIndex + i) * step,
    }))
  })
  const width = Math.floor(PLOT_SCAN_MAX_BP / Math.max(1, gridPoints.length))
  return gridPoints.length === 0
    ? contiguousScan(shown)
    : gridPoints.map(({ region, at }) => windowIn(region, at, at + width))
}

/**
 * The windows the field scan reads, `PLOT_SCAN_MAX_BP` in all, over the
 * regions on screen on the track's genomes. A screen within the budget is
 * read whole from its lowest coordinate snapped down to a half-window grid. A
 * wider one is sampled at the points of a round grid of about a tenth of the
 * screen, so a sparse track's features are found wherever they sit on it.
 * Both grids are genome coordinates, so an empty scan reruns only as a pan
 * moves a grid line across the screen's edge.
 */
export function plotScanRegions(
  host: RegionHost,
  onTrack: (assemblyName: string) => boolean,
): Region[] {
  const shown: ShownRegion[] = host.visibleRegions.flatMap(visible => {
    const region = host.displayedRegions[visible.displayedRegionIndex]
    return region && onTrack(visible.assemblyName)
      ? [
          {
            region,
            shownStart: Math.max(region.start, visible.start),
            shownEnd: Math.min(region.end, visible.end),
          },
        ]
      : []
  })
  const shownBp = shown.reduce(
    (sum, { shownStart, shownEnd }) => sum + shownEnd - shownStart,
    0,
  )
  return shownBp > PLOT_SCAN_MAX_BP
    ? sampledScan(shown, shownBp)
    : contiguousScan(shown)
}

export async function fetchPlotFields({
  self,
  regions,
  opts,
}: {
  self: IStateTreeNode & { adapterConfig: Record<string, unknown> }
  regions: Region[]
  opts?: { signal?: AbortSignal; statusCallback?: StatusCallback }
}): Promise<PlotFields> {
  return regions.length === 0
    ? { numeric: [], categorical: [], empty: true }
    : getSession(self).rpcManager.call(
        getRpcSessionId(self),
        'MarkScanPlotFields',
        { adapterConfig: self.adapterConfig, regions, ...opts },
      )
}
