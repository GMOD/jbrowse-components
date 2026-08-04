import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { groupFeaturesBySource } from '../util.ts'

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

  const invBpPerPx = 1 / bpPerPx

  // Every visible block contributes a segment; each source's vector is those
  // segments concatenated, so a multi-region (e.g. whole-genome) view clusters
  // on the full visible data instead of silently only the first block.
  const widths = regions.map(r =>
    Math.max(0, Math.floor((r.end - r.start) * invBpPerPx)),
  )
  const offsets: number[] = []
  let totalWidth = 0
  for (const w of widths) {
    offsets.push(totalWidth)
    totalWidth += w
  }

  const rows: Record<string, Float32Array> = {}
  for (const { name } of sources) {
    rows[name] = new Float32Array(totalWidth)
  }

  // Fetched together rather than one region at a time: clustering a
  // collapsed-intron or whole-genome view otherwise paid N serial round trips
  // for what the render path already batches. Each region gets its own status
  // slot so the concurrent downloads aggregate into one bar instead of
  // clobbering the shared field. Binning stays sequential below — it writes into
  // one shared `rows` and has to stay interruptible.
  const slot = createStatusFanOut(args.statusCallback)
  const featsPerRegion = await Promise.all(
    regions.map(region =>
      dataAdapter.getFeaturesArray(region, {
        ...args,
        statusCallback: slot(),
      }),
    ),
  )

  for (const [i, region] of regions.entries()) {
    const w = widths[i]!
    const colOffset = offsets[i]!
    const regionStart = region.start
    const groups = groupFeaturesBySource(featsPerRegion[i]!)

    for (const { name } of sources) {
      const arr = rows[name]!
      const features = groups[name] ?? []
      for (const feat of features) {
        const fstart = feat.get('start')
        const fend = feat.get('end')
        const score = feat.get('score') ?? 0

        const startX = Math.max(0, ((fstart - regionStart) * invBpPerPx) | 0)
        const endX = Math.min(w, ((fend - regionStart) * invBpPerPx) | 0)

        for (let x = startX; x < endX; x++) {
          arr[colOffset + x] = score
        }
      }
      checkStopTokenThrottled(stopTokenCheck)
    }
  }

  return rows
}
