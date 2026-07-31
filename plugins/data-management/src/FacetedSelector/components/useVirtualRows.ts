import { useEffect, useState } from 'react'

import { virtualRange } from '@jbrowse/core/util/virtualRange'

/**
 * Minimal fixed-height row virtualization. Tracks the scroll container's
 * scrollTop/clientHeight and hands them to the shared `virtualRange` (which
 * owns the clamping, including the shrunk-list case the reset effect below
 * races), returning the row indices to render plus the spacer heights that
 * offset that window from the top/bottom.
 */
export function useVirtualRows(
  parentRef: React.RefObject<HTMLDivElement | null>,
  count: number,
  rowHeight: number,
  overscan = 20,
) {
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    clientHeight: 0,
  })

  useEffect(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    const sync = () => {
      // eslint-disable-next-line @eslint-react/set-state-in-effect -- sync() runs once synchronously to initialize from the DOM after mount
      setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight })
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    // resize keeps clientHeight current when the container grows/shrinks
    // (e.g. window or filter-panel resize) without needing a scroll to refresh
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [parentRef])

  // Reset scroll to top when the row count changes (e.g. filter applied) so
  // that stale scrollTop can't push startIdx past the new count.
  useEffect(() => {
    const el = parentRef.current
    if (el) {
      el.scrollTo(0, 0)
    }
  }, [count, parentRef])

  const { scrollTop, clientHeight } = scrollState
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
  }
}
