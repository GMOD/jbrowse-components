import { max, measureText } from '@jbrowse/core/util'

import { fittedLabel } from './fittedLabel.ts'

import type { RowLabelSource } from './types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

/**
 * Below this a label's text is illegible, so the row draws as a color swatch
 * only. The swatch still draws at a fraction of a pixel a row (1,987 canids in
 * 640px is 0.32px), where the tint is the only thing carrying row identity.
 */
const MIN_TEXT_ROW_HEIGHT = 6

const SCREEN_LABEL_FONT_SIZE = 12

/**
 * Widest a row label's text may draw, in ems: about 20 characters, which holds
 * sample and species names whole. A longer name is cut with an ellipsis rather
 * than setting the width of the whole strip.
 */
const ROW_LABEL_MAX_EMS = 10

const ROW_LABEL_PAD = 10

export const ROW_SWATCH_WIDTH = 8

/**
 * Whether a row this tall draws its name rather than a bare color swatch. A
 * display asks it too before drawing a color key, which would only restate
 * names the rows already show.
 */
export function rowLabelsCarryText(rowHeight: number) {
  return rowHeight >= MIN_TEXT_ROW_HEIGHT
}

/** The sidebar's text size: the export's, or the screen's. */
export function sidebarFontSize(text?: ExportTextStyle) {
  return text?.fontSize ?? SCREEN_LABEL_FONT_SIZE
}

export function rowLabelFontSize(rowHeight: number, text?: ExportTextStyle) {
  return Math.min(rowHeight, sidebarFontSize(text))
}

/**
 * Height of a label's box, centered in its row: one line of text, not the row,
 * so a tall row does not draw a tall cell around a short name. Rows at or
 * below a line's height get boxes that abut, as one strip.
 */
export function rowLabelBoxHeight(rowHeight: number, text?: ExportTextStyle) {
  return Math.min(rowHeight, rowLabelFontSize(rowHeight, text) + 4)
}

export function rowLabelFullText(source: RowLabelSource) {
  return source.label ?? source.name
}

export function rowLabelText(
  source: RowLabelSource,
  rowHeight: number,
  text?: ExportTextStyle,
) {
  const fontSize = rowLabelFontSize(rowHeight, text)
  return fittedLabel(
    rowLabelFullText(source),
    ROW_LABEL_MAX_EMS * fontSize,
    fontSize,
    text?.fontFamily,
  )
}

export function rowLabelsBoxWidth(
  sources: RowLabelSource[],
  rowHeight: number,
  text?: ExportTextStyle,
) {
  const fontSize = rowLabelFontSize(rowHeight, text)
  return rowLabelsCarryText(rowHeight)
    ? max(
        sources.map(
          s =>
            Math.min(
              measureText(rowLabelFullText(s), fontSize, text?.fontFamily),
              ROW_LABEL_MAX_EMS * fontSize,
            ) + ROW_LABEL_PAD,
        ),
        ROW_LABEL_PAD,
      )
    : ROW_SWATCH_WIDTH
}
