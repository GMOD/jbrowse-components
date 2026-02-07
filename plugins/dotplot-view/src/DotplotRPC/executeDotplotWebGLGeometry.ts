import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { MismatchParser } from '@jbrowse/plugin-alignments'

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

function parseCigarToSegments(cigar: string) {
  const parsed = MismatchParser.parseCigar(cigar)
  const segments: Array<{ len: number; op: string }> = []
  for (let i = 0; i < parsed.length; i += 2) {
    segments.push({
      len: +parsed[i]!,
      op: parsed[i + 1]!,
    })
  }
  return segments
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
  console.log('executeDotplotWebGLGeometry: called with', features.length, 'features')
  console.log('executeDotplotWebGLGeometry: view dims', {
    hViewWidth: hViewSnap.width,
    vViewWidth: vViewSnap.width,
    height,
  })

  // Pre-allocate with conservative estimate (assume some features have CIGAR)
  const maxCount = features.length * 3
  const x1Array = new Float32Array(maxCount)
  const y1Array = new Float32Array(maxCount)
  const x2Array = new Float32Array(maxCount)
  const y2Array = new Float32Array(maxCount)
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

    // Check if we have CIGAR data to decompose
    if (f.cigar) {
      const segments = parseCigarToSegments(f.cigar)
      let queryPos = f.start
      let matePos = f.mateStart

      for (const seg of segments) {
        const segQueryStart = queryPos
        const segMateStart = matePos

        // Update positions based on CIGAR operation
        if (seg.op === 'M' || seg.op === '=' || seg.op === 'X') {
          queryPos += seg.len
          matePos += seg.len
        } else if (seg.op === 'D' || seg.op === 'N') {
          queryPos += seg.len
        } else if (seg.op === 'I') {
          matePos += seg.len
        }

        // Convert to pixel coordinates
        let hSegStart = segQueryStart
        let hSegEnd = queryPos
        if (f.strand === -1) {
          ;[hSegEnd, hSegStart] = [hSegStart, hSegEnd]
        }

        const psqh1 = bpToPx({ self: hViewSnap, refName: f.refName, coord: hSegStart })
        const psqh2 = bpToPx({ self: hViewSnap, refName: f.refName, coord: hSegEnd })
        const psmh1 = bpToPx({ self: vViewSnap, refName: f.refName, coord: segMateStart })
        const psmh2 = bpToPx({ self: vViewSnap, refName: f.refName, coord: matePos })

        if (psqh1 !== undefined && psqh2 !== undefined && psmh1 !== undefined && psmh2 !== undefined) {
          x1Array[validCount] = psqh1.offsetPx
          x2Array[validCount] = psqh2.offsetPx
          y1Array[validCount] = height - psmh1.offsetPx
          y2Array[validCount] = height - psmh2.offsetPx
          featureIds.push(f.id)
          cigars.push('')
          validCount++
        }
      }
    } else {
      // No CIGAR, render as single segment
      x1Array[validCount] = p1h.offsetPx
      x2Array[validCount] = p2h.offsetPx
      y1Array[validCount] = height - p1v.offsetPx
      y2Array[validCount] = height - p2v.offsetPx
      featureIds.push(f.id)
      cigars.push('')
      if (validCount < 3) {
        console.log(`Feature ${validCount}: coords (${p1h.offsetPx}, ${height - p1v.offsetPx}) -> (${p2h.offsetPx}, ${height - p2v.offsetPx})`)
      }
      validCount++
    }
  }

  const result = {
    x1_offsetPx: x1Array.slice(0, validCount),
    y1_offsetPx: y1Array.slice(0, validCount),
    x2_offsetPx: x2Array.slice(0, validCount),
    y2_offsetPx: y2Array.slice(0, validCount),
    featureIds,
    cigars,
  }

  console.log('executeDotplotWebGLGeometry: returning', validCount, 'valid features')
  if (validCount > 0) {
    console.log('First feature coords:', {
      x1: result.x1_offsetPx[0],
      y1: result.y1_offsetPx[0],
      x2: result.x2_offsetPx[0],
      y2: result.y2_offsetPx[0],
    })
  }

  return rpcResult(result, [
    result.x1_offsetPx.buffer,
    result.y1_offsetPx.buffer,
    result.x2_offsetPx.buffer,
    result.y2_offsetPx.buffer,
  ] as ArrayBuffer[])
}
