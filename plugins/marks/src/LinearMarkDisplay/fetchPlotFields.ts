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
 * The window the field scan reads: `PLOT_SCAN_MAX_BP` on the first region on
 * the track's genomes from the lowest coordinate on screen (its left edge, or
 * its right in a reversed region), snapped down to a half-window grid so the
 * window still covers the screen and a pan rescans only once it crosses a
 * grid line.
 */
export function plotScanRegions(
  host: RegionHost,
  onTrack: (assemblyName: string) => boolean,
): Region[] {
  const visible = host.visibleRegions.find(r => onTrack(r.assemblyName))
  const region = visible && host.displayedRegions[visible.displayedRegionIndex]
  if (!visible || !region) {
    return []
  }
  const start = Math.max(
    region.start,
    Math.floor(visible.start / PLOT_SCAN_STEP_BP) * PLOT_SCAN_STEP_BP,
  )
  return [
    {
      refName: visible.refName,
      start,
      end: Math.min(region.end, start + PLOT_SCAN_MAX_BP),
      assemblyName: visible.assemblyName,
    },
  ]
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
