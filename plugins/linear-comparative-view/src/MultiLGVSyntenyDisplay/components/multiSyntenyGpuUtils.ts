import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import { UNIFORM_OFFSET_F32 as U } from './shaders/multiSyntenyFill.generated.ts'

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
  f[U.resolutionX] = width
  f[U.resolutionY] = height
  f[U.rowHeight] = rowHeight
  f[U.coverageHeight] = coverageHeight
  f[U.bpRangeHi] = bpRangeHi
  f[U.bpRangeLo] = bpRangeLo
  f[U.bpRangeLen] = bpRangeLen
  f[U.regionScreenLeft] = regionScreenLeft
  f[U.regionScreenWidth] = regionScreenWidth
  f[U.hpZero] = 0
  f[U.rowPadding] = rowPadding
  f[U.coverageYOffset] = YSCALEBAR_LABEL_OFFSET
  f[U.depthScale] = depthScale
  writeRgb(f, U.coverageR, palette.coverageColorRgb)
  writeRgb(f, U.baseAR, palette.baseColorGl.A)
  writeRgb(f, U.baseCR, palette.baseColorGl.C)
  writeRgb(f, U.baseGR, palette.baseColorGl.G)
  writeRgb(f, U.baseTR, palette.baseColorGl.T)
}

function writeRgb(f: Float32Array, offset: number, rgb: Rgb3) {
  f[offset] = rgb[0]
  f[offset + 1] = rgb[1]
  f[offset + 2] = rgb[2]
}
