import { applyRowResizeWheel } from './applyRowResizeWheel.ts'
import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

// Everything the gesture needs off a row-stack display. Duck-typed rather than
// taking a model, so this stays in core alongside the two primitives it drives.
interface RowScrollTarget {
  // resolved row height, never the fit sentinel — applyRowResizeWheel divides
  // by it
  effectiveRowHeight: number
  scrollTop: number
  nrow: number
  scrollableHeight: number
  setRowHeight: (n: number) => void
  setScrollTop: (n: number) => void
}

/**
 * Wheel gestures over a **row-stack** panel — the multi-sample variant displays
 * and MAF: `shift`+wheel resizes the rows (a vertical-zoom that keeps the row
 * under the cursor put), a plain wheel scrolls them, and anything the panel
 * can't consume — a sideways swipe included — is left to bubble to the view.
 *
 * These panels paint a fixed-size canvas at `-scrollTop` rather than living in a
 * DOM overflow container, so nothing scrolls them without this.
 *
 * ADR-027 keeps wheel-*intent* dispatch per handler, because the four panels do
 * not agree on what a gesture means — and that still holds. This is the one rule
 * two of them genuinely share, which the ADR states outright ("same rule as the
 * variant displays, and deliberately so: same sample-row shape, same coupled
 * row-height axis"). It is unified for exactly that reason, and no further: the
 * pileup / canvas-basic rule (`shift` scrolls, nothing resizes) stays where it
 * is. `scrollZoom` and `viewportHeight` are inputs rather than reads off the
 * model, so core needs no view typing and each display keeps naming its own
 * rows-area height.
 */
export function useRowVirtualScroll(
  el: HTMLElement | null,
  model: RowScrollTarget,
  {
    viewportHeight,
    scrollZoom,
  }: { viewportHeight: number; scrollZoom: boolean },
) {
  useVirtualScrollWheel(el, (e, applyScroll, rowsEl) => {
    // ctrl/meta is the browser's own zoom (and the view's pinch-zoom) and is
    // never ours, whatever else is held. Tested first rather than only in the
    // scroll branch: ctrl+shift+wheel used to reach the resize below, which
    // `preventDefault`s — so a row-stack display swallowed page zoom where
    // every other display passes it through.
    if (e.ctrlKey || e.metaKey) {
      return
    }
    if (e.shiftKey) {
      // Resizing exits fit-to-height into a pinned height, which is what makes
      // the gesture meaningful: the fit height is exactly the floor it shrinks
      // to, so there is nothing to zoom while the sentinel is set.
      applyRowResizeWheel(e, rowsEl, {
        effectiveRowHeight: model.effectiveRowHeight,
        scrollTop: model.scrollTop,
        nrow: model.nrow,
        viewportHeight,
        setRowHeight: n => {
          model.setRowHeight(n)
        },
        setScrollTop: n => {
          model.setScrollTop(n)
        },
      })
    } else if (!scrollZoom) {
      // A gesture the panel can't consume is left alone: with the rows fitting
      // the track (`scrollableHeight === 0`, always true in fit-to-height mode)
      // the wheel reaches the view and zooms or scrolls the page exactly as it
      // does over any other track. Same for the explicit zoom gestures.
      applyScroll(
        e,
        {
          scrollTop: model.scrollTop,
          viewportHeight,
          scrollableHeight: model.scrollableHeight,
        },
        n => {
          model.setScrollTop(n)
        },
      )
    }
  })
}
