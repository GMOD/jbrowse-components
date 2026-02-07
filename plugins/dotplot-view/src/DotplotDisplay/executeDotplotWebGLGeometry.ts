import { rpcResult } from '@jbrowse/core/util/librpc'

import type { DotplotFeatureData } from './types.ts'
import type { ViewSnap } from '@jbrowse/core/util'

// Float-precision version of bpToPx that does NOT round to integer pixels.
// The core bpToPx uses Math.round which destroys sub-pixel precision needed
// for WebGL rendering when zoomed out (high bpPerPx).
function bpToPxFloat({
  refName,
  coord,
  self,
}: {
  refName: string
  coord: number
  self: ViewSnap
}) {
  let bpSoFar = 0
  const { interRegionPaddingWidth, bpPerPx, displayedRegions, staticBlocks } =
    self
  const blocks = staticBlocks.contentBlocks
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  let currBlock = 0

  let i = 0
  for (let l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
    }
    if ((blocks[currBlock] as any)?.regionNumber === i) {
      bpSoFar += len + interRegionPaddingBp
      currBlock++
    } else {
      bpSoFar += len
    }
  }
  const found = displayedRegions[i]
  if (found) {
    return { index: i, offsetPx: bpSoFar / bpPerPx }
  }
  return undefined
}

export function executeDotplotWebGLGeometry({
  features,
  hViewSnap,
  vViewSnap,
}: {
  features: DotplotFeatureData[]
  hViewSnap: ViewSnap
  vViewSnap: ViewSnap
}) {
  const count = features.length
  const p11Array = new Float32Array(count)
  const p12Array = new Float32Array(count)
  const p21Array = new Float32Array(count)
  const p22Array = new Float32Array(count)
  const featureIds: string[] = []
  const cigars: string[] = []

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

    const p11 = bpToPxFloat({
      self: hViewSnap,
      refName: f.refName,
      coord: f1s,
    })
    const p12 = bpToPxFloat({
      self: hViewSnap,
      refName: f.refName,
      coord: f1e,
    })
    const p21 = bpToPxFloat({
      self: vViewSnap,
      refName: f.mateRefName,
      coord: f2s,
    })
    const p22 = bpToPxFloat({
      self: vViewSnap,
      refName: f.mateRefName,
      coord: f2e,
    })

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
    cigars.push(f.cigar ?? '')
    validCount++
  }

  const result = {
    p11_offsetPx: p11Array.slice(0, validCount),
    p12_offsetPx: p12Array.slice(0, validCount),
    p21_offsetPx: p21Array.slice(0, validCount),
    p22_offsetPx: p22Array.slice(0, validCount),
    featureIds,
    cigars,
  }

  return rpcResult(result, [
    result.p11_offsetPx.buffer,
    result.p12_offsetPx.buffer,
    result.p21_offsetPx.buffer,
    result.p22_offsetPx.buffer,
  ] as ArrayBuffer[])
}
