import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { rpcResult } from '@jbrowse/core/util/librpc'

import type { ViewSnap } from '@jbrowse/core/util'

export interface DotplotFeatureData {
  id: string
  refName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
  cigar?: string
}

export function executeDotplotWebGLGeometry({
  features,
  hViewSnap,
  vViewSnap,
  height,
  minAlignmentLength = 0,
}: {
  features: DotplotFeatureData[]
  hViewSnap: ViewSnap
  vViewSnap: ViewSnap
  height: number
  minAlignmentLength?: number
}) {
  const count = features.length
  const x1Array = new Float32Array(count)
  const y1Array = new Float32Array(count)
  const x2Array = new Float32Array(count)
  const y2Array = new Float32Array(count)
  const featureIds: string[] = []
  const cigars: string[] = []

  let validCount = 0
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!

    const alignmentLength = Math.abs(f.end - f.start)
    if (minAlignmentLength > 0 && alignmentLength < minAlignmentLength) {
      continue
    }

    let hStart = f.start
    let hEnd = f.end

    if (f.strand === -1) {
      ;[hEnd, hStart] = [hStart, hEnd]
    }

    const p1h = bpToPx({ self: hViewSnap, refName: f.refName, coord: hStart })
    const p2h = bpToPx({ self: hViewSnap, refName: f.refName, coord: hEnd })
    const p1v = bpToPx({
      self: vViewSnap,
      refName: f.refName,
      coord: f.mateStart,
    })
    const p2v = bpToPx({
      self: vViewSnap,
      refName: f.refName,
      coord: f.mateEnd,
    })

    if (p1h === undefined || p2h === undefined || p1v === undefined || p2v === undefined) {
      continue
    }

    x1Array[validCount] = p1h.offsetPx
    x2Array[validCount] = p2h.offsetPx

    y1Array[validCount] = height - p1v.offsetPx
    y2Array[validCount] = height - p2v.offsetPx

    featureIds.push(f.id)
    cigars.push(f.cigar ?? '')
    validCount++
  }

  const result = {
    x1_offsetPx: x1Array.slice(0, validCount),
    y1_offsetPx: y1Array.slice(0, validCount),
    x2_offsetPx: x2Array.slice(0, validCount),
    y2_offsetPx: y2Array.slice(0, validCount),
    featureIds,
    cigars,
  }

  return rpcResult(result, [
    result.x1_offsetPx.buffer,
    result.y1_offsetPx.buffer,
    result.x2_offsetPx.buffer,
    result.y2_offsetPx.buffer,
  ] as ArrayBuffer[])
}
