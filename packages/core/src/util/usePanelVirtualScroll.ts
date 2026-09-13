import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

import type { VirtualScrollModel } from './useVirtualScrollWheel.ts'

/**
 * Wheel gestures over a **scrolled canvas panel** — the alignments pileup, the
 * canvas feature display, multi-way synteny: a plain wheel scrolls it, `shift`
 * still scrolls it once `scrollZoom` has given the plain wheel to the view, and
 * ctrl/meta is left to the browser and the view's pinch-zoom. The row-stack
 * rule, where `shift` resizes, is `useRowVirtualScroll` (ADR-027).
 */
export function usePanelVirtualScroll(
  panel: HTMLElement | null,
  model: VirtualScrollModel,
  scrollZoom: boolean,
) {
  useVirtualScrollWheel(panel, model, (e, scroll) => {
    if ((!scrollZoom || e.shiftKey) && !e.ctrlKey && !e.metaKey) {
      scroll()
    }
  })
}
