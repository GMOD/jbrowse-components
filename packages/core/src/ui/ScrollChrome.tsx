import ScrollEdgeShadow from './ScrollEdgeShadow.tsx'
import VerticalScrollbar from './VerticalScrollbar.tsx'

/**
 * The chrome a display that scrolls its content virtually mounts over its
 * viewport: `ScrollEdgeShadow` saying content is hidden past an edge, and
 * `VerticalScrollbar` to reach it. Both read the same three numbers, so a
 * display hands them over once here. Renders nothing when the content fits.
 */
export default function ScrollChrome({
  scrollTop,
  setScrollTop,
  viewportHeight,
  contentHeight,
  controlsId,
  top = 0,
}: {
  scrollTop: number
  setScrollTop: (n: number) => void
  viewportHeight: number
  contentHeight: number
  /** `id` of the scrolled viewport element, for `aria-controls`. */
  controlsId: string
  /** Viewport offset from the top, for a display with a sticky band above it. */
  top?: number
}) {
  return (
    <>
      <ScrollEdgeShadow
        scrollTop={scrollTop}
        viewportHeight={viewportHeight}
        contentHeight={contentHeight}
        top={top}
      />
      <VerticalScrollbar
        scrollTop={scrollTop}
        setScrollTop={setScrollTop}
        viewportHeight={viewportHeight}
        contentHeight={contentHeight}
        controlsId={controlsId}
        top={top}
      />
    </>
  )
}
