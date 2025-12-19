import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from './samFlags'

import type { Feature } from '@jbrowse/core/util'

export interface CoreFeat {
  strand: number
  refName: string
  start: number
  end: number
  tlen?: number
  pair_orientation?: string
  next_ref?: string
}

export function jitter(n: number) {
  return Math.random() * 2 * n - n
}

export function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
}

export function extractCoreFeat(f: Feature): CoreFeat {
  return {
    refName: f.get('refName'),
    start: f.get('start'),
    end: f.get('end'),
    strand: f.get('strand'),
    tlen: f.get('template_length'),
    pair_orientation: f.get('pair_orientation'),
    next_ref: f.get('next_ref'),
  }
}

export function extractCoreFeatBasic(f: Feature): CoreFeat {
  return {
    refName: f.get('refName'),
    start: f.get('start'),
    end: f.get('end'),
    strand: f.get('strand'),
  }
}

export function getStrandRelativeFirstClipLength(f: Feature | CoreFeat) {
  return 'get' in f
    ? f.get('clipLengthAtStartOfRead')
    : (f as CoreFeat & { clipLengthAtStartOfRead: number })
        .clipLengthAtStartOfRead
}

export function toCoreFeat(f: Feature | CoreFeat): CoreFeat {
  return 'get' in f ? extractCoreFeat(f) : f
}

export function toCoreFeatBasic(f: Feature | CoreFeat): CoreFeat {
  return 'get' in f ? extractCoreFeatBasic(f) : f
}

export function getMateInfo(f: Feature): CoreFeat {
  const flags = f.get('flags') || 0
  const mateStrand = flags & SAM_FLAG_MATE_REVERSE ? -1 : 1
  return {
    refName: f.get('next_ref') || '',
    start: f.get('next_pos') || 0,
    end: f.get('next_pos') || 0,
    strand: mateStrand,
  }
}

export function filterPairedChain(chain: Feature[]) {
  const result: Feature[] = []
  for (const f of chain) {
    const flags = f.get('flags')
    // Filter out supplementary and mate unmapped
    if (
      !(flags & SAM_FLAG_SUPPLEMENTARY) &&
      !(flags & SAM_FLAG_MATE_UNMAPPED)
    ) {
      result.push(f)
    }
  }
  return result
}

export function filterAndSortLongReadChain(chain: Feature[]) {
  const filtered: Feature[] = []
  for (const f of chain) {
    // Filter out secondary alignments
    if (!(f.get('flags') & SAM_FLAG_SECONDARY)) {
      filtered.push(f)
    }
  }
  filtered.sort(
    (a, b) =>
      a.get('clipLengthAtStartOfRead') - b.get('clipLengthAtStartOfRead'),
  )
  return filtered
}
