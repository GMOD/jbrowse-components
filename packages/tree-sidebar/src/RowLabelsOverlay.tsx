import { TrackOverlayPortal } from '@jbrowse/display-ui'

import { SvgRowLabels } from './SvgRowLabels.tsx'

import type { RowLabelSource } from './types.ts'

/**
 * The on-screen half of the sidebar's row labels: `SvgRowLabels` in the overlay
 * that has to hold them. Paired with `TreeSidebar` (which draws the dendrogram
 * onto its own canvas) — together those two are the sidebar, and each display
 * used to wire up the labels half itself.
 *
 * Portaled above the LGV's inter-region masks (`TrackOverlayPortal`). The labels
 * are text floating over the plot, so at whole-genome or multi-region scale a
 * region-separator bar landed on them at every boundary — the masks paint over
 * the whole `contain:strict` sandbox a display renders into, and there is no
 * z-index from inside it that gets out. Outside a TrackContainer the portal
 * renders in place, so a standalone display is unchanged.
 *
 * The overlay geometry is the part worth single-sourcing, because getting any
 * of it wrong is silent:
 *
 * - `pointerEvents: 'none'` — the labels sit over the plot, so without this
 *   they swallow the hover/click the display's own hit test needs. The portal
 *   node is `pointerEvents: 'none'` too, and this keeps the inline fallback
 *   behaving the same way.
 * - `zIndex: 2` — below `TreeSidebar`'s gutter layer (100), which is what keeps
 *   the opaque dendrogram panel over the labels rather than under them. Order
 *   within the portal node is otherwise **mount order, not tree order**, so the
 *   two halves cannot be left to their DOM positions the way they could inline.
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
  top = 0,
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
  // Top of the rows viewport within the display's own box. Non-zero only for a
  // display that stacks something above its rows (maf's coverage/conservation
  // bands): the portal lands on the display's origin, so an offset the labels
  // used to inherit from their container has to be passed explicitly.
  top?: number
  scrollTop?: number
  testId?: string
  // Draw the names. False still renders the overlay element, see above.
  showLabels?: boolean
}) {
  return sources?.length ? (
    <TrackOverlayPortal>
      <svg
        data-testid={testId}
        style={{
          position: 'absolute',
          left: 0,
          top,
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
    </TrackOverlayPortal>
  ) : null
}
