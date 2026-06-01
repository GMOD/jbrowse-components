import {
  abgrToCssRgba,
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

// Per-base-quality color ramp, one ABGR-packed entry per score 0-255. Score 255
// lights up green (hue 150); lower scores wrap red→yellow (hue = score*1.5),
// matching origin/main renderPerBaseQuality. Packed once here so the GPU vertex
// buffer (packGpu) and the Canvas2D fill (drawCanvas) read the same bytes and
// can't drift in color.
export const qualityAbgr = Uint32Array.from({ length: 256 }, (_, score) => {
  const hue = score === 255 ? 150 : score * 1.5
  const c = parseCssColor(`hsl(${hue},55%,50%)`)
  return packAbgr(getRed(c), getGreen(c), getBlue(c), 255)
})

export const qualityCssColors = Array.from(qualityAbgr, abgrToCssRgba)
