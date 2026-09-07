import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { arcAvailH, arcYScale } from '../../features/arcs/arcYScale.ts'
import { ARC_SLOT_KEYS } from '../../shaders/palettes.ts'
import * as arcShader from '../../shaders/slang/arc.generated.ts'

import type { ColorPalette } from '../../shaders/colors.ts'

export const ARC_BAND_UNIFORMS_SIZE_BYTES = arcShader.UNIFORMS_SIZE_BYTES

/**
 * Everything the arc band's UBO holds that a caller decides. `hpZero` is absent
 * because it is not one, and `arcsYDomainBp` / `arcsYLog` are absent because
 * they are `arcYScale`'s answer rather than a caller's — the same domain rule
 * the Canvas2D and SVG draws apply, resolved here so the two renderers cannot
 * pick different ones.
 */
export interface ArcBandUniformValues {
  /** HP-split start + span of the BLOCK; keep `bpLen` POSITIVE and flip via `reversed`. */
  bpHi: number
  bpLo: number
  bpLen: number
  /** The span clip [-1,1] covers horizontally — the block's scissored width. */
  canvasW: number
  canvasH: number
  reversed: boolean
  /** The arc baseline in absolute canvas px — `arcAnchorY`, band bottom in up mode. */
  arcAnchorPx: number
  arcBandH: number
  /** The block's own px projection, which carries a foot extrapolated outside it. */
  blockStartPx: number
  blockWidth: number
  /** The configured `readConnectionsLineWidth`; raised here to the AA floor. */
  lineWidthPx: number
  down: boolean
  /** Read cloud's autoscaled max |insert size|; `undefined` in arc mode. */
  arcsYDomainBp: number | undefined
  dpr: number
  colors: ColorPalette
}

/**
 * One arc palette slot as the `float4` the shader's `arcColor[]` holds. The
 * return type is spelled out because it is what makes the nine-entry literal
 * below a tuple the generated packer accepts: a slot added to the shader's
 * array is then a compile error here rather than a slot nothing writes.
 */
function arcSlot(
  colors: ColorPalette,
  slot: number,
): [number, number, number, number] {
  const rgb = colors[ARC_SLOT_KEYS[slot]!]
  return [rgb[0], rgb[1], rgb[2], 1]
}

/**
 * Fill the arc band's uniform buffer. Total-write (the generated packer), so a
 * field left out is a compile error rather than the pileup's value — which is
 * what it was, when the band memcpy'd the pileup UBO and poked the slots it
 * cared about on top.
 */
export function writeArcBandUniforms(
  buf: ArrayBuffer,
  v: ArcBandUniformValues,
) {
  const { colors, dpr } = v
  const pxPerBp = v.blockWidth / v.bpLen
  const { domainBp, log } = arcYScale(
    v.arcsYDomainBp,
    arcAvailH(v.arcBandH),
    pxPerBp,
  )
  arcShader.writeUniforms(buf, {
    bpHi: v.bpHi,
    bpLo: v.bpLo,
    bpLen: v.bpLen,
    hpZero: 0,
    canvasW: v.canvasW,
    canvasH: v.canvasH,
    covOffset: v.arcAnchorPx,
    arcBandH: v.arcBandH,
    blockStartPx: v.blockStartPx,
    blockWidth: v.blockWidth,
    // A near-horizontal arc thinner than ~1.5 device px has no vertical room to
    // anti-alias and stairsteps. Floor at 1.5 device px (expressed in CSS px via
    // /dpr) so the AA always spans >1px. On HiDPI a 1px CSS line is already 2
    // device px, so the floor is below it and the look is unchanged.
    lineWidthPx: Math.max(v.lineWidthPx, 1.5 / dpr),
    pairedArcsDown: v.down ? 1 : 0,
    arcsYDomainBp: domainBp,
    arcsYLog: log ? 1 : 0,
    reversed: v.reversed ? 1 : 0,
    devicePixelRatio: dpr,
    colorFlatConnector: normalizedRgbToABGR(...colors.colorFlatConnector),
    arcColor: [
      arcSlot(colors, 0),
      arcSlot(colors, 1),
      arcSlot(colors, 2),
      arcSlot(colors, 3),
      arcSlot(colors, 4),
      arcSlot(colors, 5),
      arcSlot(colors, 6),
      arcSlot(colors, 7),
      arcSlot(colors, 8),
    ],
  })
}
