import { bandRowFirstColumn } from '../../RenderLDDataRPC/ldBand.ts'

export function indexArmColumns(f: number, n: number, band: number) {
  return {
    first: bandRowFirstColumn(f, band),
    last: Math.min(n - 1, f + band),
  }
}

export interface IndexSnpHighlightSource {
  rpcData: { boundaries: Float32Array; band: number } | null
  indexSnpColumn: number
  viewTransform: { viewScale: number }
  cellToScreen: (x: number, y: number) => { x: number; y: number }
}

function armsGeometry(
  { boundaries, band }: { boundaries: Float32Array; band: number },
  f: number,
  { viewTransform, cellToScreen }: IndexSnpHighlightSource,
) {
  const { first, last } = indexArmColumns(f, boundaries.length - 1, band)
  const center = (i: number) => (boundaries[i]! + boundaries[i + 1]!) / 2
  const fCenter = center(f)
  const apex = cellToScreen(fCenter, fCenter)
  const rowEnd = first < f ? cellToScreen(center(first), fCenter) : apex
  const colEnd = last > f ? cellToScreen(fCenter, center(last)) : apex
  return {
    d: `M ${rowEnd.x} ${rowEnd.y} L ${apex.x} ${apex.y} L ${colEnd.x} ${colEnd.y}`,
    apex,
    strokeWidth: Math.min(
      40,
      Math.max(
        4,
        (boundaries[f + 1]! - boundaries[f]!) * viewTransform.viewScale,
      ),
    ),
  }
}

export type IndexSnpHighlightGeometry = ReturnType<typeof armsGeometry>

// Every pairwise cell involving the index SNP lies on the two diagonals meeting
// at its apex: its row fans down-left, its column down-right.
export function indexSnpHighlightGeometry(source: IndexSnpHighlightSource) {
  const { rpcData, indexSnpColumn: f } = source
  return rpcData && f >= 0 && f + 1 < rpcData.boundaries.length
    ? armsGeometry(rpcData, f, source)
    : undefined
}
