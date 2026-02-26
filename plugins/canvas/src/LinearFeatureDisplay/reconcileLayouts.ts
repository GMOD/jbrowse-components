import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

export function reconcileLayouts(rpcDataMap: Map<number, FeatureDataResult>) {
  const entries = [...rpcDataMap.entries()]
  if (entries.length <= 1) {
    return
  }

  const allFeatures = new Map<
    string,
    { start: number; end: number; height: number }
  >()
  for (const [, data] of entries) {
    for (const item of data.flatbushItems) {
      if (!allFeatures.has(item.featureId)) {
        allFeatures.set(item.featureId, {
          start: item.startBp,
          end: item.endBp,
          height: item.bottomPx - item.topPx,
        })
      }
    }
  }

  const sorted = [...allFeatures.entries()]
    .map(([id, { start, end, height }]) => ({ id, start, end, height }))
    .sort((a, b) => a.start - b.start)

  const placed: {
    start: number
    end: number
    topPx: number
    height: number
  }[] = []
  const unifiedLayout = new Map<string, number>()

  for (const f of sorted) {
    let candidateY = 0
    for (const p of placed) {
      if (p.end > f.start && p.start < f.end) {
        candidateY = Math.max(candidateY, p.topPx + p.height)
      }
    }
    unifiedLayout.set(f.id, candidateY)
    placed.push({
      start: f.start,
      end: f.end,
      topPx: candidateY,
      height: f.height,
    })
  }

  for (const [, data] of entries) {
    const deltaMap: {
      oldTop: number
      oldBottom: number
      delta: number
    }[] = []
    let anyChanged = false

    for (const item of data.flatbushItems) {
      const newTopPx = unifiedLayout.get(item.featureId)
      if (newTopPx === undefined) {
        continue
      }
      const delta = newTopPx - item.topPx
      if (delta !== 0) {
        anyChanged = true
      }
      deltaMap.push({
        oldTop: item.topPx,
        oldBottom: item.bottomPx,
        delta,
      })
    }

    if (!anyChanged) {
      continue
    }

    deltaMap.sort((a, b) => a.oldTop - b.oldTop)

    const resolveY = (y: number) => {
      let lo = 0
      let hi = deltaMap.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const d = deltaMap[mid]!
        if (y < d.oldTop) {
          hi = mid - 1
        } else if (y >= d.oldBottom) {
          lo = mid + 1
        } else {
          return y + d.delta
        }
      }
      return y
    }

    for (let i = 0; i < data.numRects; i++) {
      data.rectYs[i] = resolveY(data.rectYs[i]!)
    }
    for (let i = 0; i < data.numLines; i++) {
      data.lineYs[i] = resolveY(data.lineYs[i]!)
    }
    for (let i = 0; i < data.numArrows; i++) {
      data.arrowYs[i] = resolveY(data.arrowYs[i]!)
    }

    for (const item of data.flatbushItems) {
      const newTopPx = unifiedLayout.get(item.featureId)
      if (newTopPx === undefined) {
        continue
      }
      const height = item.bottomPx - item.topPx
      item.topPx = newTopPx
      item.bottomPx = newTopPx + height
    }

    for (const info of data.subfeatureInfos) {
      const height = info.bottomPx - info.topPx
      info.topPx = resolveY(info.topPx)
      info.bottomPx = info.topPx + height
    }

    for (const labelData of Object.values(data.floatingLabelsData)) {
      labelData.topY = resolveY(labelData.topY)
    }

    if (data.aminoAcidOverlay) {
      for (const item of data.aminoAcidOverlay) {
        item.topPx = resolveY(item.topPx)
      }
    }

    // new array references so client-side flatbush cache rebuilds
    data.flatbushItems = [...data.flatbushItems]
    data.subfeatureInfos = [...data.subfeatureInfos]

    let newMaxY = 0
    for (const item of data.flatbushItems) {
      if (item.bottomPx > newMaxY) {
        newMaxY = item.bottomPx
      }
    }
    data.maxY = newMaxY
  }
}
