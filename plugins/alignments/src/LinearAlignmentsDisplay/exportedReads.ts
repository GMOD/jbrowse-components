import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId, isSameAssemblyName } from '@jbrowse/core/util/tracks'

import type { ExportRead } from '../RenderAlignmentDataRPC/GetExportReads.ts'
import type { RenderAlignmentDataArgs } from '../RenderAlignmentDataRPC/types.ts'
import type {
  ExportedFeatureSet,
  ExportedFeatures,
  ExportedFeaturesRequest,
} from '@jbrowse/core/pluggableElementTypes/models'
import type { Feature, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A region the worker reads, and the export's regions inside it: the span
 * the render fetched where one holds the export region, so lanes keyed by
 * the region's insert-size band and chains judged over its reads come out as
 * drawn, else the export region itself.
 */
export interface ExportFetch {
  region: Region
  windows: Region[]
}

export function exportFetches(
  regions: readonly Region[],
  loaded: readonly Region[],
  sameAssembly: (a: string, b: string) => boolean,
) {
  const fetches = new Map<Region, Region[]>()
  for (const region of regions) {
    const span =
      loaded.find(
        l =>
          sameAssembly(l.assemblyName, region.assemblyName) &&
          l.refName === region.refName &&
          Math.floor(l.start) <= region.start &&
          Math.ceil(l.end) >= region.end,
      ) ?? region
    fetches.set(span, [...(fetches.get(span) ?? []), region])
  }
  return [...fetches].map(
    ([{ assemblyName, refName, start, end }, windows]): ExportFetch => ({
      region: { assemblyName, refName, start, end },
      windows,
    }),
  )
}

function overlapsAny(feature: Feature, windows: readonly Region[]) {
  const start = feature.get('start')
  const end = feature.get('end')
  return windows.some(w => start < w.end && end > w.start)
}

/**
 * The reads a format writes, once each: those in a visible lane, every one
 * the coverage counts for a depth and the drawn ones for a read format, out
 * of the reads inside the export's windows.
 */
export function exportedReadsOf(
  fetched: readonly { windows: readonly Region[]; reads: ExportRead[] }[],
  featureSet: ExportedFeatureSet,
  hidden: ReadonlySet<string>,
): ExportedFeatures {
  const counted = new Set<string>()
  const kept = new Map<string, Feature>()
  for (const { windows, reads } of fetched) {
    for (const { feature, lane, drawn } of reads) {
      if (overlapsAny(feature, windows)) {
        counted.add(feature.id())
        if (!hidden.has(lane) && (featureSet === 'counted' || drawn)) {
          kept.set(feature.id(), feature)
        }
      }
    }
  }
  return {
    features: [...kept.values()],
    filteredOut: counted.size - kept.size,
  }
}

export interface ExportedReadsSelf extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  hiddenGroups: ReadonlySet<string>
  loadedRegions: { values: () => Iterable<Region> }
  rpcProps: () => Pick<RenderAlignmentDataArgs, 'filter' | 'facet'>
}

/**
 * Save track data's reads, as the worker samples, lanes and filters them
 * under the display's own settings and over the spans it rendered.
 */
export async function fetchExportedReads(
  self: ExportedReadsSelf,
  { regions, featureSet, signal, statusCallback }: ExportedFeaturesRequest,
) {
  const { rpcManager, assemblyManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const { adapterConfig, hiddenGroups } = self
  const { filter, facet } = self.rpcProps()
  const fetches = exportFetches(
    regions,
    [...self.loadedRegions.values()],
    (a, b) => isSameAssemblyName(a, b, assemblyManager),
  )
  const fetched = await Promise.all(
    fetches.map(async ({ region, windows }) => ({
      windows,
      reads: await rpcManager.call(sessionId, 'PileupGetExportReads', {
        adapterConfig,
        regions: [region],
        filter,
        facet,
        signal,
        statusCallback,
      }),
    })),
  )
  return exportedReadsOf(fetched, featureSet, hiddenGroups)
}
