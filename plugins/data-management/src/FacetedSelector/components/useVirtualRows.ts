import { useEffect, useState } from 'react'

/**
 * Minimal fixed-height row virtualization. Tracks the scroll container's
 * scrollTop/clientHeight and returns the slice of row indices to render plus
 * the spacer heights that offset that window from the top/bottom.
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
  // clamp to count so a stale (too-large) scrollTop from a shrunk list can't
  // push the window past the end and render nothing before the reset effect runs
  const startIdx = Math.min(
    count,
    Math.max(0, Math.floor(scrollTop / rowHeight) - overscan),
  )
  const endIdx = Math.min(
    count,
    Math.ceil((scrollTop + clientHeight) / rowHeight) + overscan,
  )

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
