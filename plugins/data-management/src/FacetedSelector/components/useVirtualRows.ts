import { useEffect, useState } from 'react'

/**
 * Minimal fixed-height row virtualization. Tracks the scroll container's
 * scrollTop/clientHeight and returns the slice of row indices to render plus
 * the total scrollable height.
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
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- initializes from DOM after mount
    setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight })
    const onScroll = () => {
      setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
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
  const totalSize = count * rowHeight
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const endIdx = Math.min(
    count,
    Math.ceil((scrollTop + clientHeight) / rowHeight) + overscan,
  )

  const items = []
  for (let i = startIdx; i < endIdx; i++) {
    items.push({ index: i, start: i * rowHeight })
  }

  return { items, totalSize }
}
