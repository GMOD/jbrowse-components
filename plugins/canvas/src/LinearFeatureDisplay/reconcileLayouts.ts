import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function applyDeltas(
  groupEntries: (readonly [number, FeatureDataResult])[],
  unifiedLayout: Map<string, number>,
) {
  for (const [, data] of groupEntries) {
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

export function reconcileLayouts(
  rpcDataMap: Map<number, FeatureDataResult>,
  regionRefNames?: Map<number, string>,
) {
  const entries = [...rpcDataMap.entries()]
  if (entries.length <= 1) {
    return
  }

  // DEBUG: Log region info to understand multi-chromosome layout
  console.log(
    '[reconcileLayouts] Reconciling',
    entries.length,
    'regions. refNames:',
    regionRefNames ? [...regionRefNames.entries()] : 'not provided',
  )
  for (const [regionNumber, data] of entries) {
    const bpRange =
      data.flatbushItems.length > 0
        ? {
            minBp: Math.min(...data.flatbushItems.map(f => f.startBp)),
            maxBp: Math.max(...data.flatbushItems.map(f => f.endBp)),
          }
        : { minBp: 0, maxBp: 0 }
    console.log(
      `[reconcileLayouts] Region ${regionNumber}: regionStart=${data.regionStart}, features=${data.flatbushItems.length}, bpRange=[${bpRange.minBp}, ${bpRange.maxBp}], maxY=${data.maxY}`,
    )
  }

  // Group regions by refName so we only reconcile within the same chromosome
  const regionsByRef = new Map<string, number[]>()
  if (regionRefNames) {
    for (const [regionNumber] of entries) {
      const refName =
        regionRefNames.get(regionNumber) ?? `unknown-${regionNumber}`
      let group = regionsByRef.get(refName)
      if (!group) {
        group = []
        regionsByRef.set(refName, group)
      }
      group.push(regionNumber)
    }
  } else {
    // Fallback: all regions in one group (old behavior)
    regionsByRef.set('all', entries.map(([n]) => n))
  }

  console.log(
    '[reconcileLayouts] Region groups by refName:',
    [...regionsByRef.entries()].map(([ref, nums]) => `${ref}: [${nums}]`),
  )

  for (const [refName, regionNumbers] of regionsByRef) {
    if (regionNumbers.length <= 1) {
      console.log(
        `[reconcileLayouts] Skipping refName=${refName} (single region)`,
      )
      continue
    }

    console.log(
      `[reconcileLayouts] Reconciling refName=${refName} across regions [${regionNumbers}]`,
    )

    const groupEntries = regionNumbers
      .map(n => [n, rpcDataMap.get(n)!] as const)
      .filter(([, d]) => d !== undefined)

    const allFeatures = new Map<
      string,
      { start: number; end: number; height: number }
    >()
    for (const [, data] of groupEntries) {
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

    applyDeltas(groupEntries, unifiedLayout)
  }
}
