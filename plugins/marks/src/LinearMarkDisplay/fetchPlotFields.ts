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

/**
 * A displayed region, the part of it the screen shows, and how many bp of
 * displayed regions come before it.
 */
interface ShownRegion {
  region: Region
  shownStart: number
  shownEnd: number
  displayedOffset: number
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
  const gridPoints = shown.flatMap(
    ({ region, shownStart, shownEnd, displayedOffset }) => {
      const toDisplayed = (bp: number) => displayedOffset + bp - region.start
      const firstIndex = Math.ceil(toDisplayed(shownStart) / step)
      const count = Math.max(
        0,
        Math.ceil(toDisplayed(shownEnd) / step) - firstIndex,
      )
      return Array.from({ length: count }, (_, i) => ({
        region,
        at: region.start + (firstIndex + i) * step - displayedOffset,
      }))
    },
  )
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
 * screen, laid along the displayed regions end to end, so a sparse track's
 * features are found wherever they sit, and a whole genome is sampled inside
 * its chromosomes rather than at each one's first base. Neither grid moves
 * with the screen, so an empty scan reruns only as a pan moves a grid line
 * across its edge.
 */
export function plotScanRegions(
  host: RegionHost,
  onTrack: (assemblyName: string) => boolean,
): Region[] {
  let displayedBp = 0
  const placed = host.displayedRegions.map(region => {
    const displayedOffset = displayedBp
    displayedBp += region.end - region.start
    return { region, displayedOffset }
  })
  const shown: ShownRegion[] = host.visibleRegions.flatMap(visible => {
    const entry = placed[visible.displayedRegionIndex]
    return entry && onTrack(visible.assemblyName)
      ? [
          {
            ...entry,
            shownStart: Math.max(entry.region.start, visible.start),
            shownEnd: Math.min(entry.region.end, visible.end),
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
