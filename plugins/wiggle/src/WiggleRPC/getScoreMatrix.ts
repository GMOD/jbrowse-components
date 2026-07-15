import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { groupBy } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import type { GetScoreMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function getScoreMatrix({
  pluginManager,
  args,
}: {
  args: GetScoreMatrixArgs
  pluginManager: PluginManager
}) {
  const {
    sources,
    regions,
    adapterConfig,
    sessionId,
    bpPerPx,
    stopTokenCheck,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const r0 = regions[0]!
  const r0len = r0.end - r0.start
  const w = Math.floor(r0len / bpPerPx)
  const feats = await dataAdapter.getFeaturesArray(r0, args)

  const groups = groupBy(feats, f => f.get('source')!)
  const rows: Record<string, Float32Array> = {}

  // pre-compute values used in inner loop
  const r0Start = r0.start
  const invBpPerPx = 1 / bpPerPx

  for (const source of sources) {
    const { name } = source
    const features = groups[name] ?? []

    const arr = new Float32Array(w)
    for (const feat of features) {
      const fstart = feat.get('start')
      const fend = feat.get('end')
      const score = feat.get('score') ?? 0

      const startX = Math.max(0, ((fstart - r0Start) * invBpPerPx) | 0)
      const endX = Math.min(w, ((fend - r0Start) * invBpPerPx) | 0)

      for (let x = startX; x < endX; x++) {
        arr[x] = score
      }
    }
    rows[name] = arr
    checkStopToken2(stopTokenCheck)
  }

  return rows
}
