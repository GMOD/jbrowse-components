import { useRef } from 'react'
import type React from 'react'

import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

const TRACK_WIDTH = 12
const MIN_THUMB_HEIGHT = 20

const useStyles = makeStyles()(theme => ({
  track: {
    position: 'absolute',
    right: 0,
    width: TRACK_WIDTH,
    cursor: 'default',
    zIndex: 10,
    // theme-aware so the thumb stays visible in dark mode (a hardcoded black
    // thumb vanished against a dark canvas)
    '&:hover > *': {
      background: theme.palette.action.active,
    },
  },
  thumb: {
    position: 'absolute',
    right: 2,
    width: 6,
    borderRadius: 3,
    background: theme.palette.action.disabled,
    pointerEvents: 'none',
  },
}))

/**
 * Draggable vertical scrollbar overlay for canvas-backed displays that scroll
 * their content via a `scrollTop` value (alignments pileup, variant matrix).
 * Renders nothing when the content fits the viewport. The thumb geometry and
 * the drag-to-scroll mapping live here so the consumers don't each re-derive
 * them; the wheel handling stays per-display (their gesture semantics differ).
 *
 * Deliberately NOT a keyboard tab stop: the surrounding views have no working
 * keyboard navigation to reach the scrolled content anyway, so a per-track
 * `tabIndex` would only add noise to the tab order. The `role="scrollbar"` +
 * `aria-value*` semantics are kept — they cost nothing and expose scroll
 * position to pointer/voice assistive tech.
 */
export default function VerticalScrollbar({
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
  /** Track offset from the top, for displays with a sticky band above it. */
  top?: number
}) {
  const { classes } = useStyles()
  // ephemeral drag anchor; null when not dragging. Pointer capture (set on the
  // track) delivers move/up here even when the pointer leaves the thin track,
  // and auto-releases on unmount — so no document listeners or effect cleanup.
  const dragRef = useRef<{ startY: number; startScroll: number }>(undefined)

  const scrollableHeight = Math.max(0, contentHeight - viewportHeight)
  if (scrollableHeight <= 0) {
    return null
  }
  const clampedScrollTop = clamp(scrollTop, 0, scrollableHeight)
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
  const usableTrack = viewportHeight - thumbHeight
  // clamp so a scrollTop past scrollableHeight (virtual-scroll displays don't
  // self-correct like a native overflow container) can't draw the thumb below
  // the track
  const thumbTop = clamp(
    (clampedScrollTop / scrollableHeight) * usableTrack,
    0,
    usableTrack,
  )

  function handlePointerDown(e: React.PointerEvent) {
    // stopPropagation so the drag doesn't also pan the view; no preventDefault
    // on pointerdown so its native focus shift can still close open popups.
    e.stopPropagation()
    // Click-to-page: a click on the track above/below the thumb jumps one
    // viewport toward the click (like a native scrollbar), rather than starting
    // a drag. The thumb is pointerEvents:none so every click lands on the track;
    // decide page-vs-drag from the click's Y relative to the thumb.
    const clickY = e.clientY - e.currentTarget.getBoundingClientRect().top
    if (clickY < thumbTop || clickY > thumbTop + thumbHeight) {
      const dir = clickY < thumbTop ? -1 : 1
      setScrollTop(
        clamp(clampedScrollTop + dir * viewportHeight, 0, scrollableHeight),
      )
    } else {
      dragRef.current = { startY: e.clientY, startScroll: clampedScrollTop }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (drag && usableTrack > 0) {
      const delta = ((e.clientY - drag.startY) / usableTrack) * scrollableHeight
      setScrollTop(clamp(drag.startScroll + delta, 0, scrollableHeight))
    }
  }

  return (
    <div
      data-testid="vertical-scrollbar"
      className={classes.track}
      style={{ top, height: viewportHeight }}
      role="scrollbar"
      aria-label="Vertical scrollbar"
      aria-controls={controlsId}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(scrollableHeight)}
      aria-valuenow={Math.round(clampedScrollTop)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragRef.current = undefined
      }}
      onPointerCancel={() => {
        dragRef.current = undefined
      }}
    >
      <div
        className={classes.thumb}
        style={{ top: thumbTop, height: thumbHeight }}
      />
    </div>
  )
}
