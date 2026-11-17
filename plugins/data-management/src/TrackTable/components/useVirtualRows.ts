import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { virtualRange } from '@jbrowse/core/util/virtualRange'

/**
 * Minimal fixed-height row virtualization. Tracks the scroll container's
 * scrollTop and client size and hands them to the shared `virtualRange` (which
 * owns the clamping, including a list that shrank under its scroll position),
 * returning the row indices to render, the spacer heights that offset that
 * window from the top/bottom, and the width inside any vertical scrollbar.
 * The container scrolls back to the top whenever `resetKey` changes.
 */
export function useVirtualRows(
  parentRef: React.RefObject<HTMLDivElement | null>,
  count: number,
  rowHeight: number,
  resetKey: string,
  overscan = 20,
) {
  // read by the reset below, which skips scrollTo (and the layout it forces)
  // when the list is already at the top, as it is for most keystrokes
  const scrollTopRef = useRef(0)
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    clientHeight: 0,
    clientWidth: 0,
  })

  // a layout effect, so the first paint already has the measured width rather
  // than one that still counts the scrollbar
  useLayoutEffect(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    const sync = () => {
      scrollTopRef.current = el.scrollTop
      // eslint-disable-next-line @eslint-react/set-state-in-effect -- sync() runs once synchronously to initialize from the DOM after mount
      setScrollState({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
      })
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    // resize keeps clientHeight current when the container grows/shrinks
    // (e.g. a window or drawer resize) without needing a scroll to refresh
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [parentRef])

  useEffect(() => {
    if (scrollTopRef.current > 0) {
      parentRef.current?.scrollTo(0, 0)
    }
  }, [resetKey, parentRef])

  const { scrollTop, clientHeight, clientWidth } = scrollState
  const { start: startIdx, end: endIdx } = virtualRange({
    scroll: scrollTop,
    cellSize: rowHeight,
    viewport: clientHeight,
    overscan,
    total: count,
  })

  const items = []
  for (let i = startIdx; i < endIdx; i++) {
    items.push({ index: i, start: i * rowHeight })
  }

  return {
    items,
    leadingGap: startIdx * rowHeight,
    trailingGap: (count - endIdx) * rowHeight,
    clientWidth,
  }
}
