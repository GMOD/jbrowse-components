import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { groupBy } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import type { GetScoreMatrixArgs } from './types'
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

  for (const source of sources) {
    const { name } = source
    const features = groups[name] || []

    const arr = new Array(w).fill(0)
    for (const feat of features) {
      const fstart = feat.get('start')
      const fend = feat.get('end')
      const score = feat.get('score')
      for (let i = fstart; i < fend; i += bpPerPx) {
        const x = Math.floor((i - r0.start) / bpPerPx)
        if (x >= 0 && x < w) {
          arr[x] ||= score
        }
      }
    }
    rows[name] = arr
  }

  return rows
}
