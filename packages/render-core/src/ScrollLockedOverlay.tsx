import React from 'react'

/**
 * DOM overlay layer for a display that scrolls a fixed GPU canvas virtually (a
 * `VerticalScrollbar` overlay + `useVirtualScrollWheel`, everything positioned
 * from `model.scrollTop`).
 *
 * The GPU canvas paints glyphs at `y - model.scrollTop`. Any DOM overlay
 * (labels, highlights, hover boxes) that annotates those glyphs must derive its
 * screen Y from the SAME `model.scrollTop`, or it drifts away from its glyph on
 * scroll. This component clips to the viewport and translates its children by
 * `-scrollTop` so they track the canvas exactly — one scroll source, no
 * tearing.
 *
 * Render it as an absolute sibling of the canvas inside the display's
 * position:relative container. Children position in raw content coordinates (y
 * from 0..contentHeight); this applies the `-scrollTop` shift. `pointerEvents`
 * is none so mouse events fall through to the canvas; interactive children
 * re-enable `pointerEvents:auto`.
 */
export function ScrollLockedOverlay({
  scrollTop,
  viewportHeight,
  contentHeight,
  children,
}: {
  /** the model's scroll offset — the same value the GPU shader paints from */
  scrollTop: number
  /** the visible viewport height (clips overflow) */
  viewportHeight: number
  /** the full scrollable content height (the children's coordinate space) */
  contentHeight: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: viewportHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        // Sized to the full content height so absolutely-positioned children
        // keep a stable coordinate space; the transform shifts them by
        // -scrollTop (and, being a transform, makes this their containing block).
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
