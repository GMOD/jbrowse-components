import { useEffect, useRef } from 'react'
import type React from 'react'

import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

const TRACK_WIDTH = 12
const MIN_THUMB_HEIGHT = 20

const useStyles = makeStyles()({
  track: {
    position: 'absolute',
    right: 0,
    width: TRACK_WIDTH,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  thumb: {
    position: 'absolute',
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  },
})

/**
 * Draggable vertical scrollbar overlay for canvas-backed displays that scroll
 * their content via a `scrollTop` value (alignments pileup, variant matrix).
 * Renders nothing when the content fits the viewport. The thumb geometry and
 * the drag-to-scroll mapping live here so the consumers don't each re-derive
 * them; the wheel handling stays per-display (their gesture semantics differ).
 */
export default function VerticalScrollbar({
  scrollTop,
  setScrollTop,
  viewportHeight,
  contentHeight,
  top = 0,
}: {
  scrollTop: number
  setScrollTop: (n: number) => void
  viewportHeight: number
  contentHeight: number
  /** Track offset from the top, for displays with a sticky band above it. */
  top?: number
}) {
  const { classes } = useStyles()
  const dragRef = useRef<AbortController>(undefined)
  useEffect(() => () => dragRef.current?.abort(), [])

  const scrollableHeight = Math.max(0, contentHeight - viewportHeight)
  if (scrollableHeight <= 0) {
    return null
  }
  // never taller than the track itself — on a very short viewport the
  // MIN_THUMB_HEIGHT floor would otherwise exceed viewportHeight, pushing
  // thumbTop negative (thumb drawn above the track) and making usableTrack
  // negative (drag mapping dead)
  const thumbHeight = Math.min(
    viewportHeight,
    Math.max(
      MIN_THUMB_HEIGHT,
      viewportHeight * (viewportHeight / contentHeight),
    ),
  )
  const thumbTop =
    (scrollTop / scrollableHeight) * (viewportHeight - thumbHeight)
  const usableTrack = viewportHeight - thumbHeight

  function handleMouseDown(e: React.MouseEvent) {
    // stopPropagation so the drag doesn't also pan the view; no preventDefault
    // on mousedown so its native focus shift can still close open popups.
    e.stopPropagation()
    dragRef.current?.abort()
    const ac = new AbortController()
    dragRef.current = ac
    const startY = e.clientY
    const startScroll = scrollTop
    document.addEventListener(
      'mousemove',
      me => {
        me.preventDefault()
        const delta =
          usableTrack > 0
            ? ((me.clientY - startY) / usableTrack) * scrollableHeight
            : 0
        setScrollTop(clamp(startScroll + delta, 0, scrollableHeight))
      },
      { signal: ac.signal },
    )
    document.addEventListener(
      'mouseup',
      () => {
        ac.abort()
      },
      {
        signal: ac.signal,
      },
    )
  }

  return (
    <div
      className={classes.track}
      style={{ top, height: viewportHeight }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={classes.thumb}
        style={{ top: thumbTop, height: thumbHeight }}
      />
    </div>
  )
}
