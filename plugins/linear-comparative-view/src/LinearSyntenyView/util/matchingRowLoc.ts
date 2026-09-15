import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { allSessionTracks } from '@jbrowse/synteny-core'

import { makeMateDiscovery } from '../../LaunchSyntenyView/discoverMates.ts'
import { paddedLocString } from '../../LaunchSyntenyView/paddedLocString.ts'
import {
  toWholeBpRegion,
  widestRegion,
} from '../../LaunchSyntenyView/regionLaunchMenuItems.ts'

import type {
  AssemblyHost,
  Region,
  RpcHost,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The window a row added below `row` should match, or undefined while `row`
 * shows everything it displays, where the new row opens on its whole genome.
 */
export function zoomedInWindow(row: LinearGenomeViewModel) {
  const region = widestRegion(row.dynamicBlocks.contentBlocks)
  return region && row.totalBp - row.visibleBp > row.bpPerPx
    ? toWholeBpRegion(region)
    : undefined
}

/**
 * The locstring on `assembly` that aligns to `region` through `trackId`, found
 * the way the region launch places a mate's panel, or undefined when nothing
 * aligns there.
 */
export async function matchingRowLoc({
  session,
  trackId,
  region,
  assembly,
  widthPx,
  signal,
}: {
  session: AssemblyHost & RpcHost & TrackCatalog
  trackId: string
  region: Region
  assembly: string
  widthPx: number
  signal?: AbortSignal
}) {
  const track = allSessionTracks(session).find(t => t.trackId === trackId)
  if (!track) {
    return undefined
  }
  const { mates } = await makeMateDiscovery({
    session,
    track,
    region,
    widthPx,
  })(signal, () => {})
  const panel = mates.find(m =>
    isSameAssemblyName(m.assemblyName, assembly, session.assemblyManager),
  )
  return panel
    ? paddedLocString({
        refName: panel.refName,
        start: panel.mateStart,
        end: panel.mateEnd,
        windowSize: 0,
      })
    : undefined
}
