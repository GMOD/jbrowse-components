import { max, toLocale } from '@jbrowse/core/util'

import type { Slice } from './slices.ts'

// The label geometry `Ruler.tsx` draws with, kept here rather than there so the
// SVG export can measure a figure without importing a component module (which
// react-refresh requires stay component-only).
export const labelFontSizePx = 13

// how far outside the ruler arc a label is anchored
export const labelOffsetPx = 5

// rough advance width of one character at `labelFontSizePx`. Only ever used to
// compare a label against the arc it would sit on, so an estimate is enough —
// but it has to be *one* estimate, since the fit test and the room reserved for
// the labels that fail it must agree.
const charWidthPx = 6.5

export function labelWidthPx(text: string) {
  return text.length * charWidthPx
}

// a label short enough to sit along its own arc runs tangentially; a longer one
// radiates outward instead
export function labelFitsAlongArc(text: string, maxWidthPx: number) {
  return labelWidthPx(text) < maxWidthPx
}

// an empty label, or an arc too short to hang one off, draws nothing at all.
// One predicate, so `RulerLabel` and the room `labelGutterPx` reserves for it
// can't disagree about which labels exist
export function labelIsDrawn(text: string, maxWidthPx: number) {
  return !!text && maxWidthPx > 4
}

// the text a slice labels itself with: its refName, or how many regions the
// elision swallowed
export function sliceLabelText(slice: Slice) {
  const { region } = slice
  return region.elided ? `[${toLocale(region.regions.length)}]` : region.refName
}

/**
 * How far past the ruler arc this figure's labels actually reach. A label too
 * long for its own arc radiates outward (see `RulerLabel`), so the longest of
 * those sets how much room the figure has to leave outside the circle.
 *
 * The on-screen view reserves a fixed `paddingPx` for this and lives in a box
 * that clips anyway; an SVG export is a standalone artifact, so it sizes its
 * canvas to the labels it drew. The default 80px gutter is already too small
 * for 12-character RefSeq accessions, which came out cut off at the edge.
 */
export function labelGutterPx(model: {
  radiusPx: number
  staticSlices: Slice[]
}) {
  const { radiusPx, staticSlices } = model
  return max(
    staticSlices.map(slice => {
      const text = sliceLabelText(slice)
      const maxWidthPx = (slice.endRadians - slice.startRadians) * radiusPx
      if (!labelIsDrawn(text, maxWidthPx)) {
        return 0
      }
      return (
        labelOffsetPx +
        // a tangential label is centered on the anchor, so it reaches outward
        // by half its height rather than by its length
        (labelFitsAlongArc(text, maxWidthPx)
          ? labelFontSizePx / 2
          : labelWidthPx(text))
      )
    }),
    0,
  )
}
