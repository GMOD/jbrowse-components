import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { virtualRange } from '../../util/virtualRange.ts'
import { HEADER_HEIGHT } from './tableStyles.ts'

const OVERSCAN = 8

/**
 * Minimal fixed-height row virtualization. Tracks the scroll container's
 * scrollTop and client size and hands them to the shared `virtualRange` (which
 * owns the clamping, including a list that shrank under its scroll position),
 * returning the range of row indices to render, the spacer heights that
 * offset that window from the top/bottom, and the width inside any vertical
 * scrollbar. The container scrolls back to the top whenever `resetKey`
 * changes, and brings the row with id `scrollToId` into view, below the
 * sticky header, whenever that id changes: a row a sort or a filter moves
 * stays where the reader left the list, and a row the filters leave out
 * scrolls nowhere.
 */
export function useVirtualRows({
  parentRef,
  rows,
  rowHeight,
  resetKey,
  scrollToId,
}: {
  parentRef: React.RefObject<HTMLDivElement | null>
  rows: readonly { id: string | number }[]
  rowHeight: number
  resetKey: string
  scrollToId?: string | number
}) {
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

  // declared after the reset, so a target row wins over the top
  const scrolledId = useRef<string | number>(undefined)
  useEffect(() => {
    const el = parentRef.current
    if (el && scrollToId !== scrolledId.current) {
      scrolledId.current = scrollToId
      const index =
        scrollToId === undefined
          ? -1
          : rows.findIndex(row => row.id === scrollToId)
      if (index !== -1) {
        const top = index * rowHeight
        const room = el.clientHeight - HEADER_HEIGHT
        if (top < el.scrollTop || top + rowHeight > el.scrollTop + room) {
          el.scrollTop = Math.max(0, top - (room - rowHeight) / 2)
        }
      }
    }
  }, [scrollToId, rows, rowHeight, parentRef])

  const { scrollTop, clientHeight, clientWidth } = scrollState
  const count = rows.length
  const { start, end } = virtualRange({
    scroll: scrollTop,
    cellSize: rowHeight,
    viewport: clientHeight,
    overscan: OVERSCAN,
    total: count,
  })

  return {
    startIndex: start,
    endIndex: end,
    leadingGap: start * rowHeight,
    trailingGap: (count - end) * rowHeight,
    clientWidth,
  }
}
