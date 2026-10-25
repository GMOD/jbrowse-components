import { defineMark, spanMark } from '@jbrowse/render-core/marks'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

import type { MultiRowEncoded } from './multiRowChannels.ts'
import type { MultiRowRenderState } from './multiRowRenderingBackendTypes.ts'
import type { Mark, SpanChannels } from '@jbrowse/render-core/marks'

// This display sizes its canvas to the whole row stack and never scrolls, so
// `scrollTop` is 0.
export const MULTI_ROW_MARK = defineMark({
  shape: spanMark,
  channels: (c: SpanChannels) => c,
  params: (s: MultiRowRenderState) => ({
    rowHeight: s.rowHeight,
    rowProportion: s.rowProportion,
    minWidthPx: MULTI_ROW_MIN_CELL_PX,
    // sparse intervals with background between them, so nothing to seam
    seamPx: 0,
    scrollTop: 0,
    rowTable: s.rowTable,
  }),
})

// A line centred in the row, which the span shape floors at 1 px tall
const MULTI_ROW_INTRON_MARK = defineMark({
  shape: spanMark,
  channels: (c: MultiRowEncoded) => c.introns,
  params: (s: MultiRowRenderState) => ({
    rowHeight: s.rowHeight,
    rowProportion: 0,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
    rowTable: s.rowTable,
  }),
})

export const MULTI_ROW_MARKS: Mark<MultiRowEncoded, MultiRowRenderState>[] = [
  MULTI_ROW_INTRON_MARK,
  MULTI_ROW_MARK,
]

export const MULTI_ROW_BLOCK_MARK = MULTI_ROW_MARKS.indexOf(MULTI_ROW_MARK)
