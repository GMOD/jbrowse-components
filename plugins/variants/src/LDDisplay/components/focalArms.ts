import { bandRowFirstColumn } from '../../RenderLDDataRPC/ldBand.ts'

export function focalArmColumns(f: number, n: number, band: number) {
  return {
    first: bandRowFirstColumn(f, band),
    last: Math.min(n - 1, f + band),
  }
}
