import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { subscribeToObservable } from '../util/observableUtils.ts'

import type { MafFrameRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * Unlike the alignment/summary RPCs (whose `adapterConfig` is the track's MAF
 * adapter config model), the annotation adapter is a separate frozen config
 * snapshot read off the display config, so this carries it as a plain object —
 * `getAdapter` accepts a snapshot directly.
 */
export interface LinearMafGetAnnotationDataArgs {
  adapterConfig: Record<string, unknown>
  sessionId: string
  regions: Region[]
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export interface LinearMafGetAnnotationDataResult {
  records: MafFrameRecord[]
}

/**
 * Fetch the per-species CDS frame rows (UCSC `mafFrames`) overlapping a region
 * from the display's `annotationAdapter` (typically a BigBedAdapter over
 * `multiz<N>wayFrames.bb`). Each row carries the reference extent, the species
 * (`src`), the reading `frame`, and the gene `name` — enough for the display to
 * draw a frame-colored CDS box on that species' row. The adapter is a generic
 * feature adapter loaded straight through `getAdapter`, so the overlay isn't
 * tied to the MAF adapter type the way the summary sub-adapter is.
 */
export async function executeMafAnnotationData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: LinearMafGetAnnotationDataArgs
}): Promise<LinearMafGetAnnotationDataResult> {
  const { regions, adapterConfig, sessionId, stopToken } = args
  const region = regions[0]!
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as BaseFeatureDataAdapter

  const records: MafFrameRecord[] = []
  await subscribeToObservable(adapter.getFeatures(region, { stopToken }), f => {
    const src = f.get('src')
    // Only mafFrames-shaped features (those carrying a `src` species column)
    // contribute; a plain reference annotation adapter without `src` is ignored
    // here (it would need a different, reference-row-only path).
    if (typeof src === 'string') {
      records.push({
        refName: region.refName,
        start: f.get('start'),
        end: f.get('end'),
        src,
        frame: Number(f.get('frame')),
        strand: f.get('strand') ?? 1,
        name: String(f.get('name') ?? ''),
      })
    }
  })
  return { records }
}
