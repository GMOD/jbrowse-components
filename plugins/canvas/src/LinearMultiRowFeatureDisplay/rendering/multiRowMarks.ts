import { defineMark, spanMark } from '@jbrowse/render-core/marks'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

import type { MultiRowRenderState } from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * What this display draws: one `span` mark per feature, its channels already
 * encoded by `buildMultiRowChannels` — so `channels` is the identity and the
 * declaration is nothing but the shape's parameters.
 *
 * This display sizes its canvas to the whole row stack and never scrolls, so
 * `scrollTop` is 0; the shape's scroll offset is MAF's.
 */
export const MULTI_ROW_MARKS = [
  defineMark({
    shape: spanMark,
    channels: (c: SpanChannels) => c,
    params: (s: MultiRowRenderState) => ({
      rowHeight: s.rowHeight,
      rowProportion: s.rowProportion,
      minWidthPx: MULTI_ROW_MIN_CELL_PX,
      scrollTop: 0,
    }),
  }),
]
