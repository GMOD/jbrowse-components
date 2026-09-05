import { coverageBandMarks } from '@jbrowse/alignments-core'
import { defineMark, spanMark } from '@jbrowse/render-core/marks'

import { GAP_STROKE_OFFSET } from './rendering/types.ts'

import type {
  MafCellsPayload,
  MafCoverageRegion,
  MafGPURenderState,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { Mark } from '@jbrowse/render-core/marks'

/**
 * The rows band, as a declaration: one `span` mark per run of same-coloured
 * cells, its channels already encoded by `buildMafChannels`, clipped to the
 * rows viewport under the band stack.
 *
 * `scrollTop` is the shape's scroll offset less `rowsTop`, which places the
 * band inside a canvas that also carries the coverage strip above it: the shape
 * paints row i at `rowHeight*i - scrollTop`, so offsetting the scroll is
 * offsetting the band.
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
  band: s => ({ top: s.rowsTop, height: s.rowsHeight }),
})

/**
 * The coverage strip pinned at the canvas top: the shared band's four layers
 * (a MAF alignment carries no modification calls) over the worker's own
 * per-region coverage. Declared over `{ coverage }` rather than the upload
 * payload so the SVG export paints it straight off `rpcDataMap`.
 */
export const MAF_COVERAGE_MARKS = coverageBandMarks({
  channels: (d: { coverage: MafCoverageRegion }) => d.coverage,
  state: (s: MafGPURenderState) => s.coverage,
  band: s => ({ top: 0, height: s.coverage.height }),
})

/** Everything the rows canvas draws, in paint order. */
export const MAF_MARKS: Mark<MafUploadPayload, MafGPURenderState>[] = [
  ...MAF_COVERAGE_MARKS,
  MAF_ROW_MARK,
]
