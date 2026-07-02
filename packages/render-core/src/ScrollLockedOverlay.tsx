import React from 'react'

/**
 * DOM overlay layer for a display that scrolls a `position:sticky` GPU canvas in
 * a native overflow container.
 *
 * Such a display has TWO scroll coordinate spaces that look like one: the DOM's
 * real `scrollTop` (compositor-driven, updates instantly) and the model's
 * `scrollTop` (main-thread, updated via `scroll -> rAF -> setScrollTop`). The
 * GPU canvas can only be positioned from the main-thread value — its pixels are
 * painted by JS — so it draws glyphs at `y - model.scrollTop`. Any DOM element
 * placed in the natively-scrolled content instead rides the compositor scroll,
 * and on a fast scroll (main thread trailing the compositor) the two diverge:
 * labels/highlights visibly tear away from their glyphs.
 *
 * This component pins its children to the scroll port exactly like the sticky
 * canvas and shifts them by `-scrollTop`, so overlays key off the SAME
 * `model.scrollTop` the GPU does. They then lag the scrollbar thumb together
 * during a fast scroll but never separate from each other.
 *
 * Contract: render this as the sibling immediately AFTER the sticky canvas
 * inside the scrolled content div, and pass the canvas's height as
 * `viewportHeight` (used to pin this layer at the same top the canvas occupies)
 * and the full scroll-content height as `contentHeight` (the coordinate space
 * the children position within). Children position in raw content coordinates
 * (y from 0..contentHeight); this component applies the `-scrollTop` shift.
 *
 * `pointerEvents:none` on the layer lets mouse events fall through to the
 * canvas; individual interactive children re-enable `pointerEvents:auto`.
 */
export function ScrollLockedOverlay({
  scrollTop,
  viewportHeight,
  contentHeight,
  children,
}: {
  /** the model's scroll offset — the same value the GPU shader paints from */
  scrollTop: number
  /** the sticky canvas's height (== the visible viewport height) */
  viewportHeight: number
  /** the full scrollable content height (the children's coordinate space) */
  contentHeight: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        width: '100%',
        height: viewportHeight,
        // The sticky canvas precedes this in flow and occupies `viewportHeight`,
        // so this layer's natural origin sits one canvas-height down; pull it
        // back up to pin at the same viewport-top the canvas does.
        marginTop: -viewportHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        // Sized to the full content height so absolutely-positioned children
        // keep the coordinate space they'd have in the scrolled content div; the
        // transform both shifts them by -scrollTop and (being a transform) makes
        // this the containing block for them.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: contentHeight,
          transform: `translateY(${-scrollTop}px)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
