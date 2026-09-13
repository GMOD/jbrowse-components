import { useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import { usePointerDrag } from '../util/usePointerDrag.ts'
import { useRafCommit } from '../util/useRafCommit.ts'
import { useVirtualScrollWheel } from '../util/useVirtualScrollWheel.ts'

import type { VirtualScrollModel } from '../util/useVirtualScrollWheel.ts'

/**
 * How much of a display's right edge this occupies while it is drawn, for the
 * chrome the displays draw beside it.
 */
export const VERTICAL_SCROLLBAR_WIDTH = 12

/** Where the right edge of something sitting beside the thumb goes. */
export const VERTICAL_SCROLLBAR_CLEARANCE = VERTICAL_SCROLLBAR_WIDTH + 2

const MIN_THUMB_HEIGHT = 20

const useStyles = makeStyles()(theme => ({
  track: {
    position: 'absolute',
    right: 0,
    width: VERTICAL_SCROLLBAR_WIDTH,
    cursor: 'default',
    zIndex: 10,
    // without it the browser claims a touch drag as a page scroll
    touchAction: 'none',
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
 * Draggable vertical scrollbar overlay for a virtually scrolled display.
 * Renders nothing when the content fits.
 *
 * Not a keyboard tab stop: the views have no keyboard navigation to reach the
 * scrolled content, so `tabIndex` would only add noise. The `role="scrollbar"`
 * semantics stay for pointer and voice assistive tech.
 */
const VerticalScrollbar = observer(function VerticalScrollbar({
  model,
  controlsId,
  top = 0,
}: {
  model: VirtualScrollModel
  /** `id` of the scrolled viewport element, for `aria-controls`. */
  controlsId: string
  /** Track offset from the top, for displays with a sticky band above it. */
  top?: number
}) {
  const { classes } = useStyles()
  const dragRef = useRef<{ startY: number; startScroll: number }>(undefined)
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null)
  const { schedule: scheduleScroll, flush: flushScroll } = useRafCommit(
    (n: number) => {
      model.setScrollTop(n)
    },
  )
  const {
    scrollTop,
    scrollableHeight,
    scrollViewportHeight: viewportHeight,
  } = model

  // Wheeling the scrollbar always scrolls the panel, whatever `scrollZoom`
  // says, and never reaches the view.
  useVirtualScrollWheel(trackEl, model, (e, scroll) => {
    scroll()
    e.stopPropagation()
  })

  const clampedScrollTop = clamp(scrollTop, 0, scrollableHeight)
  const contentHeight = viewportHeight + scrollableHeight
  const thumbHeight = Math.min(
    viewportHeight,
    Math.max(
      MIN_THUMB_HEIGHT,
      viewportHeight * (viewportHeight / contentHeight),
    ),
  )
  const usableTrack = viewportHeight - thumbHeight
  const thumbTop = clamp(
    (clampedScrollTop / scrollableHeight) * usableTrack,
    0,
    usableTrack,
  )

  // A press on the track above or below the thumb pages one viewport toward it
  // rather than starting a drag; `dragRef` staying unset makes the captured
  // moves that follow do nothing.
  const drag = usePointerDrag({
    onDragStart: e => {
      const clickY = e.clientY - e.currentTarget.getBoundingClientRect().top
      if (clickY < thumbTop || clickY > thumbTop + thumbHeight) {
        const dir = clickY < thumbTop ? -1 : 1
        model.setScrollTop(
          clamp(clampedScrollTop + dir * viewportHeight, 0, scrollableHeight),
        )
      } else {
        dragRef.current = { startY: e.clientY, startScroll: clampedScrollTop }
      }
    },
    onDrag: e => {
      const d = dragRef.current
      if (d && usableTrack > 0) {
        const delta = ((e.clientY - d.startY) / usableTrack) * scrollableHeight
        scheduleScroll(clamp(d.startScroll + delta, 0, scrollableHeight))
      }
    },
    onDragEnd: () => {
      flushScroll()
      dragRef.current = undefined
    },
  })

  // below every hook: "the content fits" flips while mounted
  if (scrollableHeight <= 0) {
    return null
  }

  return (
    <div
      ref={setTrackEl}
      data-testid="vertical-scrollbar"
      // pointer-event drags share no event with the mouse-event gestures above
      // (the view's pan, MAF's selection), so the marker is what claims the press
      data-gesture-owner="true"
      className={classes.track}
      style={{ top, height: viewportHeight }}
      role="scrollbar"
      aria-label="Vertical scrollbar"
      aria-controls={controlsId}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(scrollableHeight)}
      aria-valuenow={Math.round(clampedScrollTop)}
      {...drag}
      // every button, so a right-press the drag ignores doesn't pan the view
      // either; no preventDefault, so focus still moves and menus still open
      onPointerDown={e => {
        e.stopPropagation()
        drag.onPointerDown(e)
      }}
    >
      <div
        className={classes.thumb}
        style={{ top: thumbTop, height: thumbHeight }}
      />
    </div>
  )
})

export default VerticalScrollbar
