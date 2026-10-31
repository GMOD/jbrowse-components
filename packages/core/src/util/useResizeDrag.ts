import { useRef } from 'react'

import { usePointerDrag } from './usePointerDrag.ts'
import { useRafCommit } from './useRafCommit.ts'

import type React from 'react'

/**
 * A pointer drag along one axis, reported as a distance per animation frame.
 *
 * This is the whole gesture behind a resize handle with no opinion about how the
 * handle looks. `ui/ResizeHandle` is this hook plus JBrowse's own 4px bar, and an
 * app drawing its own divider spreads the returned props onto it. That is the
 * per-track resize story for an embedder who mounts displays themselves: the
 * track row is the host's box, so the bar has to be theirs, but the gesture and
 * the two model calls are not.
 *
 * ```tsx
 * const handleProps = useResizeDrag({
 *   value: display.height,
 *   onChange: height => {
 *     display.setHeight(height)
 *   },
 *   onDragStart: () => {
 *     track.setResizing(true)
 *   },
 *   onDragEnd: () => {
 *     track.setResizing(false)
 *   },
 * })
 * return (
 *   <div
 *     {...handleProps}
 *     style={{ height: 4, cursor: 'row-resize', touchAction: 'none' }}
 *   />
 * )
 * ```
 *
 * `touchAction: 'none'` is the caller's half of the deal: without it the browser
 * claims a touch drag as a page scroll and the pointer stream never arrives.
 * `usePanZoom` writes the same property itself and this cannot — that one is
 * handed the element as a ref, while this returns props and never sees a node.
 * It stays out of those props because a caller's own `style` would silently
 * replace it.
 *
 * Three things a hand-rolled version gets wrong, none of which fails loudly:
 *
 * - **One commit per frame.** A pointermove stream (plus the browser's own
 *   coalesced batches) outruns the frame rate, and each commit reruns whatever
 *   the resize drives. Committing per event relayouts a pileup several times a
 *   frame and throws all but the last away.
 * - **The target is the value at the press plus the pointer's travel since**,
 *   so a dropped intermediate position costs nothing, and a drag that runs into
 *   the setter's clamp leaves the edge where it stopped until the pointer comes
 *   back to it, as a window edge does. The deprecated `onDrag` reports the
 *   travel since the last commit instead, so past a clamp its edge grows back
 *   from wherever the pointer turns, far from it; it is kept for plugins.
 * - **`data-gesture-owner` rides in the props.** It is the marker ancestor
 *   gestures test for (`closest('[data-gesture-owner]')`, in the LGV's own pan
 *   and in `usePanZoom`) before starting a drag of their own, so without it
 *   dragging a resize bar pans the view sideways instead. A `stopPropagation` is
 *   not a substitute: those ancestors listen on *mouse* events while this runs
 *   on *pointer* events, so there is no shared event to stop, and stopping the
 *   mousedown would also cost focus-on-click, whose document-level listener
 *   (`useFocusOnInteraction`) React's stopPropagation does block.
 */
/**
 * What a drag sets: a `value` and its setter, or the deprecated `onDrag`, the
 * pointer's travel since the last commit.
 */
export type ResizeDragCallback =
  | {
      /** The value the drag sizes, read at the press */
      value: number
      /**
       * The value the drag aims at: `value` at the press plus the pointer's
       * travel since, divided by `gain`, and whole. The setter clamps it.
       */
      onChange: (value: number) => void
      /**
       * A drag right or down lowers the value: a panel on the right of, or
       * below, the divider that sizes it.
       */
      reverse?: boolean
      onDrag?: undefined
    }
  | {
      /**
       * @deprecated pass `value` and `onChange`, which keep the edge under the
       * pointer past a clamp. How far the pointer has travelled since the last
       * committed frame, in px — divided by `gain`, and whole.
       */
      onDrag: (distance: number) => void
      value?: undefined
      onChange?: undefined
      reverse?: undefined
    }

export function useResizeDrag({
  onDrag,
  value,
  onChange,
  reverse = false,
  onDragStart,
  onDragEnd,
  vertical = false,
  gain = 1,
}: ResizeDragCallback & {
  onDragStart?: () => void
  onDragEnd?: () => void
  /**
   * A vertical divider, dragged left/right (so the distance comes off `clientX`).
   * The default is a horizontal divider dragged up/down, which is a track
   * resize.
   */
  vertical?: boolean
  /**
   * How many px this handle's own position moves per px the dragged value
   * changes. The default 1 is a divider that moves with what it sizes.
   *
   * It is more than 1 whenever the value is SHARED by several stacked copies and
   * this handle sits below more than one of them: the second of three synteny
   * ribbons, or the second group's coverage band in a grouped pileup, moves 2px
   * for every 1px of height, so an undivided drag ran the bar away at twice the
   * pointer's speed and slid it out from under the cursor. Divide by the number
   * of copies at or above the handle and the bar stays put; the value then
   * changes by a fraction of the drag, which is what sharing it means.
   */
  gain?: number
}) {
  const prevPosRef = useRef(0)
  const startRef = useRef({ pos: 0, value: 0, travel: 0 })

  const getPos = (event: React.PointerEvent) =>
    vertical ? event.clientX : event.clientY

  // The scheduled value is the absolute pointer position, last-write-wins, and
  // the delta against the previous commit is derived here.
  //
  // Whole px, and the remainder stays in the baseline rather than in a second
  // ref: a divided delta has a sub-pixel tail, and every consumer rounds (a band
  // height is whole px), so rounding it away each frame instead made a gain-2
  // drag travel 4/3 of the pointer. Leaving the unspent fraction ahead of
  // `prevPos` is the same mechanism that keeps a drag into a clamp from banking
  // debt — the distance is always measured from what was last committed.
  const { schedule, flush } = useRafCommit(pos => {
    if (onChange) {
      const start = startRef.current
      const travel = Math.trunc((pos - start.pos) / gain)
      if (travel !== start.travel) {
        start.travel = travel
        onChange(start.value + (reverse ? -travel : travel))
      }
    } else {
      const distance = Math.trunc((pos - prevPosRef.current) / gain)
      if (distance !== 0) {
        prevPosRef.current += distance * gain
        onDrag(distance)
      }
    }
  })

  const handlers = usePointerDrag({
    onDragStart: event => {
      const pos = getPos(event)
      prevPosRef.current = pos
      startRef.current = { pos, value: value ?? 0, travel: 0 }
      onDragStart?.()
    },
    onDrag: event => {
      event.preventDefault()
      // read the position synchronously: the deferred commit runs after React
      // has nulled the event
      schedule(getPos(event))
    },
    onDragEnd: () => {
      // land the resting size exactly, rather than a frame late
      flush()
      onDragEnd?.()
    },
  })

  return {
    ...handlers,
    onPointerDown: (event: React.PointerEvent) => {
      // stops the press from starting a text selection that follows the drag
      event.preventDefault()
      handlers.onPointerDown(event)
    },
    'data-gesture-owner': 'true',
  }
}
