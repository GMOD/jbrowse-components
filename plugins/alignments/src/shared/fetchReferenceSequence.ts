import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

// Fetches reference sequence over [regionStart, regionEnd], extending up to
// one region-width on either side so reads spilling across block boundaries
// still get reference bases for mismatch coloring.
export async function fetchReferenceSequence({
  pluginManager,
  sessionId,
  sequenceAdapter,
  region,
  featuresArray,
  regionStart,
}: {
  pluginManager: PluginManager
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  region: {
    assemblyName: string
    refName: string
    originalRefName?: string
    start: number
    end: number
  }
  featuresArray: Feature[]
  regionStart: number
}) {
  const regionEnd0 = Math.ceil(region.end)
  let seqFetchStart = regionStart
  let seqFetchEnd = regionEnd0
  const maxExtension = regionEnd0 - regionStart
  for (const f of featuresArray) {
    const s = f.get('start')
    const e = f.get('end')
    if (s < seqFetchStart && s >= regionStart - maxExtension) {
      seqFetchStart = s
    }
    if (e > seqFetchEnd && e <= regionEnd0 + maxExtension) {
      seqFetchEnd = e
    }
  }
  const seqAdapter = (
    await getAdapter(pluginManager, sessionId, sequenceAdapter)
  ).dataAdapter as BaseFeatureDataAdapter
  const seqFeats = await firstValueFrom(
    seqAdapter
      .getFeatures({
        ...region,
        refName: region.originalRefName || region.refName,
        start: Math.max(0, seqFetchStart),
        end: seqFetchEnd + 1,
      })
      .pipe(toArray()),
  )
  return {
    regionSequence: seqFeats[0]?.get('seq') as string | undefined,
    regionSequenceStart: Math.max(0, seqFetchStart),
  }
}
