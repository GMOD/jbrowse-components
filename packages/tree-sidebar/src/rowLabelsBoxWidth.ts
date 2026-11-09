import { max, measureText } from '@jbrowse/core/util'

import { fittedLabel } from './fittedLabel.ts'

import type { RowAnnotationColumn, RowLabelSource } from './types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

/**
 * Below this a label's text is illegible, so the row draws as a color swatch
 * only. The swatch still draws at a fraction of a pixel a row (1,987 canids in
 * 640px is 0.32px), where the color is the only thing carrying row identity.
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

/** Width of the bar a row's color draws at its label's left. */
export const ROW_COLOR_BAR_WIDTH = 4

const TEXT_INSET = 4

/**
 * Px the row color takes at the labels' left, none where no row has one: its
 * bar where the names draw, its swatch where they do not.
 */
export function rowColorWidth(
  sources: readonly RowLabelSource[],
  rowHeight: number,
) {
  return sources.some(s => s.rowColor)
    ? rowLabelsCarryText(rowHeight)
      ? ROW_COLOR_BAR_WIDTH
      : ROW_SWATCH_WIDTH
    : 0
}

/**
 * Px of color at the labels' left: the row color, then a
 * `ROW_COLOR_BAR_WIDTH` column per annotation at any row height. Fixed
 * widths, since the labels cover the plot's first region.
 */
function rowColorsWidth(
  sources: readonly RowLabelSource[],
  rowHeight: number,
  annotations: readonly RowAnnotationColumn[] = [],
) {
  return (
    rowColorWidth(sources, rowHeight) + annotations.length * ROW_COLOR_BAR_WIDTH
  )
}

/**
 * The x of each color column's center, from the labels' left: the row
 * color's where a row has one, then each annotation's.
 */
export function rowColorColumnCenters(
  sources: readonly RowLabelSource[],
  rowHeight: number,
  annotations: readonly RowAnnotationColumn[] = [],
) {
  const rowColor = rowColorWidth(sources, rowHeight)
  return [
    ...(rowColor > 0 ? [rowColor / 2] : []),
    ...annotations.map(
      (_, column) => rowColor + (column + 0.5) * ROW_COLOR_BAR_WIDTH,
    ),
  ]
}

/** The line one color column's label takes above the first row. */
export const ROW_COLUMN_LABEL_LINE_HEIGHT = SCREEN_LABEL_FONT_SIZE

/** Px the color columns' labels take above the first row, a line each. */
export function rowColumnLabelsHeight(labels: readonly string[] = []) {
  return labels.length * ROW_COLUMN_LABEL_LINE_HEIGHT
}

/**
 * Where a label's text starts: past the row color bar and the annotation
 * columns, so every name in the column starts at the same x.
 */
export function rowLabelTextX(
  sources: readonly RowLabelSource[],
  annotations?: readonly RowAnnotationColumn[],
) {
  return rowColorsWidth(sources, MIN_TEXT_ROW_HEIGHT, annotations) + TEXT_INSET
}

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
  annotations?: readonly RowAnnotationColumn[],
) {
  const fontSize = rowLabelFontSize(rowHeight, text)
  return rowLabelsCarryText(rowHeight)
    ? max(
        sources.map(s =>
          Math.min(
            measureText(rowLabelFullText(s), fontSize, text?.fontFamily),
            ROW_LABEL_MAX_EMS * fontSize,
          ),
        ),
        0,
      ) +
        ROW_LABEL_PAD +
        rowLabelTextX(sources, annotations) -
        TEXT_INSET
    : Math.max(
        rowColorsWidth(sources, rowHeight, annotations),
        ROW_SWATCH_WIDTH,
      )
}
