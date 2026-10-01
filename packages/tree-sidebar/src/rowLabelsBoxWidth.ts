import { max, measureText } from '@jbrowse/core/util'

import { fittedLabel } from './fittedLabel.ts'
import { rowLabelsCarryText } from './rowLabelsCarryText.ts'

import type { RowLabelSource } from './types.ts'

export const ROW_SWATCH_WIDTH = 8

/**
 * Widest a row label's text may draw, in px. One long name among short ones
 * would otherwise set the width of the whole strip, so a name past this is cut
 * with an ellipsis and the strip stops at it. 120px holds about 20 characters
 * at the 12px label size, which covers sample and species names whole.
 */
export const ROW_LABEL_MAX_TEXT_WIDTH = 120

const ROW_LABEL_PAD = 10

export function rowLabelFontSize(rowHeight: number) {
  return Math.min(rowHeight, 12)
}

/**
 * Height of a label's box, centered in its row: one line of text, not the row,
 * so a tall row does not draw a tall cell around a short name. Rows at or
 * below a line's height get boxes that abut, as one strip.
 */
export function rowLabelBoxHeight(rowHeight: number) {
  return Math.min(rowHeight, rowLabelFontSize(rowHeight) + 4)
}

export function rowLabelFullText(source: RowLabelSource) {
  return source.label ?? source.name
}

export function rowLabelText(source: RowLabelSource, rowHeight: number) {
  return fittedLabel(
    rowLabelFullText(source),
    ROW_LABEL_MAX_TEXT_WIDTH,
    rowLabelFontSize(rowHeight),
  )
}

export function rowLabelsBoxWidth(
  sources: RowLabelSource[],
  rowHeight: number,
) {
  const fontSize = rowLabelFontSize(rowHeight)
  return rowLabelsCarryText(rowHeight)
    ? max(
        sources.map(
          s =>
            Math.min(
              measureText(rowLabelFullText(s), fontSize),
              ROW_LABEL_MAX_TEXT_WIDTH,
            ) + ROW_LABEL_PAD,
        ),
        ROW_LABEL_PAD,
      )
    : ROW_SWATCH_WIDTH
}
