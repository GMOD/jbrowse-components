import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { colorAt } from '@jbrowse/core/util/markEncoding'
import { measureText } from '@jbrowse/core/util/measureText'
import { TEXT_BASELINE_RATIO, cullOverlappingLabels } from '@jbrowse/display-ui'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { rowColor, rowSlot } from '@jbrowse/render-core/marks'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { pointYPx } from '@jbrowse/render-core/shaders/pointMark'

import { markDrawsAt } from './markList.ts'

import type {
  MarkRegionData,
  MarkRenderState,
  TextMarkEntry,
} from './markList.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/** The size a text mark prints at, the feature labels' own. */
export const TEXT_MARK_FONT_PX = 11

/** The halo's reach on each side of a glyph, in px, on screen and in the export alike. */
export const TEXT_HALO_PX = 1

const ABOVE_VALUE_GAP_PX = 2

export interface TextFont {
  size: number
  family: string
}

/** One label the text layer draws, in the plot's CSS px. */
export interface PlacedText {
  markIndex: number
  regionIndex: number
  instance: number
  text: string
  /** The label's horizontal centre. */
  x: number
  /** The glyphs' baseline, from the plot's top. */
  baseline: number
  width: number
  color: string
}

// The box the glyphs fill, as the DOM line box and the exported `<text>` both
// draw it: the halo reaches `TEXT_HALO_PX` beyond it on every side.
interface Candidate extends PlacedText {
  left: number
  right: number
  top: number
  bottom: number
}

// A label sits just above its value. One that would leave its band over the
// top goes under the value instead, where the band has room for it.
function baselineAt(
  valuePx: number,
  bandTop: number,
  bandHeight: number,
  fontSize: number,
): number {
  const above = valuePx - ABOVE_VALUE_GAP_PX
  const below = valuePx + ABOVE_VALUE_GAP_PX + fontSize
  return above - fontSize >= bandTop || below > bandTop + bandHeight
    ? above
    : below
}

/**
 * Every label the text marks drawing at this zoom place over the loaded
 * regions, culled. An instance's label stands over the middle of its span,
 * just above its `y` where the mark names one and in the middle of its row
 * band otherwise, in the mark's colour or in `defaultColor` where the config
 * leaves it at the mark default. Labels are kept left to right, and one whose
 * glyphs would meet a kept label's halo or leave the plot is left out, so the
 * labels read as ggplot2's `check_overlap` leaves them for data in screen
 * order. One rule for the screen and the export, which differ only in how
 * they emit its answer.
 */
export function placeTextMarks(
  entries: readonly TextMarkEntry[],
  regions: ReadonlyMap<number, MarkRegionData>,
  blocks: readonly RenderBlock[],
  state: MarkRenderState,
  font: TextFont,
  defaultColor: string,
): PlacedText[] {
  const candidates: Candidate[] = []
  const band = state.rowHeight
  const [domainMin, domainMax] = state.domainY
  const scaleType = scaleTypeCode(state.scaleTypeY)
  const ascent = font.size * TEXT_BASELINE_RATIO
  const descent = font.size - ascent
  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region) {
      continue
    }
    const bpToPx = makeBpMapper(block)
    for (const [markIndex, entry] of entries.entries()) {
      const layer = region.layers[markIndex]
      const text = layer?.text
      if (
        entry.type !== 'text' ||
        !markDrawsAt(entry, state.bpPerPx) ||
        !layer ||
        !text
      ) {
        continue
      }
      const { x, x2, y, row, count } = layer
      const values = entry.valued ? y : undefined
      for (let i = 0; i < count; i++) {
        const label = text[i]
        const mid = (x[i]! + x2[i]!) / 2
        if (!label || mid < block.start || mid >= block.end) {
          continue
        }
        const slot = rowSlot(row, i, state.rowTable)
        if (slot === undefined) {
          continue
        }
        const value = values?.[i]
        const bandTop = band * slot - state.scrollTop
        const baseline =
          value !== undefined && Number.isFinite(value)
            ? baselineAt(
                bandTop +
                  pointYPx(
                    value,
                    domainMin,
                    domainMax,
                    band,
                    scaleType,
                    state.valueInsetPx,
                    state.symlogConstantY,
                  ),
                bandTop,
                band,
                font.size,
              )
            : bandTop + band / 2 + font.size * (TEXT_BASELINE_RATIO - 0.5)
        const centre = bpToPx(mid)
        const width = measureText(label, font.size, font.family)
        const own = entry.ownColor ? colorAt(layer, i) : undefined
        candidates.push({
          markIndex,
          regionIndex: block.displayedRegionIndex,
          instance: i,
          text: label,
          x: centre,
          baseline,
          width,
          color:
            own === undefined
              ? defaultColor
              : abgrToCssRgba(rowColor(own, row, i, state.rowTable)),
          left: centre - width / 2,
          right: centre + width / 2,
          top: baseline - ascent,
          bottom: baseline + descent,
        })
      }
    }
  }
  return cullOverlappingLabels(
    candidates,
    state.canvasWidth,
    state.canvasHeight,
    TEXT_HALO_PX,
    (a, b) => a.markIndex - b.markIndex || a.instance - b.instance,
  ).map(({ left, right, top, bottom, ...placed }) => placed)
}
