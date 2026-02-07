import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { rpcResult } from '@jbrowse/core/util/librpc'

import type { ViewSnap } from '@jbrowse/core/util'

export interface SyntenyFeatureData {
  id: string
  refName1: string
  refName2: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
}

export function executeSyntenyWebGLGeometry({
  features,
  viewSnaps,
  level,
}: {
  features: SyntenyFeatureData[]
  viewSnaps: ViewSnap[]
  level: number
}) {
  const v1 = viewSnaps[level]!
  const v2 = viewSnaps[level + 1]!

  const count = features.length
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  const featureIds: string[] = []

  let validCount = 0
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    let f1s = f.start
    let f1e = f.end
    const f2s = f.mateStart
    const f2e = f.mateEnd

    if (f.strand === -1) {
      ;[f1e, f1s] = [f1s, f1e]
    }

    const p11 = bpToPx({ self: v1, refName: f.refName1, coord: f1s })
    const p12 = bpToPx({ self: v1, refName: f.refName1, coord: f1e })
    const p21 = bpToPx({ self: v2, refName: f.refName2, coord: f2s })
    const p22 = bpToPx({ self: v2, refName: f.refName2, coord: f2e })

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    p11Array[validCount] = p11.offsetPx
    p12Array[validCount] = p12.offsetPx
    p21Array[validCount] = p21.offsetPx
    p22Array[validCount] = p22.offsetPx
    featureIds.push(f.id)
    validCount++
  }

  const result = {
    p11_offsetPx: p11Array.slice(0, validCount),
    p12_offsetPx: p12Array.slice(0, validCount),
    p21_offsetPx: p21Array.slice(0, validCount),
    p22_offsetPx: p22Array.slice(0, validCount),
    featureIds,
  }

  return rpcResult(result, [
    result.p11_offsetPx.buffer,
    result.p12_offsetPx.buffer,
    result.p21_offsetPx.buffer,
    result.p22_offsetPx.buffer,
  ] as ArrayBuffer[])
}
