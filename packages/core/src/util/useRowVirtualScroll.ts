import { applyRowResizeWheel } from './applyRowResizeWheel.ts'
import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

import type { RowResizeTarget } from './applyRowResizeWheel.ts'

/**
 * Wheel gestures over a **row-stack** panel — the multi-sample variant displays
 * and MAF: `shift`+wheel resizes the rows, keeping the row under the cursor
 * put, and a plain wheel scrolls them unless `scrollZoom` gave it to the view.
 * ctrl/meta is the browser's zoom whatever else is held. The canvas-panel rule,
 * where `shift` scrolls, is `usePanelVirtualScroll` (ADR-027).
 */
export function useRowVirtualScroll(
  el: HTMLElement | null,
  model: RowResizeTarget,
  scrollZoom: boolean,
) {
  useVirtualScrollWheel(el, model, (e, scroll, rowsEl) => {
    if (e.ctrlKey || e.metaKey) {
      return
    }
    if (e.shiftKey) {
      applyRowResizeWheel(e, rowsEl, model)
    } else if (!scrollZoom) {
      scroll()
    }
  })
}
