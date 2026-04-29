import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  FIELD_OFFSET_F32 as FILL_FIELD,
  INSTANCE_STRIDE_F32 as FILL_STRIDE,
} from '../../shaders/multiSyntenyFill.generated.ts'

import type { BlockGeometryData } from './packGpu.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawFillCanvas(
  ctx: Ctx2D,
  region: BlockGeometryData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  coverageHeight: number,
  rowHeight: number,
  rowPadding: number,
) {
  if (region.instanceCount === 0) {
    return
  }
  const u32 = new Uint32Array(region.buffer)
  for (let i = 0; i < region.instanceCount; i++) {
    const off = i * FILL_STRIDE
    const x1 = bpToX(u32[off + FILL_FIELD.startBp]!)
    const x2 = bpToX(u32[off + FILL_FIELD.endBp]!)
    const w = Math.max(x2 - x1, 1)
    if (x1 + w < 0 || x1 > viewWidth) {
      continue
    }
    const genomeRow = u32[off + FILL_FIELD.genomeRow]!
    const y = coverageHeight + genomeRow * rowHeight + rowPadding
    const h = rowHeight - rowPadding * 2
    ctx.fillStyle = abgrToCssRgba(u32[off + FILL_FIELD.color]!)
    ctx.fillRect(x1, y, w, h)
  }
}
