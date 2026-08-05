import { SvgRowLabels } from './SvgRowLabels.tsx'

import type { RowLabelSource } from './types.ts'

/**
 * The on-screen half of the sidebar's row labels: `SvgRowLabels` in the overlay
 * that has to hold them. Paired with `TreeSidebar` (which draws the dendrogram
 * onto its own canvas) — together those two are the sidebar, and each display
 * used to wire up the labels half itself.
 *
 * The overlay geometry is the part worth single-sourcing, because getting any
 * of it wrong is silent:
 *
 * - `pointerEvents: 'none'` — the labels sit over the plot, so without this
 *   they swallow the hover/click the display's own hit test needs.
 * - `zIndex: 2` — above the rendering canvas, below the crosshair/tooltip layer.
 * - sized to the **rows viewport**, not the display, and paired with the
 *   `scrollTop` the rows scroll by, so the labels track the rows they name
 *   rather than hanging a scroll-distance off them.
 *
 * Renders nothing when there are no rows, so callers don't have to guard: a
 * label overlay with nothing in it is a `<svg>` swallowing nothing, but it is
 * also a DOM node that test selectors and screenshot doneness gates can see.
 *
 * `showLabels: false` keeps that `<svg>` and drops only the labels inside it,
 * for the same reason: this element is the doneness signal several displays gate
 * their capture on (it exists only once rows are derived from fetched data,
 * unlike `canvasDrawn`, which flips on an empty first paint). Guarding the
 * element itself instead would make turning labels off also turn off the gate,
 * and the figure would capture blank.
 */
export function RowLabelsOverlay({
  sources,
  rowHeight,
  labelOffset,
  width,
  height,
  scrollTop,
  testId,
  showLabels = true,
}: {
  sources: RowLabelSource[] | undefined
  // Resolved px row height, never a fit-to-height sentinel — same contract as
  // `TreeDrawingModel.effectiveRowHeight`.
  rowHeight: number
  // Px reserved on the left for the dendrogram; labels start after it.
  labelOffset: number
  width: number
  // Height of the rows viewport, which is what the labels are culled against.
  height: number
  scrollTop?: number
  testId?: string
  // Draw the names. False still renders the overlay element, see above.
  showLabels?: boolean
}) {
  return sources?.length ? (
    <svg
      data-testid={testId}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {showLabels ? (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset}
          scrollTop={scrollTop}
          availableHeight={height}
        />
      ) : null}
    </svg>
  ) : null
}
