import type { Feature } from '@jbrowse/core/util'

export interface CoreFeat {
  strand: number
  refName: string
  start: number
  end: number
  tlen?: number
  pair_orientation?: string
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

export function getClipPos(f: Feature | CoreFeat) {
  return 'get' in f
    ? f.get('clipPos')
    : (f as CoreFeat & { clipPos: number }).clipPos
}

export function toCoreFeat(f: Feature | CoreFeat): CoreFeat {
  return 'get' in f ? extractCoreFeat(f as Feature) : f
}

export function toCoreFeatBasic(f: Feature | CoreFeat): CoreFeat {
  return 'get' in f ? extractCoreFeatBasic(f as Feature) : f
}

export function getMateInfo(f: Feature): CoreFeat {
  return {
    refName: f.get('next_ref') || '',
    start: f.get('next_pos') || 0,
    end: f.get('next_pos') || 0,
    strand: f.get('strand'),
  }
}

export function filterPairedChain(chain: Feature[]) {
  const result: Feature[] = []
  for (const f of chain) {
    const flags = f.get('flags')
    // Filter out supplementary (2048) and mate unmapped (8)
    if (!(flags & 2048) && !(flags & 8)) {
      result.push(f)
    }
  }
  return result
}

export function filterAndSortLongReadChain(chain: Feature[]) {
  const filtered: Feature[] = []
  for (const f of chain) {
    // Filter out secondary alignments (256)
    if (!(f.get('flags') & 256)) {
      filtered.push(f)
    }
  }
  filtered.sort((a, b) => a.get('clipPos') - b.get('clipPos'))
  return filtered
}
