import { defineMark, spanMark } from '@jbrowse/render-core/marks'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

import type { MultiRowRenderState } from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

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
  }),
})

export const MULTI_ROW_MARKS = [MULTI_ROW_MARK]
