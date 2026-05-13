import { clusterObject, toNewick } from '@gmod/hclust'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

interface MultiPairAdapterLike {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{ genomeRows: Map<string, MultiPairFeature[]> }>
}

export interface ClusterIdentityMatrixArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  sources: { name: string }[]
  binsPerRegion?: number
  bpPerPx?: number
  sessionId: string
  stopToken?: StopToken
  statusCallback: (msg: string) => void
}

// Length-weighted mean identity per (genome × bin). Bins are uniformly spaced
// across each visible region; per-feature contribution is (identity * clippedLen)
// distributed across the bins the feature overlaps. Empty bins → 0.
export async function executeClusterIdentityMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ClusterIdentityMatrixArgs
}) {
  const {
    adapterConfig,
    regions,
    sources,
    binsPerRegion = 64,
    bpPerPx,
    sessionId,
    stopToken,
    statusCallback,
  } = args
  const stopTokenCheck = createStopTokenChecker(stopToken)

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as unknown as MultiPairAdapterLike

  const totalBins = regions.length * binsPerRegion
  const rows: Record<string, Float32Array> = {}
  const weights: Record<string, Float32Array> = {}
  for (const s of sources) {
    rows[s.name] = new Float32Array(totalBins)
    weights[s.name] = new Float32Array(totalBins)
  }

  for (let r = 0; r < regions.length; r++) {
    const region = regions[r]!
    statusCallback(`Fetching features ${r + 1}/${regions.length}`)
    const { genomeRows } = await adapter.getMultiPairFeatures(region, {
      bpPerPx,
      stopToken,
    })
    checkStopToken2(stopTokenCheck)

    const regionStart = region.start
    const regionEnd = region.end
    const regionLen = regionEnd - regionStart
    if (regionLen <= 0) {
      continue
    }
    const bpPerBin = regionLen / binsPerRegion
    const binOffset = r * binsPerRegion

    for (const s of sources) {
      const feats = genomeRows.get(s.name)
      if (!feats) {
        continue
      }
      const row = rows[s.name]!
      const w = weights[s.name]!
      for (const f of feats) {
        const fStart = Math.max(f.start, regionStart)
        const fEnd = Math.min(f.end, regionEnd)
        if (fEnd <= fStart) {
          continue
        }
        const identity = f.identity
        if (!(identity > 0)) {
          continue
        }
        const startBin = Math.floor((fStart - regionStart) / bpPerBin)
        const endBin = Math.min(
          binsPerRegion - 1,
          Math.floor((fEnd - regionStart - 1) / bpPerBin),
        )
        for (let b = startBin; b <= endBin; b++) {
          const binStartBp = regionStart + b * bpPerBin
          const binEndBp = binStartBp + bpPerBin
          const overlap = Math.min(fEnd, binEndBp) - Math.max(fStart, binStartBp)
          if (overlap > 0) {
            row[binOffset + b]! += identity * overlap
            w[binOffset + b]! += overlap
          }
        }
      }
    }
  }

  // Finalize: weighted mean per bin, scaled to Int16 (0-10000) for clustering.
  // Empty bins collapse to 0 — treated as "no alignment" rather than missing.
  const finalRows: Record<string, Int16Array> = {}
  for (const s of sources) {
    const row = rows[s.name]!
    const w = weights[s.name]!
    const out = new Int16Array(totalBins)
    for (let b = 0; b < totalBins; b++) {
      out[b] = w[b]! > 0 ? Math.round((row[b]! / w[b]!) * 10000) : 0
    }
    finalRows[s.name] = out
  }

  statusCallback('Clustering')
  const result = await clusterObject({
    data: finalRows,
    onProgress: statusCallback,
    checkCancellation: () => {
      checkStopToken2(stopTokenCheck)
    },
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}
