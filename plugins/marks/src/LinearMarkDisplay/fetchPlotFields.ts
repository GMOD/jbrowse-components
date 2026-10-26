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

/**
 * The window the field scan reads: what is on screen of the first region on the
 * track's genomes. The first static block alone starts left of the screen, so
 * a sparse track's only feature in view could fall outside it.
 */
export function plotScanRegions(
  host: RegionHost,
  onTrack: (assemblyName: string) => boolean,
): Region[] {
  const blocks = host.staticBlocks.contentBlocks
  const first = blocks.find(b => onTrack(b.assemblyName))
  if (!first) {
    return []
  }
  let { start, end } = first
  for (const b of blocks) {
    if (b.displayedRegionIndex === first.displayedRegionIndex) {
      start = Math.min(start, b.start)
      end = Math.max(end, b.end)
    }
  }
  return [
    {
      refName: first.refName,
      start,
      end: Math.min(end, start + PLOT_SCAN_MAX_BP),
      assemblyName: first.assemblyName,
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
