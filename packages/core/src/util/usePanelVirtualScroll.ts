import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

// Everything the gesture needs off a scrolling canvas display. Duck-typed
// rather than taking a model, for the same reason `useRowVirtualScroll`'s
// target is: this stays in core, beside the primitive it drives.
interface PanelScrollTarget {
  scrollTop: number
  scrollableHeight: number
  setScrollTop: (n: number) => void
}

/**
 * Wheel gestures over a **scrolled canvas panel** — the alignments pileup and
 * the canvas basic display: a plain wheel scrolls it, `shift` keeps scrolling it
 * once `scrollZoom` has claimed the plain wheel for the view, and ctrl/meta is
 * left to the browser and the view's pinch-zoom. Nothing here resizes anything.
 *
 * These panels paint a fixed-size canvas at `-scrollTop` rather than living in a
 * DOM overflow container, so nothing scrolls them without this. The latch (inside
 * `applyScroll`) owns `preventDefault` but never `stopPropagation`, so a diagonal
 * wheel still bubbles its horizontal component to the LGV for panning.
 *
 * ADR-027 keeps wheel-*intent* dispatch per handler, because the panels do not
 * agree on what a gesture means. This is the second of the two rules that
 * survived that split — the row-stack rule (`useRowVirtualScroll`, where `shift`
 * resizes) is the other — and the two displays sharing it had byte-identical
 * copies differing only in which getter named the viewport. The canvas display
 * converged here when it moved off a native overflow container; the ADR's table
 * still described its pre-virtual-scroll rule and has been corrected.
 *
 * `scrollZoom` and `viewportHeight` are inputs rather than reads off the model,
 * so core needs no view typing and each display keeps naming its own viewport
 * (the pileup's excludes the sticky coverage band; the canvas display's is the
 * whole track).
 *
 * `panel` is the element wrapping the canvas AND the DOM overlays drawn over it,
 * never the canvas alone — see `useVirtualScrollWheel`, which says why.
 */
export function usePanelVirtualScroll(
  panel: HTMLElement | null,
  model: PanelScrollTarget,
  {
    viewportHeight,
    scrollZoom,
  }: { viewportHeight: number; scrollZoom: boolean },
) {
  useVirtualScrollWheel(panel, (e, applyScroll) => {
    if ((scrollZoom && !e.shiftKey) || e.ctrlKey || e.metaKey) {
      return
    }
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
  })
}
