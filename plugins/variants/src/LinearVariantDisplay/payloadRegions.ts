import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { VariantCellData } from './components/computeVariantCells.ts'

/**
 * One entry per region the payload holds, keyed by its displayed region
 * index: the shape of every per-region derivation of the payload. Empty with
 * no payload.
 */
export function mapPayloadRegions<T>(
  cellData: CellDataResult | undefined,
  derive: (data: VariantCellData, displayedRegionIndex: number) => T,
) {
  const out = new Map<number, T>()
  if (cellData) {
    for (const k in cellData.perRegionCellData) {
      const displayedRegionIndex = Number(k)
      out.set(
        displayedRegionIndex,
        derive(cellData.perRegionCellData[k]!, displayedRegionIndex),
      )
    }
  }
  return out
}
