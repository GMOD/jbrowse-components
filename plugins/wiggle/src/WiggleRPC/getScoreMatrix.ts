import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { groupBy } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import type { GetScoreMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function getScoreMatrix({
  pluginManager,
  args,
}: {
  args: GetScoreMatrixArgs
  pluginManager: PluginManager
}) {
  const { sources, regions, adapterConfig, sessionId, bpPerPx } = args
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const r0 = regions[0]!
  const r0len = r0.end - r0.start
  const w = Math.floor(r0len / bpPerPx)
  const feats = await firstValueFrom(
    dataAdapter.getFeatures(r0, args).pipe(toArray()),
  )

  const groups = groupBy(feats, f => f.get('source'))
  const rows = {} as Record<string, number[]>

  // pre-compute values used in inner loop
  const r0Start = r0.start
  const invBpPerPx = 1 / bpPerPx

  for (const source of sources) {
    const { name } = source
    const features = groups[name] || []

    // use Float32Array for better performance with numeric data
    const arr = new Float32Array(w)
    for (const feat of features) {
      // extract feature properties once to avoid repeated get() calls
      const fstart = feat.get('start')
      const fend = feat.get('end')
      const score = feat.get('score')

      // calculate loop bounds once, avoid repeated bounds checks
      const startX = Math.max(0, ((fstart - r0Start) * invBpPerPx) | 0)
      const endX = Math.min(w, ((fend - r0Start) * invBpPerPx) | 0)

      for (let x = startX; x < endX; x++) {
        if (arr[x] === 0) {
          arr[x] = score
        }
      }
    }
    // convert to regular array for JSON serialization
    rows[name] = Array.from(arr)
  }

  return rows
}
