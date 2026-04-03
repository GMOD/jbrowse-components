import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import type { SyntenyColorPalette } from '../model.ts'

type Rgb3 = [number, number, number]

export function fillSyntenyUniforms(
  f: Float32Array,
  width: number,
  height: number,
  rowHeight: number,
  bpRangeHi: number,
  bpRangeLo: number,
  bpRangeLen: number,
  regionScreenLeft: number,
  regionScreenWidth: number,
  rowPadding: number,
  coverageHeight: number,
  depthScale: number,
  palette: SyntenyColorPalette,
) {
  f[0] = width
  f[1] = height
  f[2] = rowHeight
  f[3] = coverageHeight
  f[4] = bpRangeHi
  f[5] = bpRangeLo
  f[6] = bpRangeLen
  f[7] = regionScreenLeft
  f[8] = regionScreenWidth
  f[9] = 0
  f[10] = rowPadding
  f[11] = YSCALEBAR_LABEL_OFFSET
  f[12] = depthScale
  writeRgb(f, 13, palette.coverageColorRgb)
  writeRgb(f, 16, palette.baseColorGl.A)
  writeRgb(f, 19, palette.baseColorGl.C)
  writeRgb(f, 22, palette.baseColorGl.G)
  writeRgb(f, 25, palette.baseColorGl.T)
}

function writeRgb(f: Float32Array, offset: number, rgb: Rgb3) {
  f[offset] = rgb[0]
  f[offset + 1] = rgb[1]
  f[offset + 2] = rgb[2]
}
