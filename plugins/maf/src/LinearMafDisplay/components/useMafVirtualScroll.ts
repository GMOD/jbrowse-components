import { useRowVirtualScroll } from '@jbrowse/core/util/useRowVirtualScroll'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Wheel gestures over the MAF rows area: shift+wheel resizes the rows (a
 * vertical zoom, keeping the row under the cursor put), plain wheel scrolls
 * them, and anything the panel can't consume bubbles to the view. The rows are a
 * fixed-size canvas painted at `-scrollTop`, not a DOM overflow container, so
 * nothing scrolls them without this.
 *
 * The rule is `useRowVirtualScroll`, shared with the multi-sample variant
 * displays — same sample-row shape, same coupled row-height axis, and ADR-027
 * records that the agreement is deliberate rather than incidental. Only the
 * rows-area height is MAF's own: unlike the variant displays it excludes the
 * coverage/annotation bands stacked above the rows.
 */
export function useMafVirtualScroll(
  rowsEl: HTMLElement | null,
  model: LinearMafDisplayModel,
) {
  useRowVirtualScroll(rowsEl, model, {
    viewportHeight: model.rowsHeight,
    scrollZoom: model.view.scrollZoom,
  })
}
