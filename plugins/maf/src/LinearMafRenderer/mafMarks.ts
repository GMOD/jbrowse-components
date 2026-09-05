import { defineMark, spanMark } from '@jbrowse/render-core/marks'

import { GAP_STROKE_OFFSET } from './rendering/types.ts'

import type {
  MafCellsPayload,
  MafGPURenderState,
} from './mafRenderingBackendTypes.ts'

/**
 * The rows band, as a declaration: one `span` mark per run of same-coloured
 * cells, its channels already encoded by `buildMafChannels`.
 *
 * Not the display's whole drawing — the coverage band above the rows is four
 * hand-written passes over its own uniform block, and both backends draw it
 * beside this mark rather than through `createMarkBackend`. A `Mark` is usable
 * on its own for exactly that reason: the shape owns the rows band's geometry
 * on both backends, and MAF keeps the two-band frame scaffold that is its own.
 *
 * `scrollTop` is the shape's scroll offset less `rowsTop`, which places the
 * band inside a canvas that also carries the coverage strip above it: the shape
 * paints row i at `rowHeight*i - scrollTop`, so offsetting the scroll is
 * offsetting the band. On the GPU the scissor keeps a scrolled row out of the
 * strip; on Canvas2D the backend's clip does.
 */
export const MAF_ROW_MARK = defineMark({
  shape: spanMark,
  channels: (d: MafCellsPayload) => d.cells,
  params: (s: MafGPURenderState) => ({
    rowHeight: s.rowHeight,
    rowProportion: s.rowProportion,
    // MAF does not floor. Its cells tile the row, so a sub-pixel cell is read
    // as part of the run around it, and widening one to a whole pixel paints
    // ink the alignment does not contain: measured at 2.3x the colour of a
    // supersampled ground truth, against 1.05x for no floor
    // (agent-docs/reference/MAF_SUBPIXEL_CELLS.md).
    minWidthPx: 0,
    seamPx: GAP_STROKE_OFFSET,
    scrollTop: s.scrollTop - s.rowsTop,
  }),
})

export const MAF_ROW_MARKS = [MAF_ROW_MARK]
