import { useRef, useState } from 'react'

import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import { usePointerDrag } from '../util/usePointerDrag.ts'
import { useRafCommit } from '../util/useRafCommit.ts'
import { useVirtualScrollWheel } from '../util/useVirtualScrollWheel.ts'

/**
 * How much of a display's right edge this occupies while it is drawn.
 *
 * Exported because the things that have to *clear* it are drawn by the displays
 * that mount it, not by this file: the bottom-right indicator row and the
 * alignments coverage axis label. Both kept a private copy of the number (and
 * the alignments indicator row kept none at all, so its chips were drawn over
 * the thumb), which is a copy that can only be checked by looking at two files
 * at once.
 */
export const VERTICAL_SCROLLBAR_WIDTH = 12

/**
 * Where the right edge of anything that has to sit *beside* the thumb goes: the
 * track's width plus a hair of air, so a chip or an axis label doesn't touch it.
 *
 * The four call sites all spelled `VERTICAL_SCROLLBAR_WIDTH + 2` inline, which
 * is the same copy the width constant was exported to stop — one addition
 * further along. The `+ 2` is a gap and belongs to the thing being cleared, not
 * to the scrollbar's own geometry, so it is named rather than folded into the
 * width (`right: 2` on the thumb is a different 2 and must not move with it).
 */
export const VERTICAL_SCROLLBAR_CLEARANCE = VERTICAL_SCROLLBAR_WIDTH + 2

const MIN_THUMB_HEIGHT = 20

const useStyles = makeStyles()(theme => ({
  track: {
    position: 'absolute',
    right: 0,
    width: VERTICAL_SCROLLBAR_WIDTH,
    cursor: 'default',
    zIndex: 10,
    // `usePointerDrag`'s one caller-owned requirement: without it the browser
    // claims a touch drag on this strip as a page scroll and no pointer stream
    // arrives at all, so the thumb simply doesn't drag by finger.
    touchAction: 'none',
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
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null)
  // A thumb drag's pointermove can fire faster than the frame rate, so coalesce
  // its scroll writes to one commit per frame; pointer-up flushes the final
  // (absolute) target so the resting position is exact.
  const { schedule: scheduleScroll, flush: flushScroll } =
    useRafCommit(setScrollTop)

  const scrollableHeight = Math.max(0, contentHeight - viewportHeight)

  // Wheeling while the pointer is over the scrollbar always scrolls the panel,
  // never zooms the view. The scrollbar overlay is a sibling of the canvas, so
  // its wheel events would otherwise bubble straight past the canvas's own
  // handler to the containing view's scroll-zoom. A native non-passive listener
  // here (via useVirtualScrollWheel) consumes the vertical delta into
  // setScrollTop and stopPropagation keeps it from reaching that scroll-zoom.
  useVirtualScrollWheel(trackEl, (e, applyScroll) => {
    applyScroll(e, { scrollTop, viewportHeight, scrollableHeight }, n => {
      setScrollTop(n)
    })
    e.stopPropagation()
  })

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

  // The press lifecycle is `usePointerDrag`'s: primary button only, one drag per
  // pointer, capture on the track so moves keep arriving once the pointer leaves
  // the 12px strip, and auto-release on unmount. Hand-rolled here before that
  // existed, which cost two of the bugs it is written to prevent — a right-press
  // started a drag that then ran underneath its own context menu, and a second
  // finger landing mid-drag re-anchored the gesture.
  const drag = usePointerDrag({
    // Click-to-page: a press on the track above/below the thumb jumps one
    // viewport toward it (like a native scrollbar) rather than starting a drag.
    // The thumb is pointerEvents:none so every press lands on the track; decide
    // page-vs-drag from its Y relative to the thumb. `dragRef` staying undefined
    // is what makes the paging branch ignore the moves that follow — the pointer
    // is captured either way, and a page press simply has nothing to do with them.
    onDragStart: e => {
      const clickY = e.clientY - e.currentTarget.getBoundingClientRect().top
      if (clickY < thumbTop || clickY > thumbTop + thumbHeight) {
        const dir = clickY < thumbTop ? -1 : 1
        setScrollTop(
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

  // Below every hook, not above the geometry it reads: "the content fits" is a
  // prop-driven condition that flips while mounted, so an early return above
  // `usePointerDrag` would call a different number of hooks per render. The
  // geometry it closes over is computed either way and simply goes unused here —
  // nothing renders, so nothing can dispatch a pointer event at it.
  if (scrollableHeight <= 0) {
    return null
  }

  return (
    <div
      ref={setTrackEl}
      data-testid="vertical-scrollbar"
      // Claim the press so gesture ancestors (the view's click-drag pan, MAF's
      // drag-selection) don't also start on it. The stopPropagation below can't
      // do that job: this drags on pointer events and they listen on mouse
      // events, so there is no shared event to stop — see ResizeHandle, which
      // stamps the same marker for the same reason.
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
      // Wraps the hook's own handler rather than replacing it: stopPropagation
      // so the press doesn't also pan the view, and it runs for every button, so
      // a right-press the drag ignores still doesn't reach the view. No
      // preventDefault, so the native focus shift can still close open popups
      // and the context menu still opens.
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
}
