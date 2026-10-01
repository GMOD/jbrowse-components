import { max, measureText } from '@jbrowse/core/util'

import { rowLabelsCarryText } from './rowLabelsCarryText.ts'

import type { RowLabelSource } from './types.ts'

export const ROW_SWATCH_WIDTH = 8

export function rowLabelFontSize(rowHeight: number) {
  return Math.min(rowHeight, 12)
}

export function rowLabelsBoxWidth(
  sources: RowLabelSource[],
  rowHeight: number,
) {
  const fontSize = rowLabelFontSize(rowHeight)
  return rowLabelsCarryText(rowHeight)
    ? max(
        sources.map(s => measureText(s.label ?? s.name, fontSize) + 10),
        10,
      )
    : ROW_SWATCH_WIDTH
}
