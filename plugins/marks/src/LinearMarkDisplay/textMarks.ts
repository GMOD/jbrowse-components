import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { measureText } from '@jbrowse/core/util/measureText'
import { TEXT_BASELINE_RATIO, cullOverlappingLabels } from '@jbrowse/display-ui'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import {
  LINK_ELSEWHERE,
  linkApex,
  paintColors,
  rowColor,
  rowSlot,
} from '@jbrowse/render-core/marks'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { pointYPx } from '@jbrowse/render-core/shaders/pointMark'

import {
  linkChannelsOf,
  linkParamsOf,
  markDrawsAt,
  regionColorScale,
} from './markList.ts'

import type {
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
  TextMarkEntry,
} from './markList.ts'
import type { LinkApex } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/** The size a text mark prints at, the feature labels' own. */
export const TEXT_MARK_FONT_PX = 11

/** The halo's reach on each side of a glyph, in px, on screen and in the export alike. */
export const TEXT_HALO_PX = 1

const ABOVE_VALUE_GAP_PX = 2

export interface TextFont {
  size: number
  family?: string
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
 * The top of a label's glyph box at the apex of the curve it counts: just
 * inside the apex, clear of the stroke, where the curve encloses room for the
 * whole box, and just outside it otherwise.
 */
export function labelTopAtApex(
  apex: LinkApex,
  width: number,
  fontSize: number,
) {
  const clear = apex.strokePx / 2 + ABOVE_VALUE_GAP_PX
  const side = fitsUnderApex(apex, clear, width, fontSize)
    ? apex.inward
    : -apex.inward
  return side > 0 ? apex.y + clear : apex.y - clear - fontSize
}

// The box's near edge stands `rise - clear` off the baseline, where a
// half-ellipse of radii (halfWidth, rise) is narrowest across the box.
function fitsUnderApex(
  { rise, halfWidth, strokePx }: LinkApex,
  clear: number,
  width: number,
  fontSize: number,
) {
  const near = rise - clear
  if (halfWidth <= 0 || near < fontSize) {
    return false
  }
  const t = near / rise
  return halfWidth * Math.sqrt(1 - t * t) - strokePx / 2 >= width / 2
}

function footKey(x: number, x2: number, row: number) {
  return `${x}:${x2}:${row}`
}

const linkInstances = new WeakMap<StoredLayer, Map<string, number>>()

// Each curve's instance by its two feet and its row, the one this payload
// draws where a copy is drawn elsewhere. Kept per layer, which a fetch
// replaces, so a pan builds nothing.
function linkInstanceByFeet(layer: StoredLayer) {
  let byFeet = linkInstances.get(layer)
  if (!byFeet) {
    byFeet = new Map()
    const { x, x2, row, x2Region } = layer
    for (let i = 0; i < layer.count; i++) {
      const key = footKey(x[i]!, x2[i]!, row?.[i] ?? 0)
      const had = byFeet.get(key)
      if (had === undefined || x2Region?.[had] === LINK_ELSEWHERE) {
        byFeet.set(key, i)
      }
    }
    linkInstances.set(layer, byFeet)
  }
  return byFeet
}

/**
 * The apex of the curve a link mark drawing at this zoom puts on the same two
 * feet in the same row; null where one does but draws no apex there, and
 * undefined where none does.
 */
function apexOver(
  entries: readonly TextMarkEntry[],
  region: MarkRegionData,
  block: RenderBlock,
  state: MarkRenderState,
  key: string,
): LinkApex | null | undefined {
  for (const [markIndex, entry] of entries.entries()) {
    const channels =
      entry.type === 'link' && markDrawsAt(entry, state.bpPerPx)
        ? linkChannelsOf(region, markIndex)
        : undefined
    const instance = channels && linkInstanceByFeet(channels).get(key)
    if (channels && instance !== undefined) {
      return (
        linkApex(
          channels,
          block,
          state,
          linkParamsOf(entry, markIndex, state, region),
          instance,
        ) ?? null
      )
    }
  }
  return undefined
}

/**
 * Every label the text marks drawing at this zoom place over the loaded
 * regions, culled. An instance's label stands over the middle of its span,
 * just above its `y` where the mark names one; where it names none, at the
 * apex of the curve a link mark draws on the same two feet in the same row
 * (`labelTopAtApex`), left out where that curve has no apex on the band, and
 * in the middle of its row band where no link draws one. It prints in the
 * mark's colour, or in `defaultColor` where the config leaves it at the mark
 * default. Labels are kept left to right, and one whose glyphs would meet a
 * kept label's halo or leave the plot is left out, so the labels read as
 * ggplot2's `check_overlap` leaves them for data in screen order. One rule for
 * the screen and the export, which differ only in how they emit its answer.
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
      const colors = entry.ownColor
        ? paintColors(layer, count, regionColorScale(state, region, markIndex))
        : undefined
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
        const apex = entry.valued
          ? undefined
          : apexOver(
              entries,
              region,
              block,
              state,
              footKey(x[i]!, x2[i]!, row?.[i] ?? 0),
            )
        if (apex === null) {
          continue
        }
        const width = measureText(label, font.size, font.family)
        const value = values?.[i]
        const bandTop = band * slot - state.scrollTop
        const baseline = apex
          ? labelTopAtApex(apex, width, font.size) + ascent
          : value !== undefined && Number.isFinite(value)
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
        const centre = apex ? apex.x : bpToPx(mid)
        const own = colors?.[i]
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
