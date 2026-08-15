import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { subscribeToObservable } from '../util/observableUtils.ts'

import type { MafFrameRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

/**
 * Unlike the alignment/summary RPCs (whose `adapterConfig` is the track's MAF
 * adapter config model), the annotation adapter is a separate frozen config
 * snapshot read off the display config, so this carries it as a plain object —
 * `getAdapter` accepts a snapshot directly.
 */
export interface LinearMafGetAnnotationDataArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
}

export interface LinearMafGetAnnotationDataResult {
  records: MafFrameRecord[]
}

/**
 * Fetch the per-species CDS frame rows (UCSC `mafFrames`) overlapping a region
 * from the MAF adapter's `annotationAdapter` sub-adapter (typically a
 * BigBedAdapter over `multiz<N>wayFrames.bb`). Each row carries the reference
 * extent, the species (`src`), the reading `frame`, and the gene `name` — enough
 * for the display to draw a frame-colored CDS box on that species' row. It is a
 * generic feature adapter loaded straight through `getAdapter`, a sibling of the
 * `summaryAdapter` sub-adapter.
 */
export async function executeMafAnnotationData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'LinearMafGetAnnotationData'>
}): Promise<LinearMafGetAnnotationDataResult> {
  const { regions, adapterConfig, sessionId, stopToken } = args
  const region = regions[0]!
  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const records: MafFrameRecord[] = []
  await subscribeToObservable(adapter.getFeatures(region, { stopToken }), f => {
    const src = f.get('src')
    // Only mafFrames-shaped features (those carrying a `src` species column)
    // contribute; a plain reference annotation adapter without `src` is ignored
    // here (it would need a different, reference-row-only path).
    if (typeof src === 'string') {
      // `nextFramePos` alone of the autoSql's four linkage columns — see
      // `MafFrameRecord` for why the other three have no reader. A plain
      // annotation adapter without it yields undefined and the cross-exon
      // stitch no-ops.
      const nextFramePos = f.get('nextFramePos')
      records.push({
        refName: region.refName,
        start: f.get('start'),
        end: f.get('end'),
        src,
        frame: Number(f.get('frame')),
        strand: f.get('strand') ?? 1,
        name: String(f.get('name') ?? ''),
        nextFramePos:
          nextFramePos === undefined ? undefined : Number(nextFramePos),
      })
    }
  })
  return { records }
}
