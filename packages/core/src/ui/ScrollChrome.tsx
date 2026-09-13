import ScrollEdgeShadow from './ScrollEdgeShadow.tsx'
import VerticalScrollbar from './VerticalScrollbar.tsx'

import type { VirtualScrollModel } from '../util/useVirtualScrollWheel.ts'

/**
 * The chrome a virtually scrolled display mounts over its viewport: the edge
 * shadow saying content is hidden, and the scrollbar to reach it. Renders
 * nothing when the content fits.
 */
export default function ScrollChrome({
  model,
  controlsId,
  top = 0,
}: {
  model: VirtualScrollModel
  /** `id` of the scrolled viewport element, for `aria-controls`. */
  controlsId: string
  /** Viewport offset from the top, for a display with a sticky band above it. */
  top?: number
}) {
  return (
    <>
      <ScrollEdgeShadow model={model} top={top} />
      <VerticalScrollbar model={model} controlsId={controlsId} top={top} />
    </>
  )
}
